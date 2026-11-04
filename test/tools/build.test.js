import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { bundle, build } from '../../bin/build.js';
import { LAYER_STATEMENT } from '../../bin/lib/layers.js';
import { makeTree, validManifest, validTree } from './helpers.js';

const pkg = { name: '@foundation/yeti', version: '7.0.0-alpha.0', license: 'FSL-1.1-MIT', homepage: 'https://foundationcss.com/yeti/' };
const treeWithPkg = (extra = {}) => validTree({ 'package.json': pkg, ...extra });

test('bundle writes a header and each file in cascade order with source comments', () => {
	const root = makeTree(treeWithPkg());
	const r = bundle({ root, pkg });
	assert.deepEqual(r.errors, []);
	assert.ok(r.css.startsWith('/*! @foundation/yeti 7.0.0-alpha.0 | FSL-1.1-MIT | https://foundationcss.com/yeti/ | for agents: https://cdn.jsdelivr.net/npm/@foundation/yeti@7.0.0-alpha.0/dist/llms.txt */\n'));
	const layers = r.css.indexOf('/* src/layers.css */');
	const rail = r.css.indexOf('/* src/layouts/rail/rail.css */');
	const entry = r.css.indexOf('/* src/yeti.css */');
	assert.ok(layers > 0 && layers < rail && rail < entry);
	assert.ok(r.css.includes('@layer yeti.reset, yeti.base, yeti.theme, yeti.layouts, yeti.components, yeti.utilities;'));
	assert.ok(!r.css.includes('@import'));
});

test('build writes dist/ with the bundle, a verbatim css tree, js modules, and the merged manifest', () => {
	const root = makeTree(treeWithPkg({
		'src/layouts/rail/manifest.json': validManifest({ js: [{ module: 'rail.js', optional: true }] }),
		'src/layouts/rail/rail.js': 'document.title = "rail";\n',
		'src/tokens/.gitkeep': '',
	}));
	const r = build({ root });
	assert.deepEqual(r.errors, []);
	const dist = (p) => path.join(root, 'dist', p);
	assert.ok(fs.existsSync(dist('yeti.css')));
	assert.equal(fs.readFileSync(dist('css/layouts/rail/rail.css'), 'utf8'), fs.readFileSync(path.join(root, 'src/layouts/rail/rail.css'), 'utf8'));
	assert.equal(fs.readFileSync(dist('css/yeti.css'), 'utf8'), fs.readFileSync(path.join(root, 'src/yeti.css'), 'utf8'));
	assert.ok(!fs.existsSync(dist('css/tokens/.gitkeep')));
	assert.equal(fs.readFileSync(dist('js/rail.js'), 'utf8'), 'document.title = "rail";\n');
	// The one-file bundle carries each module in its own block and names it.
	assert.ok(fs.readFileSync(dist('yeti.js'), 'utf8').includes('// rail.js\n{\ndocument.title = "rail";\n}'));
	assert.ok(r.outputs.includes('yeti.js'));
	const manifest = JSON.parse(fs.readFileSync(dist('yeti.manifest.json'), 'utf8'));
	assert.equal(manifest.framework, 'yeti');
	assert.equal(manifest.version, '7.0.0-alpha.0');
	assert.match(manifest.generated, /^\d{4}-\d{2}-\d{2}$/);
	assert.equal(manifest.components.rail.class, 'rail');
	assert.ok(r.outputs.includes('yeti.css') && r.outputs.includes('js/rail.js') && r.outputs.includes('yeti.manifest.json'));
	assert.ok(r.outputs.includes('yeti.html-data.json') && r.outputs.includes('yeti.web-types.json'));
	assert.ok(r.outputs.includes('yeti.d.ts') && r.outputs.includes('yeti.manifest.d.ts') && r.outputs.includes('yeti.tokens.d.ts'));
	assert.ok(r.outputs.includes('llms.txt') && r.outputs.includes('llms-full.txt'));
	assert.equal(fs.readFileSync(dist('llms.txt'), 'utf8'), fs.readFileSync(path.join(root, 'docs', 'llms.txt'), 'utf8'));
	assert.equal(fs.readFileSync(dist('llms-full.txt'), 'utf8'), fs.readFileSync(path.join(root, 'docs', 'llms-full.txt'), 'utf8'));
	const html = JSON.parse(fs.readFileSync(dist('yeti.html-data.json'), 'utf8'));
	assert.ok(html.globalAttributes.some((a) => a.name === 'data-gap'));
});

