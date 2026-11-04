#!/usr/bin/env node
// The gate. Checks manifests against the schema and their folders, examples
// and guide snippets against the manifests, component CSS against the
// spacing-ownership rule, and the layer files against the layer contract.
// Reports every problem it finds, then exits non-zero if there were any.
// Warnings (markup that is legal but likely not what was meant) print too
// and never change the exit code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYER_STATEMENT } from './lib/layers.js';
import { loadSchema, loadAndMerge, loadVocabulary } from './lib/manifest.js';
import { parseHtml, walkElements, elementChildren, classList, attributes, countMatches } from './lib/html.js';
import { stripComments, splitImports } from './lib/imports.js';
import { walkFiles } from './lib/files.js';
import { declaredTokens, loadCatalogue } from './lib/tokens.js';
import { extractHtmlBlocks } from './lib/markdown.js';
import { validateFields } from './lib/validate-fields.js';
import { validateThemes } from './lib/validate-themes.js';
import { validateDocsFragments } from './lib/validate-docs.js';
export { extractHtmlBlocks, validateFields, validateThemes, validateDocsFragments };

const MARGIN_RE = /(?:^|[;\s{])margin(?:-block|-inline)?(?:-start|-end)?\s*:\s*([^;]*)/g;

export function formatError(root, e) {
	return `${path.relative(root, e.file)}${e.line ? `:${e.line}` : ''}: ${e.message}`;
}

/**
 * Checks every element carrying a framework identity class against that component's contract.
 * `allowed` names attributes that are legal anywhere (a fixture's test-only hooks).
 */
export function validateElementTree(root, merged, file, lineOffset = 0, allowed = new Set()) {
	const errors = [];
	const byClass = new Map(Object.values(merged).map((m) => [m.class, m]));

	// A child marker such as data-split or data-center is declared by the PARENT
	// layout's markers (or its children contract), so it is legal on any element,
	// including one that is itself a layout. Its value is checked below, on the
	// descendants of the component that declares it.
	const childMarkers = new Set(allowed);
	for (const m of Object.values(merged)) {
		for (const marker of m.markers ?? []) childMarkers.add(marker.name);
		for (const child of m.children ?? []) {
			for (const found of child.selector.matchAll(/\[(data-[a-z0-9-]+)\]/g)) childMarkers.add(found[1]);
		}
	}
	// Nested components of one kind share descendants; report each marker once.
	const checkedMarkers = new Map();

	walkElements(root, (el) => {
		// An element may carry more than one identity class: a utility on a
		// layout, `.cluster.enter`, or on a component, `.card.lift`. Each
		// component's own contract is still checked on its own below, but an
		// attribute only has to be declared by ONE of the identities present,
		// or a staggered cluster would be told that data-gap is unknown to
		// .enter and data-stagger unknown to .cluster, both of which are the
		// validator's confusion and not the page's.
		const onAnyIdentity = new Set(classList(el).flatMap((c) => (byClass.get(c)?.attributes ?? []).map((a) => a.name)));
		for (const cls of classList(el)) {
			const m = byClass.get(cls);
			if (!m) continue;
			const line = el.sourceCodeLocation ? el.sourceCodeLocation.startLine + lineOffset : undefined;
			const push = (message) => errors.push({ file, line, message: `.${cls} <${el.tagName}>: ${message}` });
			const attrs = attributes(el);
			const declared = new Map(m.attributes.map((a) => [a.name, a]));

			for (const [name, value] of attrs) {
				if (!name.startsWith('data-')) continue;
				const decl = declared.get(name);
				if (!decl) {
					if (!childMarkers.has(name) && !onAnyIdentity.has(name)) push(`unknown attribute ${name}`);
					continue;
				}
				if (decl.type === 'enum' && !decl.values.includes(value)) push(`${name}="${value}" is not one of ${decl.values.join(', ')}`);
				if (decl.type === 'boolean' && value !== '') push(`${name} is a boolean attribute and takes no value`);
				if (decl.type === 'number' && (value.trim() === '' || !Number.isFinite(Number(value)))) push(`${name}="${value}" is not a number`);
			}
			if (m.name === 'grid' && attrs.has('data-fold') && !['2', '4', '6'].includes(attrs.get('data-columns'))) {
				push('data-fold needs data-columns 2, 4, or 6');
			}
			// A tracks grid places children by line, and a line past the last
			// track makes an implicit one instead of an error the page can see,
			// so a placement that does not fit is caught here, not clamped in CSS.
			if (m.name === 'grid' && attrs.has('data-tracks') && attrs.has('data-fold')) {
				push('data-tracks and data-fold do not mix; a tracks grid places its children itself');
			}
			if (m.name === 'grid' && attrs.has('data-tracks')) {
				const tracks = Number(attrs.get('data-tracks'));
				for (const child of elementChildren(el)) {
					const own = attributes(child);
					if (!own.has('data-start') || !Number.isFinite(tracks)) continue;
					const start = Number(own.get('data-start'));
					const span = own.has('data-span') ? Number(own.get('data-span')) : 1;
					const at = child.sourceCodeLocation ? child.sourceCodeLocation.startLine + lineOffset : line;
					const report = (message) => errors.push({ file, line: at, message: `.${cls} <${el.tagName}>: ${message}` });
					if (start > tracks) report(`data-start="${start}" on <${child.tagName}> is past the last of ${tracks} tracks`);
					else if (start + span - 1 > tracks) report(`data-start="${start}" data-span="${span}" on <${child.tagName}> runs to track ${start + span - 1} of ${tracks}`);
				}
			}
			// A group whose parent is a fieldset with a legend is already a named
			// group, so the role and the name the contract asks for would only
			// announce the same set twice.
			const inFieldset = m.a11y.role === 'group' && el.parentNode?.tagName === 'fieldset'
				&& elementChildren(el.parentNode).some((c) => c.tagName === 'legend');
			for (const required of inFieldset ? [] : m.a11y.requiredAttributes) {
				// "aria-label | aria-labelledby": any one of them satisfies the entry.
				const options = required.split('|').map((r) => r.trim());
				if (!options.some((r) => attrs.has(r))) {
					push(options.length > 1 ? `missing required attribute: one of ${options.join(', ')}` : `missing required attribute ${required}`);
				}
			}
			for (const child of m.children) {
				const found = countMatches(el, child.selector);
				const min = child.min ?? 0;
				const max = child.max ?? null;
				if (found < min) push(`expected at least ${min} of "${child.selector}", found ${found}`);
				if (max !== null && found > max) push(`expected at most ${max} of "${child.selector}", found ${found}`);
			}
			const markers = new Map((m.markers ?? []).map((k) => [k.name, k]));
			if (!markers.size) continue;
			// The declaring element carries the same markers as its descendants
			// (a box painted on its own root is still a box), so it is checked
			// with the same logic rather than only what walkElements finds below it.
			const checkMarkers = (d) => {
				for (const [name, value] of attributes(d)) {
					const marker = markers.get(name);
					if (!marker) continue;
					if (!checkedMarkers.has(d)) checkedMarkers.set(d, new Set());
					if (checkedMarkers.get(d).has(name)) continue;
					checkedMarkers.get(d).add(name);
					const at = d.sourceCodeLocation ? d.sourceCodeLocation.startLine + lineOffset : undefined;
					const report = (message) => errors.push({ file, line: at, message: `.${cls} <${el.tagName}>: attribute ${message}` });
					if (marker.type === 'enum' && !marker.values.includes(value)) report(`${name}="${value}" on <${d.tagName}> is not one of ${marker.values.join(', ')}`);
					if (marker.type === 'boolean' && value !== '') report(`${name} on <${d.tagName}> is a boolean attribute and takes no value`);
				}
			};
			checkMarkers(el);
			walkElements(el, checkMarkers);
		}
	});
	return errors;
}

// Hooks the browser specs read; they are not part of any component's contract.
const FIXTURE_ONLY = new Set(['data-contrast', 'data-contrast-border', 'data-contrast-id', 'data-contrast-edge-id']);

/** Fixtures are markup too: anything a browser test renders must be markup the manifests allow. */
/**
 * One HTML string against a merged manifest object, for HTML that lives outside
 * src/: a built page, an editor's buffer, a snippet an agent is about to write.
 * Takes the manifest as data, not a source tree, which is what a consumer has.
 */
export function validateHtmlString(html, merged, file = 'snippet') {
	return validateElementTree(parseHtml(html), merged, file);
}

export function validateFixtures(fixturesDir, merged) {
	if (!fs.existsSync(fixturesDir)) return [];
	const errors = [];
	for (const file of walkFiles(fixturesDir).filter((f) => f.endsWith('.html'))) {
		errors.push(...validateElementTree(parseHtml(fs.readFileSync(file, 'utf8')), merged, file, 0, FIXTURE_ONLY));
	}
	return errors;
}

/** The starter page is markup a designer copies, so it is held to the manifests like an example. */
export function validateStarter(srcDir, merged) {
	const file = path.join(srcDir, 'starter', 'index.html');
	if (!fs.existsSync(file)) return [];
	return validateElementTree(parseHtml(fs.readFileSync(file, 'utf8')), merged, file);
}

export function validateExamples(entries, merged) {
	const errors = [];
	for (const entry of entries) {
		const file = path.join(entry.dir, 'example.html');
		const tree = parseHtml(fs.readFileSync(file, 'utf8'));
		errors.push(...validateElementTree(tree, merged, file));
		let used = false;
		walkElements(tree, (el) => { if (classList(el).includes(entry.manifest.class)) used = true; });
		if (!used) errors.push({ file, message: `example does not use .${entry.manifest.class}` });
	}
	return errors;
}

export function validateGuides(guidesDir, merged, entries = []) {
	const errors = [];
	if (fs.existsSync(guidesDir)) {
		for (const file of walkFiles(guidesDir).filter((f) => f.endsWith('.md'))) {
			const markdown = fs.readFileSync(file, 'utf8');
			for (const block of extractHtmlBlocks(markdown)) {
				errors.push(...validateElementTree(parseHtml(block.html), merged, file, block.line - 1));
			}
		}
	}
	for (const entry of entries) {
		const file = path.join(entry.dir, 'docs.md');
		if (!fs.existsSync(file)) continue;
		const markdown = fs.readFileSync(file, 'utf8');
		for (const block of extractHtmlBlocks(markdown)) {
			errors.push(...validateElementTree(parseHtml(block.html), merged, file, block.line - 1));
		}
	}
	return errors;
}

/** Splits a selector list on the commas outside parentheses and brackets. */
function splitSelectors(selector) {
	const out = [];
	let depth = 0;
	let current = '';
	for (const ch of selector) {
		if (ch === '(' || ch === '[') depth += 1;
		else if (ch === ')' || ch === ']') depth -= 1;
		if (ch === ',' && depth === 0) { out.push(current); current = ''; } else current += ch;
	}
	out.push(current);
	return out.map((m) => m.trim()).filter(Boolean);
}

/**
 * True when a compound selector's subject is an element carrying .className: `.card`,
 * `.card[data-raised]`, `.card:not([data-x])`, `article.card:hover`, `:is(.card, .pill)`.
 * A combinator or a pseudo-element makes it some other box, so not the component's own.
 */
function targetsBare(member, className) {
	let depth = 0;
	for (const ch of member) {
		if (ch === '(' || ch === '[') depth += 1;
		else if (ch === ')' || ch === ']') depth -= 1;
		else if (depth === 0 && /[\s>+~]/.test(ch)) return false;
	}
	if (/::/.test(member)) return false;
	// :is(...)/:where(...) in the compound: any wrapped member counts.
	for (const wrapped of member.matchAll(/:(?:is|where)\(((?:[^()]|\([^()]*\))*)\)/g)) {
		if (splitSelectors(wrapped[1]).some((m) => targetsBare(m, className))) return true;
	}
	// Drop attribute selectors and pseudo-classes (with any argument) to leave tags and classes.
	const plain = member.replace(/\[[^\]]*\]/g, '').replace(/:[a-z-]+(?:\((?:[^()]|\([^()]*\))*\))?/g, '');
	return [...plain.matchAll(/\.([a-z0-9_-]+)/g)].some((m) => m[1] === className);
}

