#!/usr/bin/env node
// Produces dist/: one readable bundle, the source tree verbatim, per-component
// JS modules, and the merged manifest. Concatenation only. No transforms.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveImports } from './lib/imports.js';
import { loadSchema, loadAndMerge, loadVocabulary } from './lib/manifest.js';
import { validate, formatError } from './validate.js';
import { walkFiles } from './lib/files.js';
import { writeIde } from './gen-ide.js';
import { writeTypes } from './gen-types.js';
import { writeLlms } from './gen-llms.js';
import { minifyCss } from './lib/minify-css.js';
import { minifyJs, bannered } from './lib/minify-js.js';
import { LAYER_STATEMENT } from './lib/layers.js';

export function readPackage(root) {
	return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

// A shipped file's own version on the CDN, so an agent holding any copy reads
// the docs for what it has rather than the latest. It resolves once that
// version is published, which a release does.
export const cdnUrl = (pkg, file) => `https://cdn.jsdelivr.net/npm/${pkg.name}@${pkg.version}/dist/${file}`;

export function bundle({ root, pkg }) {
	const { files, errors } = resolveImports(path.join(root, 'src', 'yeti.css'));
	if (errors.length) return { css: null, errors };
	// A copied file may be the only trace of Yeti a project keeps, so the banner
	// says where the docs an agent can read are, as well as what it is.
	const header = `/*! ${pkg.name} ${pkg.version} | ${pkg.license} | ${pkg.homepage} | for agents: ${cdnUrl(pkg, 'llms.txt')} */\n`;
	const body = files.map((f) => `\n/* ${path.relative(root, f.path)} */\n${f.css.trim()}\n`).join('');
	// The banner and the stylesheet come back separately as well as joined:
	// the minified file needs the banner prepended to output that has had
	// every comment taken out of it.
	return { css: header + body, header, body, errors: [] };
}

export function build({ root, pkg = readPackage(root) }) {
	const checked = validate({ root });
	if (checked.errors.length) return { errors: checked.errors, outputs: [], warnings: [] };
	const bundled = bundle({ root, pkg });
	if (bundled.errors.length) return { errors: bundled.errors, outputs: [], warnings: [] };

	const srcDir = path.join(root, 'src');
	const distDir = path.join(root, 'dist');

	// Minify before anything is written, so a stylesheet lightningcss cannot
	// parse leaves the previous dist/ alone instead of half-replacing it.
	let minified;
	try {
		minified = minifyCss({ css: bundled.body, filename: 'yeti.css' });
	} catch (e) {
		return { errors: [{ file: path.join(root, 'src', 'yeti.css'), message: `lightningcss could not minify the bundle: ${e.message}` }], outputs: [], warnings: [] };
	}

	// One file with every module, for a page that would rather load one
	// script than pick. The modules import nothing and export nothing, so
	// each goes in its own block, which keeps their top-level names apart.
	// Minified in this same pre-write step, beside the stylesheet: esbuild
	// throws on anything it cannot parse, and that has to stop the build with
	// a named error rather than surface as an uncaught throw after dist/ has
	// already been wiped below. What is minified is the exact text of the
	// readable file, banner and all, so the source map points into yeti.js.
	const modules = walkFiles(srcDir).filter((f) => f.endsWith('.js')).sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
	let allJs = null;
	let allJsMinified = null;
	if (modules.length) {
		const parts = modules.map((file) => `// ${path.basename(file)}\n{\n${fs.readFileSync(file, 'utf8').trim()}\n}\n`);
		allJs = `// Yeti ${pkg.version}: every optional module in one file. Load with <script type="module">.\n\n${parts.join('\n')}`;
		try {
			allJsMinified = minifyJs(`${bundled.header}${allJs}`, { sourcefile: 'yeti.js' });
		} catch (e) {
			// esbuild's error is a line in the concatenated bundle, which names
			// no file; re-running it module by module finds the one that
			// broke, so this error reads like every other one build() reports.
			const broken = modules.find((file) => {
				try { minifyJs(fs.readFileSync(file, 'utf8')); return false; } catch { return true; }
			}) ?? modules[0];
			return { errors: [{ file: broken, message: `could not minify ${path.basename(broken)}: ${e.message}` }], outputs: [], warnings: [] };
		}
	}

	const outputs = [];
	const write = (rel, content) => {
		const file = path.join(distDir, rel);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, content);
		outputs.push(rel);
	};

	fs.rmSync(distDir, { recursive: true, force: true });
	fs.mkdirSync(path.join(distDir, 'js'), { recursive: true });

	write('yeti.css', bundled.css);
	// lightningcss folds the standalone @layer statement into the five layer
	// blocks it emits, which leaves the cascade order implicit; put it back
	// so the minified file declares the same order the source does.
	write('yeti.min.css', `${bundled.header}${LAYER_STATEMENT}\n${minified.css}\n`);

	fs.cpSync(srcDir, path.join(distDir, 'css'), {
		recursive: true,
		filter: (src) => !path.basename(src).startsWith('.') && !['themes', 'starter'].includes(path.relative(srcDir, src).split(path.sep)[0]),
	});
	outputs.push('css/');

	const themesDir = path.join(srcDir, 'themes');
	if (fs.existsSync(themesDir)) {
		for (const file of walkFiles(themesDir).filter((f) => f.endsWith('.css'))) {
			const rel = `themes/${path.basename(file)}`;
			fs.mkdirSync(path.join(distDir, 'themes'), { recursive: true });
			fs.copyFileSync(file, path.join(distDir, rel));
			outputs.push(rel);
		}
	}

	// The starter page and theme, copied as they are: two files a designer
	// copies to begin a site. The page links ../yeti.css, so it opens from here.
	const starterDir = path.join(srcDir, 'starter');
	if (fs.existsSync(starterDir)) {
		for (const file of walkFiles(starterDir).filter((f) => !path.basename(f).startsWith('.'))) {
			const rel = `starter/${path.relative(starterDir, file).split(path.sep).join('/')}`;
			fs.mkdirSync(path.dirname(path.join(distDir, rel)), { recursive: true });
			fs.copyFileSync(file, path.join(distDir, rel));
			outputs.push(rel);
		}
	}

	for (const file of modules) {
		const rel = `js/${path.basename(file)}`;
		fs.copyFileSync(file, path.join(distDir, rel));
		outputs.push(rel);
	}
	if (allJs !== null) {
		write('yeti.js', `${bundled.header}${allJs}`);
		// The banner goes back on after minifying, same as the stylesheet, on
		// its own line; the map is shifted by that line so it still points at
		// yeti.js exactly. The map is named on the last line, as browsers expect.
		write('yeti.min.js', `${bundled.header}${allJsMinified.js}\n//# sourceMappingURL=yeti.min.js.map\n`);
		write('yeti.min.js.map', `${JSON.stringify(bannered(allJsMinified.map, { file: 'yeti.min.js' }))}\n`);
	}

	const schema = loadSchema(path.join(root, 'schema', 'manifest.schema.json'));
	const vocabFile = path.join(root, 'schema', 'vocabulary.json');
	const vocabulary = fs.existsSync(vocabFile) ? loadVocabulary(vocabFile) : {};
	const { merged, entries } = loadAndMerge(srcDir, schema, vocabulary);
	write('yeti.manifest.json', `${JSON.stringify({
		framework: 'yeti',
		version: pkg.version,
		generated: new Date().toISOString().slice(0, 10),
		components: merged,
	}, null, 2)}\n`);

	const tokensSchemaFile = path.join(root, 'schema', 'tokens.schema.json');
	const tokensSchema = fs.existsSync(tokensSchemaFile) ? loadSchema(tokensSchemaFile) : null;

	const catalogueFile = path.join(srcDir, 'tokens', 'tokens.json');
	if (fs.existsSync(catalogueFile)) {
		write('yeti.tokens.json', `${JSON.stringify({
			framework: 'yeti',
			version: pkg.version,
			generated: new Date().toISOString().slice(0, 10),
			tokens: JSON.parse(fs.readFileSync(catalogueFile, 'utf8')),
		}, null, 2)}\n`);
	}

	outputs.push(...writeIde({ root, merged, vocabulary, pkg }));
	outputs.push(...writeTypes({ root, merged, vocabulary, tokensSchema }));
	outputs.push(...writeLlms({ root, merged, entries, pkg }));

	return { errors: [], outputs, warnings: minified.warnings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const root = process.cwd();
	const { errors, outputs, warnings } = build({ root });
	for (const w of warnings) console.warn(`build: lightningcss: ${w.message}`);
	for (const e of errors) console.error(formatError(root, e));
	if (errors.length) {
		console.error(`build: aborted, ${errors.length} problem${errors.length === 1 ? '' : 's'}`);
		process.exit(1);
	}
	console.log(`build: wrote dist/ (${outputs.length} entries)`);
}