test('build writes a minified stylesheet beside the readable one, with the modern syntax intact', () => {
	const root = makeTree(treeWithPkg({
		'src/layouts/rail/rail.css': '@layer yeti.layouts {\n\t.rail { display: flex; background: light-dark(#ffffff, #111111); }\n\t@starting-style {\n\t\t.rail { opacity: 0; }\n\t}\n}\n',
	}));
	const r = build({ root });
	assert.deepEqual(r.errors, []);
	const readable = fs.readFileSync(path.join(root, 'dist/yeti.css'), 'utf8');
	const minified = fs.readFileSync(path.join(root, 'dist/yeti.min.css'), 'utf8');
	assert.ok(minified.length < readable.length, `${minified.length} is not smaller than ${readable.length}`);
	// The banner is prepended after minifying, because lightningcss drops
	// comments, and a shipped file has to carry its licence.
	assert.ok(minified.startsWith('/*! @foundation/yeti 7.0.0-alpha.0 | FSL-1.1-MIT | https://foundationcss.com/yeti/ | for agents: https://cdn.jsdelivr.net/npm/@foundation/yeti@7.0.0-alpha.0/dist/llms.txt */\n'));
	// lightningcss folds the standalone @layer statement into the five layer
	// blocks it emits, which leaves the cascade order implicit; the statement
	// is put back so the minified file orders layers the same way the source
	// declares them, not by accident of emission.
	assert.ok(minified.includes(`${LAYER_STATEMENT}\n`), 'minified css is missing the standalone @layer statement');
	assert.ok(minified.includes('light-dark('));
	assert.ok(minified.includes('@starting-style'));
	assert.ok(r.outputs.includes('yeti.min.css'));
});

test('build writes a minified module bundle that still parses', () => {
	const root = makeTree(treeWithPkg({
		'src/layouts/rail/manifest.json': validManifest({ js: [{ module: 'rail.js', optional: true }] }),
		'src/layouts/rail/rail.js': '// Finds its own elements.\nconst home = "https://foundationcss.com/yeti/"; // not a comment above\ndocument.title = home;\n',
	}));
	const r = build({ root });
	assert.deepEqual(r.errors, []);
	const readable = fs.readFileSync(path.join(root, 'dist/yeti.js'), 'utf8');
	const minified = fs.readFileSync(path.join(root, 'dist/yeti.min.js'), 'utf8');
	assert.ok(minified.length < readable.length, `${minified.length} is not smaller than ${readable.length}`);
	// Both JS bundles carry the same licence banner the CSS files do, as their
	// first line; the minifier strips comments, so it is added back after.
	assert.equal(readable.split('\n')[0], '/*! @foundation/yeti 7.0.0-alpha.0 | FSL-1.1-MIT | https://foundationcss.com/yeti/ | for agents: https://cdn.jsdelivr.net/npm/@foundation/yeti@7.0.0-alpha.0/dist/llms.txt */');
	assert.equal(minified.split('\n')[0], '/*! @foundation/yeti 7.0.0-alpha.0 | FSL-1.1-MIT | https://foundationcss.com/yeti/ | for agents: https://cdn.jsdelivr.net/npm/@foundation/yeti@7.0.0-alpha.0/dist/llms.txt */');
	assert.ok(!minified.includes('Finds its own elements'));
	assert.ok(minified.includes('"https://foundationcss.com/yeti/"'));
	// The strip must not have broken the syntax; the modules import and export
	// nothing, so the bundle compiles as a plain script.
	assert.doesNotThrow(() => new vm.Script(minified));
	assert.ok(r.outputs.includes('yeti.min.js'));
	// The map beside it points at the readable bundle, and its first generated
	// line is the banner the minifier never saw, so the mappings start with an
	// empty line.
	assert.equal(minified.trimEnd().split('\n').at(-1), '//# sourceMappingURL=yeti.min.js.map');
	const map = JSON.parse(fs.readFileSync(path.join(root, 'dist/yeti.min.js.map'), 'utf8'));
	assert.equal(map.file, 'yeti.min.js');
	assert.deepEqual(map.sources, ['yeti.js']);
	assert.ok(map.mappings.startsWith(';'), 'the banner line is empty in the map');
	assert.ok(r.outputs.includes('yeti.min.js.map'));
});