/**
 * Returns the line of every block that targets the component's own box and whose own
 * declarations (not nested blocks) set a margin. Catches `.card`, `.card[data-x]`,
 * `.card:not(...)`, `:is(.card)` and a nested `&[data-x]` inside `.card { }`. Handles
 * native nesting and @layer / @supports wrappers.
 */
export function findBareMargin(css, className) {
	// Blank string literals too, preserving length, so "margin" inside a
	// content: or url() string never counts as a declaration.
	const text = stripComments(css).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => ' '.repeat(m.length));
	const hits = [];
	const stack = [];
	let selector = '';
	let selectorLine = 1;
	let line = 1;

	// A block is bare when one of its members targets the component, or is a `&`
	// suffix (no combinator) on a bare enclosing block; at-rule wrappers are skipped.
	const isBare = (sel) => {
		if (sel.startsWith('@')) return false;
		return splitSelectors(sel).some((member) => {
			if (member.startsWith('&')) {
				const parent = [...stack].reverse().find((b) => !b.selector.startsWith('@'));
				return Boolean(parent?.bare) && targetsBare(`.${className}${member.slice(1)}`, className);
			}
			return targetsBare(member, className);
		});
	};

	for (const ch of text) {
		if (ch === '{') {
			const sel = selector.trim();
			stack.push({ selector: sel, bare: isBare(sel), decls: '', line: selectorLine });
			selector = '';
		} else if (ch === '}') {
			const block = stack.pop();
			if (block?.bare) {
				for (const m of block.decls.matchAll(MARGIN_RE)) {
					if (m[1].trim().split(/\s+/).every((v) => v === 'auto')) continue;
					hits.push(block.line);
					break;
				}
			}
			selector = '';
		} else if (ch === ';') {
			if (stack.length) stack[stack.length - 1].decls += ch;
			selector = '';
		} else {
			if (stack.length) stack[stack.length - 1].decls += ch;
			if (selector.trim() === '' && !/\s/.test(ch)) selectorLine = line;
			selector += ch;
		}
		if (ch === '\n') line += 1;
	}
	return hits;
}