test('a module the minifier cannot read stops the build before dist is touched', () => {
	const root = makeTree(treeWithPkg({
		'src/layouts/rail/manifest.json': validManifest({ js: [{ module: 'rail.js', optional: true }] }),
		'src/layouts/rail/rail.js': 'const broken = ;\n',
	}));
	fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
	fs.writeFileSync(path.join(root, 'dist', 'stale.txt'), 'old');
	const r = build({ root });
	assert.equal(r.errors.length, 1);
	assert.match(r.errors[0].message, /rail\.js/);
	assert.match(r.errors[0].message, /could not minify rail\.js: .*\d+:\d+/);
	// The pre-existing dist/ must be exactly as it was: the throw happens
	// before fs.rmSync wipes it, the same guard the CSS minifier already gets.
	assert.equal(fs.readFileSync(path.join(root, 'dist', 'stale.txt'), 'utf8'), 'old');
});

test('build refuses to run on validation errors and writes nothing', () => {
	const root = makeTree(treeWithPkg({ 'src/layouts/rail/example.html': '<div class="rail" data-gap="huge"><p>x</p></div>' }));
	const r = build({ root });
	assert.equal(r.errors.length, 1);
	assert.ok(!fs.existsSync(path.join(root, 'dist')));
});

test('build reports import errors', () => {
	const root = makeTree(treeWithPkg({ 'src/yeti.css': '@import "layers.css";\n@import "missing.css";\n' }));
	const r = build({ root });
	assert.equal(r.errors[0].message, 'imported file "missing.css" does not exist');
	assert.ok(!fs.existsSync(path.join(root, 'dist')));
});

test('a rebuild replaces a stale dist', () => {
	const root = makeTree(treeWithPkg());
	fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
	fs.writeFileSync(path.join(root, 'dist', 'stale.txt'), 'old');
	build({ root });
	assert.ok(!fs.existsSync(path.join(root, 'dist', 'stale.txt')));
});

test('build ships the tokens catalogue when present', () => {
	const root = makeTree(treeWithPkg({
		'schema/tokens.schema.json': fs.readFileSync(path.join(process.cwd(), 'schema/tokens.schema.json'), 'utf8'),
		'src/tokens/scale.css': '@layer yeti.base { :root { --yeti-base-min: 1rem; } }\n',
		'src/tokens/tokens.json': [{ name: '--yeti-base-min', group: 'scale', public: true, default: '1rem', description: 'x' }],
		'src/base/reset.css': '',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/scale.css";\n@import "base/reset.css";\n@import "layouts/rail/rail.css";\n',
	}));
	const r = build({ root });
	assert.deepEqual(r.errors, []);
	const shipped = JSON.parse(fs.readFileSync(path.join(root, 'dist/yeti.tokens.json'), 'utf8'));
	assert.equal(shipped.framework, 'yeti');
	assert.equal(shipped.tokens[0].name, '--yeti-base-min');
	assert.ok(r.outputs.includes('yeti.tokens.json'));
});

test('build copies themes to dist/themes', () => {
	const root = makeTree(treeWithPkg({ 'src/themes/round.css': ':root { --yeti-radius-md: 0; }\n' }));
	const r = build({ root });
	assert.deepEqual(r.errors, []);
	assert.equal(fs.readFileSync(path.join(root, 'dist/themes/round.css'), 'utf8'), ':root { --yeti-radius-md: 0; }\n');
	assert.ok(!fs.existsSync(path.join(root, 'dist/css/themes')));
});

test('build copies the starter to dist/starter and not into dist/css', () => {
	const root = makeTree(treeWithPkg({ 'src/starter/index.html': '<!doctype html>\n<title>x</title>\n', 'src/starter/theme.css': '/* :root { } */\n' }));
	const r = build({ root });
	assert.deepEqual(r.errors, []);
	assert.equal(fs.readFileSync(path.join(root, 'dist/starter/index.html'), 'utf8'), '<!doctype html>\n<title>x</title>\n');
	assert.equal(fs.readFileSync(path.join(root, 'dist/starter/theme.css'), 'utf8'), '/* :root { } */\n');
	assert.ok(r.outputs.includes('starter/index.html') && r.outputs.includes('starter/theme.css'));
	assert.ok(!fs.existsSync(path.join(root, 'dist/css/starter')));
});