export function validateSpacing(entries) {
	const errors = [];
	for (const entry of entries) {
		const file = path.join(entry.dir, `${entry.name}.css`);
		for (const line of findBareMargin(fs.readFileSync(file, 'utf8'), entry.manifest.class)) {
			errors.push({ file, line, message: `.${entry.manifest.class} sets its own margin; spacing belongs to the parent layout (architecture §6.6)` });
		}
	}
	return errors;
}

export function validateLayers(srcDir) {
	const errors = [];
	const layersFile = path.join(srcDir, 'layers.css');
	const entryFile = path.join(srcDir, 'yeti.css');

	if (!fs.existsSync(layersFile)) {
		errors.push({ file: layersFile, message: 'missing' });
	} else {
		const text = stripComments(fs.readFileSync(layersFile, 'utf8')).replace(/\s+/g, ' ').trim();
		if (text !== LAYER_STATEMENT) errors.push({ file: layersFile, line: 1, message: `must contain exactly: ${LAYER_STATEMENT}` });
	}
	if (!fs.existsSync(entryFile)) {
		errors.push({ file: entryFile, message: 'missing' });
	} else {
		// A leading @charset is legal before @import; imports.js skips it too.
		const text = stripComments(fs.readFileSync(entryFile, 'utf8')).replace(/^\s*@charset\s+"[^"]*"\s*;/, '').trim();
		if (!/^@import\s+(?:url\(\s*)?["']layers\.css["']\s*\)?\s*;/.test(text)) {
			errors.push({ file: entryFile, line: 1, message: 'must begin with @import "layers.css";' });
		}
	}
	return errors;
}

const IMPORT_ORDER_MESSAGE = 'imports must come in the order layers.css, tokens/*, base/reset.css, base/*, layouts/attributes.css, layouts/*, recipes/*, components/*, then everything else';

/** Enforces the import order and that every tokens/base/layouts file is imported. */
export function validateImportOrder(srcDir) {
	const tokensDir = path.join(srcDir, 'tokens');
	const entryFile = path.join(srcDir, 'yeti.css');
	const attrFile = path.join(srcDir, 'layouts', 'attributes.css');
	if (!fs.existsSync(entryFile) || (!fs.existsSync(tokensDir) && !fs.existsSync(attrFile))) return [];
	const errors = [];
	const raw = splitImports(fs.readFileSync(entryFile, 'utf8'), entryFile).imports;
	// Normalise once so "./tokens/x.css" and "tokens/x.css" rank and match alike.
	const imports = raw.map((i) => ({ ...i, href: i.href.replace(/^\.\//, '') }));
	const hrefs = imports.map((i) => i.href);
	const rank = (href) => {
		if (href === 'layers.css') return 0;
		if (href.startsWith('tokens/')) return 1;
		if (href === 'base/reset.css') return 2;
		if (href.startsWith('base/')) return 3;
		if (href === 'layouts/attributes.css') return 4;
		if (href.startsWith('layouts/')) return 5;
		if (href.startsWith('recipes/')) return 6;
		if (href.startsWith('components/')) return 7;
		return 8;
	};
	const groupName = ['layers.css', 'tokens/', 'base/reset.css', 'base/', 'layouts/attributes.css', 'layouts/', 'recipes/', 'components/', 'the rest'];
	// Themes are opt-in overrides a page adds after yeti.css; bundling one would
	// make its tokens the default for everyone.
	for (const imp of imports) {
		if (imp.href.startsWith('themes/')) errors.push({ file: entryFile, line: imp.line, message: `themes are opt-in and must not be imported into yeti.css (found "${imp.href}")` });
		if (imp.href.startsWith('starter/')) errors.push({ file: entryFile, line: imp.line, message: `the starter is copied, not bundled, and must not be imported into yeti.css (found "${imp.href}")` });
	}
	// Report the first import that has something of a lower group after it.
	for (let i = 0; i < imports.length; i++) {
		const later = imports.slice(i + 1).find((imp) => rank(imp.href) < rank(imports[i].href));
		if (later) {
			errors.push({ file: entryFile, line: imports[i].line, message: `${IMPORT_ORDER_MESSAGE} (found "${imports[i].href}" before all of ${groupName[rank(later.href)]})` });
			break;
		}
	}
	if (fs.existsSync(tokensDir)) {
		const tokenFiles = fs.readdirSync(tokensDir).filter((f) => f.endsWith('.css')).map((f) => `tokens/${f}`);
		for (const f of tokenFiles) {
			if (!hrefs.includes(f)) errors.push({ file: entryFile, message: `${f} is not imported` });
		}
	}

	const baseDir = path.join(srcDir, 'base');
	if (fs.existsSync(baseDir)) {
		const baseFiles = fs.readdirSync(baseDir).filter((f) => f.endsWith('.css')).map((f) => `base/${f}`);
		for (const f of baseFiles) {
			if (!hrefs.includes(f)) errors.push({ file: entryFile, message: `${f} is not imported` });
		}
	}

	const layoutsDir = path.join(srcDir, 'layouts');
	if (fs.existsSync(layoutsDir)) {
		if (fs.existsSync(path.join(layoutsDir, 'attributes.css')) && !hrefs.includes('layouts/attributes.css')) {
			errors.push({ file: entryFile, message: 'layouts/attributes.css is not imported' });
		}
		for (const name of fs.readdirSync(layoutsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
			const f = `layouts/${name}/${name}.css`;
			if (fs.existsSync(path.join(srcDir, f)) && !hrefs.includes(f)) errors.push({ file: entryFile, message: `${f} is not imported` });
		}
	}

	const recipesDir = path.join(srcDir, 'recipes');
	if (fs.existsSync(recipesDir)) {
		for (const name of fs.readdirSync(recipesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
			const f = `recipes/${name}/${name}.css`;
			if (fs.existsSync(path.join(srcDir, f)) && !hrefs.includes(f)) errors.push({ file: entryFile, message: `${f} is not imported` });
		}
	}

	const componentsDir = path.join(srcDir, 'components');
	if (fs.existsSync(componentsDir)) {
		for (const name of fs.readdirSync(componentsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
			const f = `components/${name}/${name}.css`;
			if (fs.existsSync(path.join(srcDir, f)) && !hrefs.includes(f)) errors.push({ file: entryFile, message: `${f} is not imported` });
		}
	}
	return errors;
}

/**
 * !important is banned everywhere except the [hidden] rule in base/reset.css and
 * a token in src/tokens/ collapsed under reduced motion, where the reader's
 * setting has to outrank a theme.
 */
export function validateImportant(srcDir) {
	const errors = [];
	for (const file of walkFiles(srcDir).filter((f) => f.endsWith('.css'))) {
		const text = stripComments(fs.readFileSync(file, 'utf8'))
			.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => ' '.repeat(m.length));
		for (const m of text.matchAll(/!important/g)) {
			const before = text.slice(0, m.index);
			const selector = before.slice(before.lastIndexOf('{', before.lastIndexOf('{') - 1) + 1, before.lastIndexOf('{')).trim();
			const open = before.lastIndexOf('{');
			const declaration = before.slice(Math.max(before.lastIndexOf(';'), open) + 1).trim();
			const reducedMotion = path.relative(srcDir, file).startsWith(`tokens${path.sep}`)
				&& before.slice(0, before.lastIndexOf('{', open - 1)).trimEnd().endsWith('@media (prefers-reduced-motion: reduce)')
				&& declaration.startsWith('--yeti-');
			const allowed = reducedMotion || (path.relative(srcDir, file) === path.join('base', 'reset.css') && /\[hidden\]/.test(selector));
			if (!allowed) errors.push({ file, line: before.split('\n').length, message: '!important is not allowed (only the [hidden] rule in base/reset.css and the reduced-motion tokens may use it)' });
		}
	}
	return errors;
}

/** The catalogue and src/tokens/*.css must agree exactly. */
export function validateTokens(root, manifestEntries = []) {
	const catalogueFile = path.join(root, 'src', 'tokens', 'tokens.json');
	if (!fs.existsSync(catalogueFile)) return [];
	const schema = loadSchema(path.join(root, 'schema', 'tokens.schema.json'));
	const { entries, errors } = loadCatalogue(catalogueFile, schema);
	if (errors.length) return errors;

	const tokensComponent = manifestEntries.find((e) => e.name === 'tokens');
	if (tokensComponent) {
		errors.push({ file: tokensComponent.file, message: 'a component cannot be named "tokens"; docs/tokens.md is the generated token reference' });
	}

	const declaredIn = new Map();
	const tokensDir = path.join(root, 'src', 'tokens');
	for (const file of walkFiles(tokensDir).filter((f) => f.endsWith('.css'))) {
		for (const name of declaredTokens(fs.readFileSync(file, 'utf8'))) {
			if (!declaredIn.has(name)) declaredIn.set(name, file);
		}
	}
	const listed = new Map(entries.map((e) => [e.name, e]));
	for (const [name, file] of declaredIn) {
		if (!listed.has(name)) errors.push({ file, message: `${name} is declared but not in tokens.json` });
	}

	const srcDir = path.join(root, 'src');
	// Themes and the starter theme set public tokens; that is what they are for.
	const settingDirs = ['themes', 'starter'].map((d) => path.join(root, 'src', d) + path.sep);
	for (const file of walkFiles(srcDir).filter((f) => f.endsWith('.css') && !f.startsWith(tokensDir + path.sep) && !settingDirs.some((d) => f.startsWith(d)))) {
		for (const name of declaredTokens(fs.readFileSync(file, 'utf8'))) {
			errors.push({ file, message: `${name} is a public token declared outside src/tokens/; public tokens live in src/tokens/ and the catalogue` });
		}
	}

	for (const entry of entries) {
		const declared = entry.declared !== false;
		if (declared && !declaredIn.has(entry.name)) {
			errors.push({ file: catalogueFile, message: `${entry.name} is in the catalogue but not declared in src/tokens/*.css` });
		}
		if (!declared && declaredIn.has(entry.name)) {
			errors.push({ file: catalogueFile, message: `${entry.name} is marked declared: false but src/tokens/*.css declares it` });
		}
	}
	return errors;
}

/** Blanks comments and string literals, keeping every offset and line. */
function cssText(file) {
	return stripComments(fs.readFileSync(file, 'utf8')).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => ' '.repeat(m.length));
}
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Every token read must resolve: a public one to the catalogue, a private one to a
 * declaration somewhere in src/. A typo in a var() is otherwise silent in the browser.
 */
export function validateTokenReads(root) {
	const srcDir = path.join(root, 'src');
	if (!fs.existsSync(srcDir)) return [];
	const catalogueFile = path.join(srcDir, 'tokens', 'tokens.json');
	let publicNames = null;
	if (fs.existsSync(catalogueFile)) {
		const { entries, errors } = loadCatalogue(catalogueFile, loadSchema(path.join(root, 'schema', 'tokens.schema.json')));
		if (errors.length) return [];
		publicNames = new Set(entries.map((e) => e.name));
	}
	const files = walkFiles(srcDir).filter((f) => f.endsWith('.css')).map((f) => ({ file: f, text: cssText(f) }));
	const privateNames = new Set(files.flatMap(({ text }) => [...text.matchAll(PRIVATE_DECL_RE)].map((m) => m[1])));
	const errors = [];
	for (const { file, text } of files) {
		for (const m of text.matchAll(/var\(\s*(--(_?)yeti-[a-z0-9-]+)/g)) {
			const [, name, priv] = m;
			if (priv && !privateNames.has(name)) errors.push({ file, line: lineOf(text, m.index), message: `reads ${name}, which nothing in src/ declares` });
			if (!priv && publicNames && !publicNames.has(name)) errors.push({ file, line: lineOf(text, m.index), message: `reads ${name}, which is not in the catalogue` });
		}
	}
	return errors;
}

const MOTION_PROPS = ['transition', 'transition-duration', 'animation', 'animation-duration', 'animation-iteration-count', 'scroll-behavior'];
const MOTION_RE = new RegExp(`(?<![a-z-])(${MOTION_PROPS.join('|')})\\s*:\\s*([^;{}]*)`, 'g');

/**
 * Motion is a token so reduced motion can collapse it in one place. A literal
 * duration, iteration count or scroll-behavior in a component escapes that.
 */
export function validateMotion(srcDir) {
	const errors = [];
	const dirs = ['layouts', 'components', 'utilities'].map((d) => path.join(srcDir, d)).filter((d) => fs.existsSync(d));
	for (const file of dirs.flatMap((d) => walkFiles(d)).filter((f) => f.endsWith('.css'))) {
		const text = cssText(file);
		for (const m of text.matchAll(MOTION_RE)) {
			const [, prop, value] = m;
			// Anything a --yeti-* token supplies is fine; judge only what is left.
			const rest = value.replace(/var\(\s*--yeti-[a-z0-9-]+\s*(?:,[^()]*)?\)/g, ' ');
			// A zero duration is "no motion", the same as none.
			const literal = [...rest.matchAll(/(?<![a-z0-9.-])\d*\.?\d+m?s(?![a-z0-9-])|\binfinite\b|\bsmooth\b/g)].find((l) => parseFloat(l[0]) !== 0)
				?? (prop === 'animation-iteration-count' ? rest.match(/\d+/) : null);
			if (literal) errors.push({ file, line: lineOf(text, m.index), message: `${prop} must read a --yeti-* token or be none (found "${literal[0]}")` });
		}
	}
	return errors;
}

// The width tokens' defaults, in rem. Every container threshold in the
// framework is one of these or a whole multiple of one, so every breakpoint is
// a documented size rather than a number somebody liked. 12 is --yeti-width-2xs
// and arrived with data-show and data-hide, which map every stop; 8 is 3xs,
// two of which fit a phone.
const WIDTH_DEFAULTS = [8, 12, 16, 24, 32, 48, 64, 80];

/**
 * Anchors are scoped so nested components never bind to an outer one's name, and
 * container thresholds mirror a width token's default (or a column count times one),
 * so every breakpoint in the framework is a documented size.
 */
export function validateAnchorsAndContainers(srcDir) {
	if (!fs.existsSync(srcDir)) return [];
	const errors = [];
	for (const file of walkFiles(srcDir).filter((f) => f.endsWith('.css'))) {
		const text = cssText(file);
		const anchor = text.match(/(?<![a-z-])anchor-name\s*:/);
		if (anchor && !/(?<![a-z-])anchor-scope\s*:/.test(text)) {
			errors.push({ file, line: lineOf(text, anchor.index), message: 'anchor-name without anchor-scope; scope every anchor to its component' });
		}
		for (const m of text.matchAll(/@container[^{]*?\(\s*inline-size\s*(?:<=?|>=?|:)\s*([^)]+?)\s*\)/g)) {
			const value = m[1];
			const rem = value.match(/^(\d+(?:\.\d+)?)rem$/);
			const ok = value.startsWith('calc(') || (rem && WIDTH_DEFAULTS.some((w) => Number.isInteger(Number(rem[1]) / w)));
			if (!ok) errors.push({ file, line: lineOf(text, m.index), message: `@container threshold "${value}" is not a width token's default (${WIDTH_DEFAULTS.join(', ')}rem), a whole multiple of one, or a calc( of one` });
		}
	}
	return errors;
}

const PUBLIC_READ_RE = /var\(\s*(--yeti-[a-z0-9-]+)/g;
const PRIVATE_DECL_RE = /(--_yeti-[a-z0-9-]+)\s*:/g;

/**
 * A manifest's tokens[] is the component's theming surface, so it must match the
 * code: every public token the CSS (or the JS module) reads, listed public with a
 * description, and every private token the CSS declares, listed private.
 */
export function validateManifestTokens(entries) {
	const errors = [];
	for (const entry of entries) {
		const file = entry.file;
		const css = stripComments(fs.readFileSync(path.join(entry.dir, `${entry.name}.css`), 'utf8'));
		const reads = new Set([...css.matchAll(PUBLIC_READ_RE)].map((m) => m[1]));
		for (const mod of entry.manifest.js ?? []) {
			const moduleFile = path.join(entry.dir, mod.module);
			if (!fs.existsSync(moduleFile)) continue;
			const js = fs.readFileSync(moduleFile, 'utf8');
			for (const m of js.matchAll(/--yeti-[a-z0-9-]+/g)) reads.add(m[0]);
		}
		const declares = new Set([...css.matchAll(PRIVATE_DECL_RE)].map((m) => m[1]));
		const listed = new Map(entry.manifest.tokens.filter((t) => /^--_?yeti-/.test(t.name)).map((t) => [t.name, t]));
		for (const [name, token] of listed) {
			if (name.startsWith('--_')) {
				if (token.public) errors.push({ file, message: `${name} is a private token; mark it public: false` });
				if (!declares.has(name)) errors.push({ file, message: `manifest lists ${name} but the CSS never declares it` });
			} else {
				if (!token.public) errors.push({ file, message: `${name} is a public token; mark it public: true` });
				if (!token.description) errors.push({ file, message: `${name} needs a description: what it controls, in one line` });
				if (!reads.has(name)) errors.push({ file, message: `manifest lists ${name} but the CSS never reads it` });
			}
		}
		for (const name of reads) if (!listed.has(name)) errors.push({ file, message: `CSS reads ${name} but the manifest does not list it` });
		for (const name of declares) if (!listed.has(name)) errors.push({ file, message: `CSS declares ${name} but the manifest does not list it` });
	}
	return errors;
}

const EVENT_RE = /yeti:[a-z]+/g;

/**
 * A component's folder, its manifest and its module sources must agree: every
 * .js file in the folder is declared, every event the manifest promises is
 * named in the module that promises it, and every yeti: event a module names
 * is declared. The scan is over the raw source, comments included, because a
 * comment naming an event nothing declares is the same disagreement said
 * quietly, and the manifest is what the docs and the install guide are built
 * from.
 */
export function validateModules(entries) {
	const errors = [];
	for (const entry of entries) {
		const declared = entry.manifest.js ?? [];
		const names = new Set(declared.map((mod) => mod.module));
		for (const name of fs.readdirSync(entry.dir).filter((f) => f.endsWith('.js')).sort()) {
			if (!names.has(name)) errors.push({ file: entry.file, message: `${name} is in the folder but the manifest does not declare it under js` });
		}
		for (const mod of declared) {
			const moduleFile = path.join(entry.dir, mod.module);
			// A module the manifest names but the folder does not hold is the
			// loader's error to report, not this one's.
			if (!fs.existsSync(moduleFile)) continue;
			const source = fs.readFileSync(moduleFile, 'utf8');
			const named = new Set([...source.matchAll(EVENT_RE)].map((m) => m[0]));
			const promised = new Set((mod.events ?? []).map((e) => e.name));
			for (const name of promised) {
				if (!named.has(name)) errors.push({ file: entry.file, message: `${mod.module} is declared to dispatch ${name} but its source never names it` });
			}
			for (const name of named) {
				if (!promised.has(name)) errors.push({ file: entry.file, message: `${mod.module} names ${name} but the manifest does not declare it under js[].events` });
			}
		}
	}
	return errors;
}

// A size container is what data-show and data-hide measure; with none above
// them the query never matches and the element never changes. Each entry is a
// selector exactly as src/ writes it on a container-type: inline-size rule,
// with the test that stands in for it on parsed markup; a tools test reads
// every such rule in src/ and fails when one is missing here. An element that
// sets a container type inline counts too.
const MEDIA_FIRST = new Set(['img', 'video', 'picture', 'figure']);
const has = (el, cls) => classList(el).includes(cls);
const CONTAINER_TESTS = [
	['.container', (el) => has(el, 'container')],
	['.nav', (el) => has(el, 'nav')],
	['.pagination', (el) => has(el, 'pagination')],
	['.timeline', (el) => has(el, 'timeline')],
	['.demo > [data-preview]', (el) => attributes(el).has('data-preview') && Boolean(el.parentNode?.tagName) && has(el.parentNode, 'demo')],
	['.grid[data-fold]:not([data-tracks])', (el) => has(el, 'grid') && attributes(el).has('data-fold') && !attributes(el).has('data-tracks')],
	['.grid[data-tracks]', (el) => has(el, 'grid') && attributes(el).has('data-tracks')],
	['.cluster[data-threshold]', (el) => has(el, 'cluster') && attributes(el).has('data-threshold')],
	['.breakout:has(> [data-note])', (el) => has(el, 'breakout') && elementChildren(el).some((c) => attributes(c).has('data-note'))],
	// A card spanning a data-rows grid's rows is a subgrid, and its CSS turns
	// containment off there.
	['.card:has(> :is(img, video, picture, figure):first-child)', (el) => {
		if (!has(el, 'card') || !MEDIA_FIRST.has(elementChildren(el)[0]?.tagName)) return false;
		const parent = el.parentNode;
		return !(parent?.tagName && has(parent, 'grid') && attributes(parent).has('data-rows'));
	}],
];
export const SIZE_CONTAINERS = CONTAINER_TESTS.map(([selector]) => selector);
function isSizeContainer(el) {
	if (CONTAINER_TESTS.some(([, test]) => test(el))) return true;
	return /(?:^|;)\s*container(?:-type)?\s*:[^;]*\b(?:inline-size|size)\b/.test(attributes(el).get('style') ?? '');
}

/**
 * Warnings, not errors: an element with data-show or data-hide that has no
 * size container above it. The markup is legal and harmless, but it never
 * hides or shows, which is rarely what its author meant.
 */
// The show-hide fixture tests the no-container case on purpose: its loose
// elements are there to prove that data-show and data-hide do nothing
// without a size container, so warning about them would be noise.
const LOOSE_ON_PURPOSE = path.join('test', 'browser', 'fixtures', 'layouts', 'show-hide.html');

export function findLooseVisibility(tree, file, lineOffset = 0) {
	const warnings = [];
	if (file.endsWith(LOOSE_ON_PURPOSE)) return warnings;
	walkElements(tree, (el) => {
		const attrs = attributes(el);
		const name = ['data-show', 'data-hide'].find((n) => attrs.has(n));
		if (!name) return;
		for (let up = el.parentNode; up; up = up.parentNode) {
			if (up.tagName && isSizeContainer(up)) return;
		}
		const line = el.sourceCodeLocation ? el.sourceCodeLocation.startLine + lineOffset : undefined;
		warnings.push({ file, line, message: `${name} on <${el.tagName}> has no size container above it to measure, so it never changes; put it inside a container` });
	});
	return warnings;
}

/**
 * A warning: a cluster with data-threshold is a size container, so it cannot
 * take its width from its content, and as an item of another cluster (a flex
 * row that sizes items by their content) it has no width to measure and
 * collapses. It needs a width of its own, or flex-grow.
 */
export function findNestedThresholdClusters(tree, file, lineOffset = 0) {
	const warnings = [];
	walkElements(tree, (el) => {
		if (!classList(el).includes('cluster') || !attributes(el).has('data-threshold')) return;
		const parent = el.parentNode;
		if (!parent?.tagName || !classList(parent).includes('cluster')) return;
		const line = el.sourceCodeLocation ? el.sourceCodeLocation.startLine + lineOffset : undefined;
		warnings.push({ file, line, message: '.cluster[data-threshold] is an item of another .cluster, so it has no width of its own to measure; give it one, or flex-grow' });
	});
	return warnings;
}

/**
 * A warning: data-threshold on a grid, and data-start or data-span on its
 * children, only mean something in a tracks grid. data-span stays legal on
 * the children of columns and hero, which read it themselves.
 */
export function findUntrackedGridPlacement(tree, file, lineOffset = 0) {
	const warnings = [];
	const at = (el) => (el.sourceCodeLocation ? el.sourceCodeLocation.startLine + lineOffset : undefined);
	walkElements(tree, (el) => {
		if (!has(el, 'grid') || attributes(el).has('data-tracks')) return;
		if (attributes(el).has('data-threshold')) warnings.push({ file, line: at(el), message: 'data-threshold on a .grid without data-tracks does nothing' });
		for (const child of elementChildren(el)) {
			for (const name of ['data-start', 'data-span']) {
				if (attributes(child).has(name)) warnings.push({ file, line: at(child), message: `${name} on <${child.tagName}> does nothing in a .grid without data-tracks` });
			}
		}
	});
	return warnings;
}

const MARKUP_WARNINGS = [findLooseVisibility, findNestedThresholdClusters, findUntrackedGridPlacement];

/** Runs the markup warnings over examples, fixtures, guide and docs demos, and the starter. */
export function validateMarkupWarnings(root, entries) {
	const warnings = [];
	const check = (tree, file, lineOffset = 0) => { for (const find of MARKUP_WARNINGS) warnings.push(...find(tree, file, lineOffset)); };
	const html = (file) => check(parseHtml(fs.readFileSync(file, 'utf8')), file);
	const markdown = (file) => {
		for (const block of extractHtmlBlocks(fs.readFileSync(file, 'utf8'))) check(parseHtml(block.html), file, block.line - 1);
	};
	for (const entry of entries) {
		const example = path.join(entry.dir, 'example.html');
		if (fs.existsSync(example)) html(example);
		const docs = path.join(entry.dir, 'docs.md');
		if (fs.existsSync(docs)) markdown(docs);
	}
	const guidesDir = path.join(root, 'src', 'guides');
	if (fs.existsSync(guidesDir)) for (const file of walkFiles(guidesDir).filter((f) => f.endsWith('.md'))) markdown(file);
	const fixturesDir = path.join(root, 'test', 'browser', 'fixtures');
	if (fs.existsSync(fixturesDir)) for (const file of walkFiles(fixturesDir).filter((f) => f.endsWith('.html'))) html(file);
	const starter = path.join(root, 'src', 'starter', 'index.html');
	if (fs.existsSync(starter)) html(starter);
	return warnings;
}

const MAPPED = {
	'data-gap': 'gap', 'data-align': 'align', 'data-justify': 'justify', 'data-threshold': 'width',
	'data-width': 'width', 'data-height': 'height', 'data-min': 'width-or-none', 'data-max': 'width', 'data-ratio': 'ratio', 'data-columns': 'columns',
	'data-align-self': 'align', 'data-justify-self': 'self',
	'data-variant': 'variant', 'data-size': 'size-control',
	'data-span': 'span', 'data-rows': 'rows', 'data-tracks': 'tracks', 'data-start': 'start',
	'data-slides': 'slides',
	'data-show': 'width', 'data-hide': 'width',
	'data-paint': 'paint', 'data-text': 'paint',
	'data-gap-inline': 'gap', 'data-gap-block': 'gap', 'data-space': 'gap',
};

// Read directly by their own layout's CSS, so they have no attributes.css rule.
// data-enter and data-attention are here for the same reason: each value names
// an animation on the utility's own selector, and a mapped property would be a
// keyframe name in a custom property that nothing else could ever read.
// data-fit is here because each value sets two properties, not one: the two
// ends of a clamp, which no single mapped property could carry.
// data-print is here because its value sets no property at all: it decides
// which of two media a rule applies in, and a custom property cannot carry a
// media query.
const READ_DIRECTLY = new Set(['data-side', 'data-emphasis', 'data-shape', 'data-edge', 'data-panel', 'data-orientation', 'data-placement', 'data-trigger', 'data-resize', 'data-enter', 'data-attention', 'data-surface', 'data-fit', 'data-print', 'data-lift']);

/** Every value of every mapped vocabulary must have a rule in layouts/attributes.css,
 *  and every manifest attribute that references a vocabulary must be checked against
 *  the right one (or explicitly exempted as read directly by its own layout's CSS, or by its module). */
export function validateVocabulary(root, entries = []) {
	const vocabFile = path.join(root, 'schema', 'vocabulary.json');
	const attrFile = path.join(root, 'src', 'layouts', 'attributes.css');
	if (!fs.existsSync(vocabFile) || !fs.existsSync(attrFile)) return [];
	const vocabulary = loadVocabulary(vocabFile);
	const css = stripComments(fs.readFileSync(attrFile, 'utf8'));
	const present = new Set([...css.matchAll(/\[(data-[a-z-]+)="([^"]+)"\]/g)].map((m) => `${m[1]}=${m[2]}`));
	const errors = [];
	for (const [attr, vocab] of Object.entries(MAPPED)) {
		for (const value of vocabulary[vocab] ?? []) {
			if (!present.has(`${attr}=${value}`)) errors.push({ file: attrFile, message: `${attr}="${value}" (vocabulary ${vocab}) has no rule` });
		}
	}

	for (const entry of entries) {
		for (const attr of [...entry.manifest.attributes, ...(entry.manifest.markers ?? [])]) {
			if (!attr.vocabulary || READ_DIRECTLY.has(attr.name)) continue;
			if (!(attr.name in MAPPED)) {
				errors.push({ file: entry.file, message: `attribute ${attr.name} references vocabulary "${attr.vocabulary}" but validate does not check it; add it to MAPPED or READ_DIRECTLY in bin/validate.js` });
			} else if (MAPPED[attr.name] !== attr.vocabulary) {
				errors.push({ file: entry.file, message: `attribute ${attr.name} uses vocabulary "${attr.vocabulary}" but validate checks it against "${MAPPED[attr.name]}"` });
			}
		}
	}
	return errors;
}

/** Layouts respond to their container, never the viewport. */
export function validateNoMediaQueries(srcDir) {
	const errors = [];
	const dirs = ['layouts', 'recipes', 'components'].map((d) => path.join(srcDir, d)).filter((d) => fs.existsSync(d));
	for (const file of dirs.flatMap((d) => walkFiles(d)).filter((f) => f.endsWith('.css'))) {
		const text = stripComments(fs.readFileSync(file, 'utf8'));
		const m = text.match(/@media\b/);
		if (m) errors.push({ file, line: text.slice(0, m.index).split('\n').length, message: 'layouts are intrinsic; use container-relative techniques, not media queries' });
	}
	return errors;
}

/** yeti.theme is declared in layers.css so its place is fixed, and belongs to themes: Yeti ships nothing in it. */
export function validateThemeLayerUse(srcDir) {
	if (!fs.existsSync(srcDir)) return [];
	const own = ['themes', 'starter'].map((d) => path.join(srcDir, d) + path.sep);
	const layersFile = path.join(srcDir, 'layers.css');
	const errors = [];
	for (const file of walkFiles(srcDir).filter((f) => f.endsWith('.css') && f !== layersFile && !own.some((d) => f.startsWith(d)))) {
		const text = stripComments(fs.readFileSync(file, 'utf8'));
		for (const m of text.matchAll(/@layer\b([^{;]*)/g)) {
			if (!m[1].split(',').map((n) => n.trim()).includes('yeti.theme')) continue;
			errors.push({ file, line: lineOf(text, m.index), message: `Yeti ships nothing in the yeti.theme layer; it belongs to a theme (found "${m[0].trim()}")` });
		}
	}
	return errors;
}

export function validate({ root }) {
	const srcDir = path.join(root, 'src');
	const guidesDir = path.join(root, 'src', 'guides');
	const schema = loadSchema(path.join(root, 'schema', 'manifest.schema.json'));
	const vocabFile = path.join(root, 'schema', 'vocabulary.json');
	const vocabulary = fs.existsSync(vocabFile) ? loadVocabulary(vocabFile) : {};
	const { entries, merged, errors } = loadAndMerge(srcDir, schema, vocabulary);
	const all = [
		...errors,
		...validateExamples(entries, merged),
		...validateStarter(srcDir, merged),
		...validateGuides(guidesDir, merged, entries),
		...validateFixtures(path.join(root, 'test', 'browser', 'fixtures'), merged),
		...validateSpacing(entries),
		...validateLayers(srcDir),
		...validateImportOrder(srcDir),
		...validateImportant(srcDir),
		...validateTokens(root, entries),
		...validateManifestTokens(entries),
		...validateModules(entries),
		...validateTokenReads(root),
		...validateMotion(srcDir),
		...validateAnchorsAndContainers(srcDir),
		...validateVocabulary(root, entries),
		...validateNoMediaQueries(srcDir),
		...validateDocsFragments(entries),
		...validateFields(entries, guidesDir, path.join(root, 'test', 'browser', 'fixtures')),
		...validateThemes(root),
		...validateThemeLayerUse(srcDir),
	];
	const warnings = validateMarkupWarnings(root, entries);
	return { errors: all, warnings, count: Object.keys(merged).length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const root = process.cwd();
	const { errors, warnings, count } = validate({ root });
	// Warnings print and never change the exit code.
	for (const w of warnings) console.error(`warning: ${formatError(root, w)}`);
	for (const e of errors) console.error(formatError(root, e));
	if (errors.length) {
		console.error(`validate: ${errors.length} problem${errors.length === 1 ? '' : 's'}`);
		process.exit(1);
	}
	if (!process.argv.includes('--quiet')) console.log(`validate: ok (${count} component${count === 1 ? '' : 's'})`);
}
