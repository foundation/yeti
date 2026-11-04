import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
	validate, formatError, validateElementTree, validateHtmlString, extractHtmlBlocks, findBareMargin, validateLayers, validateImportOrder, validateImportant, validateTokens,
	validateVocabulary, validateNoMediaQueries, validateDocsFragments, validateFields, validateThemes, validateMotion, validateAnchorsAndContainers, validateTokenReads, validateModules,
	SIZE_CONTAINERS,
} from '../../bin/validate.js';
import { walkFiles } from '../../bin/lib/files.js';

const walkSrcCss = (dir) => walkFiles(dir).filter((f) => f.endsWith('.css'));
import { parseHtml } from '../../bin/lib/html.js';
import { LAYER_STATEMENT } from '../../bin/lib/layers.js';
import { makeTree, validManifest, validTree, REPO_ROOT, TOKENS_SCHEMA_PATH, VOCABULARY_PATH } from './helpers.js';

const run = (files) => {
	const root = makeTree(files);
	const r = validate({ root });
	return { root, ...r, lines: r.errors.map((e) => formatError(root, e)) };
};
const example = (html) => validTree({ 'src/layouts/rail/example.html': html });

test('a valid tree validates with no errors and counts components', () => {
	const r = run(validTree());
	assert.deepEqual(r.lines, []);
	assert.equal(r.count, 1);
});

test('formatError prints file, optional line, and message relative to root', () => {
	assert.equal(formatError('/r', { file: '/r/src/a.css', line: 3, message: 'bad' }), 'src/a.css:3: bad');
	assert.equal(formatError('/r', { file: '/r/src/a.css', message: 'bad' }), 'src/a.css: bad');
});

test('unknown data attributes on a framework class are reported with the line', () => {
	const r = run(example('<div class="rail"\n  data-nope="1"><p>x</p></div>'));
	assert.deepEqual(r.lines, ['src/layouts/rail/example.html:1: .rail <div>: unknown attribute data-nope']);
});

test('enum, boolean, and number attribute values are checked', () => {
	const r = run(example('<div class="rail" data-gap="xl" data-wrap="yes" data-count="many"><p>x</p></div>'));
	assert.deepEqual(r.errors.map((e) => e.message), [
		'.rail <div>: data-gap="xl" is not one of s, m, l',
		'.rail <div>: data-wrap is a boolean attribute and takes no value',
		'.rail <div>: data-count="many" is not a number',
	]);
});

test('child minimums and maximums are enforced', () => {
	const tree = validTree({
		'src/layouts/rail/manifest.json': validManifest({ children: [{ selector: '> p', min: 1, max: 2 }] }),
	});
	const none = run({ ...tree, 'src/layouts/rail/example.html': '<div class="rail"><span>x</span></div>' });
	assert.deepEqual(none.errors.map((e) => e.message), ['.rail <div>: expected at least 1 of "> p", found 0']);
	const many = run({ ...tree, 'src/layouts/rail/example.html': '<div class="rail"><p>1</p><p>2</p><p>3</p></div>' });
	assert.deepEqual(many.errors.map((e) => e.message), ['.rail <div>: expected at most 2 of "> p", found 3']);
});

test('required accessibility attributes are enforced', () => {
	const r = run(validTree({
		'src/layouts/rail/manifest.json': validManifest({ a11y: { role: 'list', requiredAttributes: ['role'], keyboard: [] } }),
	}));
	assert.deepEqual(r.errors.map((e) => e.message), ['.rail <div>: missing required attribute role']);
});

test('user classes and non-data attributes are ignored', () => {
	const r = run(example('<div class="rail my-thing" id="x" aria-label="Rail" data-gap="s"><p>x</p></div>'));
	assert.deepEqual(r.lines, []);
});

test('an example that never uses its component is reported', () => {
	const r = run(example('<div class="other"><p>x</p></div>'));
	assert.deepEqual(r.errors.map((e) => e.message), ['example does not use .rail']);
});

test('elements without a framework class are never checked', () => {
	const errors = validateElementTree(parseHtml('<div data-anything="1"></div>'), { rail: validManifest() }, 'f.html');
	assert.deepEqual(errors, []);
});

test('validateHtmlString passes markup that obeys the manifest', () => {
	const errors = validateHtmlString('<div class="rail" data-gap="l"><p>One</p><p>Two</p></div>', { rail: validManifest() }, 'page.html');
	assert.deepEqual(errors, []);
});

test('validateHtmlString reports a value outside its attribute\'s list, with the file it came from', () => {
	const errors = validateHtmlString('<div class="rail" data-gap="enormous"><p>One</p><p>Two</p></div>', { rail: validManifest() }, 'page.html');
	assert.equal(errors.length, 1);
	assert.equal(errors[0].file, 'page.html');
	assert.match(errors[0].message, /data-gap="enormous"/);
});

test('extractHtmlBlocks returns each fenced html block with its starting line', () => {
	const md = '# Guide\n\n```html\n<div class="rail"><p>x</p></div>\n```\n\ntext\n\n```css\n.x{}\n```\n\n```html\n<b>y</b>\n```\n';
	assert.deepEqual(extractHtmlBlocks(md), [
		{ html: '<div class="rail"><p>x</p></div>', line: 4 },
		{ html: '<b>y</b>', line: 14 },
	]);
});

test('fenced html blocks in src/guides are validated with the right line', () => {
	const r = run(validTree({
		'src/guides/layouts.md': '# Layouts\n\n```html\n<div class="rail" data-gap="huge"><p>x</p></div>\n```\n',
	}));
	assert.deepEqual(r.lines, ['src/guides/layouts.md:4: .rail <div>: data-gap="huge" is not one of s, m, l']);
});

test('a fenced html demo block in a guide source is linted like any other html block', () => {
	const r = run(validTree({
		'src/guides/layouts.md': '# Layouts\n\n```html demo md lg\n<div class="rail" data-gap="huge"><p>x</p></div>\n```\n',
	}));
	assert.deepEqual(r.lines, ['src/guides/layouts.md:4: .rail <div>: data-gap="huge" is not one of s, m, l']);
});

test('findBareMargin flags margin on the bare identity selector only', () => {
	assert.deepEqual(findBareMargin('.rail { margin: 0; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin('@layer yeti.layouts {\n  .rail {\n    display: flex;\n    margin-block-end: 1rem;\n  }\n}', 'rail'), [2]);
	assert.deepEqual(findBareMargin('.rail > * + * { margin-inline-start: 1rem; }', 'rail'), []);
	assert.deepEqual(findBareMargin('.rail {\n  display: flex;\n  & > * + * { margin-block-start: 1rem; }\n}', 'rail'), []);
	assert.deepEqual(findBareMargin('.rail { /* margin: 0; */ padding: 0; }', 'rail'), []);
	assert.deepEqual(findBareMargin('.rail-item { margin: 0; }\n.rail { padding: 0; }', 'rail'), []);
	assert.deepEqual(findBareMargin('.rail, .pill { margin: 0; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin('.pill,\n.rail {\n  margin: 0;\n}', 'rail'), [1]);
	assert.deepEqual(findBareMargin('.rail\n{ margin: 0; }', 'rail'), [1]);
});

test('findBareMargin ignores the word margin inside string values', () => {
	assert.deepEqual(findBareMargin('.rail { content: "set margin: 1px here"; }', 'rail'), []);
	assert.deepEqual(findBareMargin(".rail { content: 'margin: 0'; margin: 0; }", 'rail'), [1]);
});

test('validateLayers tolerates a leading @charset in yeti.css', () => {
	const r = run(validTree({ 'src/yeti.css': '@charset "UTF-8";\n@import "layers.css";\n' }));
	assert.deepEqual(r.lines, []);
});

test('a component setting its own margin fails the spacing rule', () => {
	const r = run(validTree({ 'src/layouts/rail/rail.css': '.rail {\n  margin-block-end: 1rem;\n}\n' }));
	assert.deepEqual(r.lines, ['src/layouts/rail/rail.css:1: .rail sets its own margin; spacing belongs to the parent layout (architecture §6.6)']);
});

test('the layer statement must match exactly and yeti.css must import it first', () => {
	const wrongOrder = run(validTree({ 'src/layers.css': '@layer yeti.base, yeti.reset, yeti.layouts, yeti.components, yeti.utilities;\n' }));
	assert.equal(wrongOrder.lines.length, 1);
	assert.match(wrongOrder.lines[0], /^src\/layers\.css:1: must contain exactly: @layer yeti\.reset/);
	const noImport = run(validTree({ 'src/yeti.css': '.x {}\n' }));
	assert.deepEqual(noImport.lines, ['src/yeti.css:1: must begin with @import "layers.css";']);
	const commented = run(validTree({ 'src/layers.css': '/* order */\n@layer yeti.reset,\n  yeti.base, yeti.theme, yeti.layouts, yeti.components, yeti.utilities;\n' }));
	assert.deepEqual(commented.lines, []);
});

test('the real src/ passes the layer check', () => {
	assert.deepEqual(validateLayers(path.join(REPO_ROOT, 'src')), []);
});

test('validateImportOrder requires layers, then tokens, then reset, then base', () => {
	const tokensTree = (yetiCss) => validTree({
		'src/tokens/scale.css': ':root { --yeti-base-min: 1rem; }\n',
		'src/tokens/color.css': ':root { --yeti-hue-primary: 250; }\n',
		'src/base/reset.css': '',
		'src/base/typography.css': '',
		'src/yeti.css': yetiCss,
	});
	const ok = run(tokensTree('@import "layers.css";\n@import "tokens/color.css";\n@import "tokens/scale.css";\n@import "base/reset.css";\n@import "base/typography.css";\n@import "layouts/rail/rail.css";\n'));
	assert.deepEqual(ok.lines, []);
	const resetFirst = run(tokensTree('@import "layers.css";\n@import "base/reset.css";\n@import "tokens/scale.css";\n@import "tokens/color.css";\n@import "base/typography.css";\n@import "layouts/rail/rail.css";\n'));
	assert.deepEqual(resetFirst.lines, ['src/yeti.css:2: imports must come in the order layers.css, tokens/*, base/reset.css, base/*, layouts/attributes.css, layouts/*, recipes/*, components/*, then everything else (found "base/reset.css" before all of tokens/)']);
	const missingToken = run(tokensTree('@import "layers.css";\n@import "tokens/scale.css";\n@import "base/reset.css";\n@import "base/typography.css";\n@import "layouts/rail/rail.css";\n'));
	assert.deepEqual(missingToken.lines, ['src/yeti.css: tokens/color.css is not imported']);
});

test('validateImportOrder treats a leading ./ as equivalent', () => {
	const tree = validTree({
		'src/tokens/scale.css': ':root { --yeti-base-min: 1rem; }\n',
		'src/base/reset.css': '',
		'src/yeti.css': '@import "layers.css";\n@import "./tokens/scale.css";\n@import "./base/reset.css";\n@import "layouts/rail/rail.css";\n',
	});
	assert.deepEqual(run(tree).lines, []);
});

test('validateImportOrder is silent when src/tokens does not exist', () => {
	assert.deepEqual(run(validTree()).lines, []);
});

test('validateImportant allows only the [hidden] rule in the reset and reduced-motion tokens', () => {
	const hidden = run(validTree({ 'src/base/reset.css': '@layer yeti.reset {\n\t[hidden] { display: none !important; }\n}\n' }));
	assert.deepEqual(hidden.lines, []);
	const elsewhere = run(validTree({ 'src/layouts/rail/rail.css': '.rail { display: flex !important; }\n' }));
	assert.deepEqual(elsewhere.lines, ['src/layouts/rail/rail.css:1: !important is not allowed (only the [hidden] rule in base/reset.css and the reduced-motion tokens may use it)']);
	const wrongRule = run(validTree({ 'src/base/reset.css': 'img { display: block !important; }\n' }));
	assert.deepEqual(wrongRule.lines, ['src/base/reset.css:1: !important is not allowed (only the [hidden] rule in base/reset.css and the reduced-motion tokens may use it)']);
	const motion = '@media (prefers-reduced-motion: reduce) {\n\t* { --yeti-duration-fast: 0.01ms !important; }\n}\n';
	assert.deepEqual(run(validTree({ 'src/tokens/rail.css': motion })).lines.filter((l) => l.includes('!important')), []);
	assert.equal(run(validTree({ 'src/layouts/rail/rail.css': motion })).lines.filter((l) => l.includes('!important')).length, 1);
	assert.equal(run(validTree({ 'src/tokens/rail.css': '@media print {\n\t* { --yeti-duration-fast: 0.01ms !important; }\n}\n' })).lines.filter((l) => l.includes('!important')).length, 1);
	assert.equal(run(validTree({ 'src/tokens/rail.css': '@media (prefers-reduced-motion: reduce) {\n\t* { color: red !important; }\n}\n' })).lines.filter((l) => l.includes('!important')).length, 1);
	const inString = run(validTree({ 'src/layouts/rail/rail.css': '.rail::after { content: "!important"; }\n' }));
	assert.deepEqual(inString.lines, []);
});

const catalogueTree = (extra = {}) => validTree({
	'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
	'src/tokens/scale.css': '@layer yeti.base {\n\t:root {\n\t\t--yeti-base-min: var(--yeti-base, 1rem);\n\t\t--_yeti-t: 0;\n\t}\n}\n',
	'src/tokens/tokens.json': [
		{ name: '--yeti-base-min', group: 'scale', public: true, default: '1rem', description: 'Body size at the narrow viewport.' },
		{ name: '--yeti-base', group: 'scale', public: true, declared: false, default: 'unset', description: 'Set to pin both ends.' },
	],
	'src/base/reset.css': '',
	'src/yeti.css': '@import "layers.css";\n@import "tokens/scale.css";\n@import "base/reset.css";\n@import "layouts/rail/rail.css";\n',
	...extra,
});

test('validateTokens passes when the catalogue and the CSS agree', () => {
	assert.deepEqual(run(catalogueTree()).lines, []);
});

test('validateTokens reports drift in both directions and misdeclared override-only inputs', () => {
	const undocumented = run(catalogueTree({ 'src/tokens/scale.css': '@layer yeti.base { :root { --yeti-base-min: 1rem; --yeti-extra: 1; } }\n' }));
	assert.deepEqual(undocumented.lines, ['src/tokens/scale.css: --yeti-extra is declared but not in tokens.json']);
	const phantom = run(catalogueTree({ 'src/tokens/tokens.json': [
		{ name: '--yeti-base-min', group: 'scale', public: true, default: '1rem', description: 'x' },
		{ name: '--yeti-base', group: 'scale', public: true, declared: false, default: 'unset', description: 'x' },
		{ name: '--yeti-ghost', group: 'scale', public: true, default: '0', description: 'x' },
	] }));
	assert.deepEqual(phantom.lines, ['src/tokens/tokens.json: --yeti-ghost is in the catalogue but not declared in src/tokens/*.css']);
	const declaredAnyway = run(catalogueTree({ 'src/tokens/scale.css': '@layer yeti.base { :root { --yeti-base-min: 1rem; --yeti-base: 1rem; } }\n' }));
	assert.deepEqual(declaredAnyway.lines, ['src/tokens/tokens.json: --yeti-base is marked declared: false but src/tokens/*.css declares it']);
});

test('validateTokens is silent without a catalogue', () => {
	assert.deepEqual(run(validTree()).lines, []);
});

test('validateImportOrder requires every src/base/*.css file to be imported', () => {
	const r = run(catalogueTree({ 'src/base/extra.css': '' }));
	assert.deepEqual(r.lines, ['src/yeti.css: base/extra.css is not imported']);
});

test('validateTokens rejects a component named "tokens"', () => {
	const r = run(catalogueTree({
		'src/components/tokens/manifest.json': validManifest({
			name: 'tokens', kind: 'component', class: 'tokens', children: [], tokens: [],
		}),
		'src/components/tokens/tokens.css': '@layer yeti.components {\n\t.tokens { display: block; }\n}\n',
		'src/components/tokens/example.html': '<div class="tokens"></div>\n',
		'src/components/tokens/docs.md': '## When to use it\n\nx.\n\n## How it works\n\nx.\n\n## Accessibility\n\nx.\n',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/scale.css";\n@import "base/reset.css";\n@import "layouts/rail/rail.css";\n@import "components/tokens/tokens.css";\n',
	}));
	assert.deepEqual(r.lines, [
		'src/components/tokens/manifest.json: a component cannot be named "tokens"; docs/tokens.md is the generated token reference',
	]);
});

test('validateTokens flags a public token declared outside src/tokens/', () => {
	const r = run(catalogueTree({
		'src/layouts/rail/rail.css': '@layer yeti.layouts { .rail { --yeti-rail-gap: 1rem; display: flex; } }\n',
	}));
	assert.deepEqual(r.lines, [
		'src/layouts/rail/rail.css: --yeti-rail-gap is a public token declared outside src/tokens/; public tokens live in src/tokens/ and the catalogue',
	]);
});

// The mapped attributes and the private property each one sets. The VALUES
// come from the real vocabulary, so adding a stop to a list never breaks this
// fixture again; only a genuinely new attribute needs a line here.
const VOCAB = JSON.parse(fs.readFileSync(VOCABULARY_PATH, 'utf8'));
const MAPPINGS = [
	['data-gap', 'gap', '--_yeti-gap', () => '0'],
	['data-align', 'align', '--_yeti-align', (v) => v],
	['data-justify', 'justify', '--_yeti-justify', (v) => v],
	['data-threshold', 'width', '--_yeti-threshold', () => '0'],
	['data-width', 'width', '--_yeti-width', () => '0'],
	['data-max', 'width', '--_yeti-max', () => '0'],
	['data-height', 'height', '--_yeti-height', () => '0'],
	['data-min', 'width-or-none', '--_yeti-min', () => '0'],
	['data-ratio', 'ratio', '--_yeti-aspect', (v) => v],
	['data-columns', 'columns', '--_yeti-column-cap', () => '0'],
	['data-align-self', 'align', '--_yeti-align-self', (v) => v],
	['data-justify-self', 'self', '--_yeti-justify-self', (v) => v],
	['data-variant', 'variant', '--_yeti-variant', () => '0'],
	['data-size', 'size-control', '--_yeti-size-text', () => '0'],
	['data-span', 'span', '--_yeti-span', (v) => v],
	['data-rows', 'rows', '--_yeti-rows', (v) => v],
	['data-tracks', 'tracks', '--_yeti-tracks', (v) => v],
	['data-start', 'start', '--_yeti-start', (v) => v],
	['data-slides', 'slides', '--_yeti-slides', (v) => v],
	['data-show', 'width', '--_yeti-show', (v) => v],
	['data-hide', 'width', '--_yeti-hide', (v) => v],
	['data-paint', 'paint', 'background-color', () => 'red'],
	['data-text', 'paint', 'color', () => 'red'],
	['data-gap-inline', 'gap', '--_yeti-gap-inline', () => '0'],
	['data-gap-block', 'gap', '--_yeti-gap-block', () => '0'],
	['data-space', 'gap', '--_yeti-space', () => '0'],
];

const layoutTree = (extra = {}) => validTree({
	'schema/vocabulary.json': fs.readFileSync(VOCABULARY_PATH, 'utf8'),
	'src/layouts/attributes.css': '@layer yeti.layouts {\n'
		+ MAPPINGS.map(([attr, vocab, prop, value]) => VOCAB[vocab].map((v) => `\t[${attr}="${v}"] { ${prop}: ${value(v)}; }\n`).join('')).join('')
		+ '}\n',
	'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n',
	...extra,
});

test('a complete layout tree validates', () => {
	assert.deepEqual(run(layoutTree()).lines, []);
});

test('validateVocabulary reports a mapped value with no attributes.css rule', () => {
	const tree = layoutTree();
	tree['src/layouts/attributes.css'] = tree['src/layouts/attributes.css'].replace('\t[data-gap="lg"] { --_yeti-gap: 0; }\n', '');
	assert.deepEqual(run(tree).lines, ['src/layouts/attributes.css: data-gap="lg" (vocabulary gap) has no rule']);
});

test('validateVocabulary cross-checks manifest attributes against MAPPED', () => {
	const r = run(layoutTree({
		'src/layouts/rail/manifest.json': validManifest({
			attributes: [
				{ name: 'data-gap', type: 'enum', values: ['s', 'm', 'l'], default: 'm', description: 'Gap between items.' },
				{ name: 'data-tone', type: 'enum', vocabulary: 'align', description: 'x' },
			],
		}),
	}));
	assert.deepEqual(r.lines, [
		'src/layouts/rail/manifest.json: attribute data-tone references vocabulary "align" but validate does not check it; add it to MAPPED or READ_DIRECTLY in bin/validate.js',
	]);
});

const gridTree = (example) => layoutTree({
	'src/layouts/rail/manifest.json': null,
	'src/layouts/rail/rail.css': null,
	'src/layouts/rail/example.html': null,
	'src/layouts/rail/docs.md': null,
	'src/layouts/grid/manifest.json': validManifest({
		name: 'grid',
		class: 'grid',
		attributes: [
			{ name: 'data-fold', type: 'boolean', description: 'Fold into a single column below the threshold.' },
			{ name: 'data-columns', type: 'enum', vocabulary: 'columns', description: 'Maximum column count.' },
			{ name: 'data-tracks', type: 'enum', vocabulary: 'tracks', description: 'Fixed tracks.' },
			{ name: 'data-threshold', type: 'enum', vocabulary: 'width', description: 'One column below this.' },
		],
		markers: [
			{ name: 'data-start', type: 'enum', vocabulary: 'start', on: '> *', description: 'Start line.' },
			{ name: 'data-span', type: 'enum', vocabulary: 'span', on: '> *', description: 'Tracks covered.' },
		],
	}),
	'src/layouts/grid/grid.css': '@layer yeti.layouts {\n\t.grid { display: grid; }\n}\n',
	'src/layouts/grid/example.html': example,
	'src/layouts/grid/docs.md': '## Why this name\n\nBecause.\n',
	'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "layouts/grid/grid.css";\n',
});

test('a .grid with data-fold requires data-columns to be 2, 4, or 6', () => {
	const bad = run(gridTree('<div class="grid" data-fold data-columns="3"><p>a</p><p>b</p></div>\n'));
	assert.deepEqual(bad.lines, ['src/layouts/grid/example.html:1: .grid <div>: data-fold needs data-columns 2, 4, or 6']);
	const ok = run(gridTree('<div class="grid" data-fold data-columns="4"><p>a</p><p>b</p></div>\n'));
	assert.deepEqual(ok.lines, []);
});

test('a tracks grid child must start on one of its tracks and end inside the grid', () => {
	const bad = run(gridTree('<div class="grid" data-tracks="4">\n<p data-start="6">a</p>\n<p data-start="3" data-span="4">b</p>\n<p data-start="4">c</p>\n</div>\n'));
	assert.deepEqual(bad.lines, [
		'src/layouts/grid/example.html:2: .grid <div>: data-start="6" on <p> is past the last of 4 tracks',
		'src/layouts/grid/example.html:3: .grid <div>: data-start="3" data-span="4" on <p> runs to track 6 of 4',
	]);
	const ok = run(gridTree('<div class="grid" data-tracks="12"><p data-start="2" data-span="6">a</p><p data-start="9" data-span="4">b</p><p data-span="12">c</p><p>d</p></div>\n'));
	assert.deepEqual(ok.lines, []);
});

test('data-tracks and data-fold on one grid is an error', () => {
	const bad = run(gridTree('<div class="grid" data-tracks="12" data-fold data-columns="4"><p>a</p><p>b</p></div>\n'));
	assert.deepEqual(bad.lines, ['src/layouts/grid/example.html:1: .grid <div>: data-tracks and data-fold do not mix; a tracks grid places its children itself']);
});

test('a child marker such as data-split is legal on any element, including a nested layout', () => {
	const tree = layoutTree({
		'src/layouts/rail/manifest.json': validManifest({
			children: [
				{ selector: '> *', min: 1, max: null, description: 'The items.' },
				{ selector: '> [data-split]', min: 0, max: 1, description: 'x' },
			],
		}),
	});
	const ok = run({ ...tree, 'src/layouts/rail/example.html': '<div class="rail"><div class="rail" data-split><p>x</p></div></div>\n' });
	assert.deepEqual(ok.lines, []);
	const bad = run({ ...tree, 'src/layouts/rail/example.html': '<div class="rail"><div class="rail" data-bogus><p>x</p></div></div>\n' });
	assert.deepEqual(bad.errors.map((e) => e.message), ['.rail <div>: unknown attribute data-bogus']);
});

test('media queries are banned in layouts', () => {
	const r = run(layoutTree({ 'src/layouts/rail/rail.css': '@layer yeti.layouts { .rail { display: flex; } @media (width > 40rem) { .rail { gap: 1rem; } } }\n' }));
	assert.deepEqual(r.lines, ['src/layouts/rail/rail.css:1: layouts are intrinsic; use container-relative techniques, not media queries']);
});

test('every layout docs.md must carry the naming heading', () => {
	const missing = run(layoutTree({ 'src/layouts/rail/docs.md': '# Rail\n\nProse.\n' }));
	assert.deepEqual(missing.lines, ['src/layouts/rail/docs.md: layouts must explain their name under a "## Why this name" heading']);
	const absent = run(layoutTree({ 'src/layouts/rail/docs.md': null }));
	assert.deepEqual(absent.lines, ['src/layouts/rail: layouts must have a docs.md with a "## Why this name" heading']);
});

test('fenced html in docs.md is validated against the manifest', () => {
	const r = run(layoutTree({ 'src/layouts/rail/docs.md': '## Why this name\n\nBecause.\n\n```html\n<div class="rail" data-gap="huge"><p>x</p></div>\n```\n' }));
	assert.deepEqual(r.lines, ['src/layouts/rail/docs.md:6: .rail <div>: data-gap="huge" is not one of s, m, l']);
});

test('import order places layouts/attributes.css after base and before layout folders, and requires every layout file', () => {
	const late = run(layoutTree({ 'src/yeti.css': '@import "layers.css";\n@import "layouts/rail/rail.css";\n@import "layouts/attributes.css";\n' }));
	assert.deepEqual(late.lines, ['src/yeti.css:2: imports must come in the order layers.css, tokens/*, base/reset.css, base/*, layouts/attributes.css, layouts/*, recipes/*, components/*, then everything else (found "layouts/rail/rail.css" before all of layouts/attributes.css)']);
	const missing = run(layoutTree({ 'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n' }));
	assert.deepEqual(missing.lines, ['src/yeti.css: layouts/rail/rail.css is not imported']);
});

test('findBareMargin ignores auto-only margins', () => {
	assert.deepEqual(findBareMargin('.center { margin-inline: auto; }', 'center'), []);
	assert.deepEqual(findBareMargin('.center { margin: 0 auto; }', 'center'), [1]);
});

const recipeTree = (extra = {}) => layoutTree({
	'src/recipes/duo/manifest.json': validManifest({ name: 'duo', kind: 'recipe', class: 'duo', attributes: [{ name: 'data-gap', type: 'enum', vocabulary: 'gap', default: 'md', description: 'Gap.' }] }),
	'src/recipes/duo/duo.css': '@layer yeti.layouts {\n\t.duo { display: flex; }\n\t.duo > * { margin: 0; }\n}\n',
	'src/recipes/duo/example.html': '<div class="duo"><p>One</p><p>Two</p></div>\n',
	'src/recipes/duo/docs.md': '## When to use it\n\nPairs.\n\n## Built from primitives\n\n```html\n<div class="rail" data-gap="m"><p>One</p><p>Two</p></div>\n```\n\n## Why this name\n\nTwo.\n',
	'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "recipes/duo/duo.css";\n',
	...extra,
});

test('a recipe validates and counts as a component', () => {
	const r = run(recipeTree());
	assert.deepEqual(r.lines, []);
	assert.equal(r.count, 2);
});

test('a recipe example wrapped in a literal body still validates', () => {
	const r = run(recipeTree({ 'src/recipes/duo/example.html': '<body class="duo"><p>One</p><p>Two</p></body>\n' }));
	assert.deepEqual(r.lines, []);
});

test('recipes import after layouts and every recipe file must be imported', () => {
	const early = run(recipeTree({ 'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "recipes/duo/duo.css";\n@import "layouts/rail/rail.css";\n' }));
	assert.deepEqual(early.lines, ['src/yeti.css:3: imports must come in the order layers.css, tokens/*, base/reset.css, base/*, layouts/attributes.css, layouts/*, recipes/*, components/*, then everything else (found "recipes/duo/duo.css" before all of layouts/)']);
	const missing = run(recipeTree({ 'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n' }));
	assert.deepEqual(missing.lines, ['src/yeti.css: recipes/duo/duo.css is not imported']);
});

test('media queries are banned in recipes too', () => {
	const r = run(recipeTree({ 'src/recipes/duo/duo.css': '@layer yeti.layouts {\n\t.duo { display: flex; }\n\t@media (width > 40rem) { .duo { gap: 1rem; } }\n}\n' }));
	assert.deepEqual(r.lines, ['src/recipes/duo/duo.css:3: layouts are intrinsic; use container-relative techniques, not media queries']);
});

test('a recipe docs.md must show the composed form without the recipe class', () => {
	const noSection = run(recipeTree({ 'src/recipes/duo/docs.md': '## When to use it\n\nPairs.\n\n## Why this name\n\nTwo.\n' }));
	assert.deepEqual(noSection.lines, ['src/recipes/duo/docs.md: recipes must show the same result built from primitives under a "## Built from primitives" heading with a fenced html block']);
	const noSnippet = run(recipeTree({ 'src/recipes/duo/docs.md': '## When to use it\n\nPairs.\n\n## Built from primitives\n\nJust prose.\n\n## Why this name\n\nTwo.\n' }));
	assert.deepEqual(noSnippet.lines, ['src/recipes/duo/docs.md: recipes must show the same result built from primitives under a "## Built from primitives" heading with a fenced html block']);
	const ownClass = run(recipeTree({ 'src/recipes/duo/docs.md': '## When to use it\n\nPairs.\n\n## Built from primitives\n\n```html\n<div class="duo"><p>One</p><p>Two</p></div>\n```\n\n## Why this name\n\nTwo.\n' }));
	assert.deepEqual(ownClass.lines, ['src/recipes/duo/docs.md:8: the composed form must not use the recipe\'s own class .duo']);
	const noName = run(recipeTree({ 'src/recipes/duo/docs.md': '## When to use it\n\nPairs.\n\n## Built from primitives\n\n```html\n<div class="rail" data-gap="m"><p>One</p><p>Two</p></div>\n```\n' }));
	assert.deepEqual(noName.lines, ['src/recipes/duo/docs.md: layouts must explain their name under a "## Why this name" heading']);
});

test('a recipe with no docs.md at all is reported with the recipe kind, not the layout kind', () => {
	const absent = run(recipeTree({ 'src/recipes/duo/docs.md': null }));
	assert.deepEqual(absent.lines, ['src/recipes/duo: recipes must have a docs.md with a "## Why this name" heading']);
});

// The brief derives this tree's attributes.css by splicing variant/size rules into
// layoutTree()'s via `.replace('}\n', ...)`, but that string occurs after every single
// rule line above (each ends in "}\n"), not just the final one, so a plain (non-global)
// replace lands on the first rule instead of the closing brace and corrupts the file.
// layoutTree() itself now ends its attributes.css with the variant/size rules (needed by
// every other test using it too, once MAPPED below covers data-variant/data-size), so no
// splice is needed here at all.
const componentTree = (extra = {}) => layoutTree({
	'src/components/tag/manifest.json': validManifest({ name: 'tag', kind: 'component', class: 'tag', attributes: [{ name: 'data-variant', type: 'enum', vocabulary: 'variant', default: 'primary', description: 'Colour.' }], children: [] }),
	'src/components/tag/tag.css': '@layer yeti.components {\n\t.tag { display: inline-flex; }\n}\n',
	'src/components/tag/example.html': '<span class="tag" data-variant="success">New</span>\n',
	'src/components/tag/docs.md': '## When to use it\n\nLabels.\n\n## How it works\n\nA box.\n\n## Accessibility\n\nText carries the meaning.\n',
	'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "components/tag/tag.css";\n',
	...extra,
});

test('a component validates and counts', () => {
	const r = run(componentTree());
	assert.deepEqual(r.lines, []);
	assert.equal(r.count, 2);
});

const utilityTree = (extra = {}) => componentTree({
	'src/utilities/flare/manifest.json': validManifest({ name: 'flare', kind: 'utility', class: 'flare', attributes: [{ name: 'data-flare', type: 'enum', values: ['soft', 'hard'], default: 'soft', description: 'How bright.' }], children: [] }),
	'src/utilities/flare/flare.css': '@layer yeti.utilities {\n\t.flare { opacity: 1; }\n}\n',
	'src/utilities/flare/example.html': '<span class="flare" data-flare="hard">Bright</span>\n',
	'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "components/tag/tag.css";\n@import "utilities/flare/flare.css";\n',
	...extra,
});

test('a utility validates and counts', () => {
	const r = run(utilityTree());
	assert.deepEqual(r.lines, []);
	assert.equal(r.count, 3);
});

test('an element carrying two identity classes may use either one\'s attributes', () => {
	const both = run(utilityTree({ 'src/components/tag/example.html': '<span class="tag flare" data-variant="success" data-flare="hard">New</span>\n' }));
	assert.deepEqual(both.lines, []);
});

test('an attribute no identity class on the element declares is still unknown to each of them', () => {
	const r = run(utilityTree({ 'src/components/tag/example.html': '<span class="tag flare" data-glow>New</span>\n' }));
	assert.deepEqual(r.errors.map((e) => e.message), [
		'.tag <span>: unknown attribute data-glow',
		'.flare <span>: unknown attribute data-glow',
	]);
});

test('a value is still checked against the identity class that declares it, whatever else the element carries', () => {
	const r = run(utilityTree({ 'src/components/tag/example.html': '<span class="tag flare" data-flare="blinding">New</span>\n' }));
	assert.deepEqual(r.errors.map((e) => e.message), ['.flare <span>: data-flare="blinding" is not one of soft, hard']);
});

test('components import after recipes and every component file must be imported', () => {
	const early = run(componentTree({ 'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "components/tag/tag.css";\n@import "layouts/rail/rail.css";\n' }));
	assert.deepEqual(early.lines, ['src/yeti.css:3: imports must come in the order layers.css, tokens/*, base/reset.css, base/*, layouts/attributes.css, layouts/*, recipes/*, components/*, then everything else (found "components/tag/tag.css" before all of layouts/)']);
	const missing = run(componentTree({ 'src/yeti.css': '@import "layers.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n' }));
	assert.deepEqual(missing.lines, ['src/yeti.css: components/tag/tag.css is not imported']);
});

test('media queries are banned in components', () => {
	const r = run(componentTree({ 'src/components/tag/tag.css': '@layer yeti.components {\n\t.tag { display: inline-flex; }\n\t@media (width > 40rem) { .tag { gap: 1rem; } }\n}\n' }));
	assert.deepEqual(r.lines, ['src/components/tag/tag.css:3: layouts are intrinsic; use container-relative techniques, not media queries']);
});

test('a component docs.md must carry the accessibility heading and needs no naming heading', () => {
	const r = run(componentTree({ 'src/components/tag/docs.md': '## When to use it\n\nLabels.\n\n## How it works\n\nA box.\n' }));
	assert.deepEqual(r.lines, ['src/components/tag/docs.md: components must document accessibility under a "## Accessibility" heading']);
});

test('validateFields requires a label for its control', () => {
	// Adapted from the brief: the manifest's class must equal its name ("tag", matching the
	// folder), so the fictional field markup also carries the .tag identity class the manifest
	// declares (validateExamples' "example uses its class" check would otherwise fail); the
	// class="tag" addition is inert for validateFields, which only looks for .field.
	const field = (html) => componentTree({
		'src/components/tag/manifest.json': validManifest({ name: 'tag', kind: 'component', class: 'tag', attributes: [], children: [] }),
		'src/components/tag/example.html': html,
	});
	assert.deepEqual(run(field('<div class="field tag"><label for="a">A</label><input id="a"></div>\n')).lines, []);
	assert.deepEqual(run(field('<div class="field tag"><label>A</label><input id="a"></div>\n')).lines, ['src/components/tag/example.html:1: .field: the label must reference the control with for, and the control must carry that id']);
	assert.deepEqual(run(field('<div class="field tag"><label for="a">A</label><input id="b"></div>\n')).lines, ['src/components/tag/example.html:1: .field: the label must reference the control with for, and the control must carry that id']);
	assert.deepEqual(run(field('<fieldset class="field tag"><legend>Pick</legend><input id="a" type="radio"></fieldset>\n')).lines, []);
	assert.deepEqual(run(field('<div class="field tag"><label for="a">A</label><div class="affix"><span>$</span><input id="a"></div></div>\n')).lines, []);
});

test('validateFields also walks fixtures under test/browser/fixtures', () => {
	const r = run(componentTree({
		'test/browser/fixtures/components/x.html': '<!doctype html>\n<html>\n<body>\n<div class="field"><label for="a">A</label><input id="b"></div>\n</body>\n</html>\n',
	}));
	assert.deepEqual(r.lines, ['test/browser/fixtures/components/x.html:4: .field: the label must reference the control with for, and the control must carry that id']);
});

test('validateFields is silent when test/browser/fixtures does not exist', () => {
	assert.deepEqual(run(componentTree()).lines, []);
});

test('validateThemes accepts token-only themes and rejects anything else', () => {
	const tree = (theme) => componentTree({
		'src/tokens/tokens.json': [{ name: '--yeti-radius-md', group: 'radius', public: true, default: '0.5rem', description: 'x' }, { name: '--yeti-button-radius', group: 'button', public: true, default: 'x', description: 'x' }],
		'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
		'src/tokens/radius.css': '@layer yeti.base { :root { --yeti-radius-md: 0.5rem; --yeti-button-radius: var(--yeti-radius-md); } }\n',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/radius.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "components/tag/tag.css";\n',
		'src/themes/round.css': theme,
	});
	assert.deepEqual(run(tree(':root {\n\t--yeti-button-radius: 999px;\n}\n@media (prefers-color-scheme: dark) {\n\t:root { --yeti-radius-md: 0; }\n}\n')).lines, []);
	assert.deepEqual(run(tree(':root { --yeti-button-radius: 999px; }\n.button { color: red; }\n')).lines, ['src/themes/round.css:2: themes may only set --yeti-* tokens on :root (found ".button")']);
	assert.deepEqual(run(tree(':root { --yeti-nope: 1; color: red; }\n')).lines, [
		'src/themes/round.css:1: theme sets "--yeti-nope", which is not a public token',
		'src/themes/round.css:1: themes may only set --yeti-* tokens (found "color")',
	]);
});

test('validateThemes ignores semicolons and colons inside url() and quoted values', () => {
	const tree = (theme) => componentTree({
		'src/tokens/tokens.json': [{ name: '--yeti-radius-md', group: 'radius', public: true, default: '0.5rem', description: 'x' }, { name: '--yeti-button-radius', group: 'button', public: true, default: 'x', description: 'x' }],
		'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
		'src/tokens/radius.css': '@layer yeti.base { :root { --yeti-radius-md: 0.5rem; --yeti-button-radius: var(--yeti-radius-md); } }\n',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/radius.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "components/tag/tag.css";\n',
		'src/themes/round.css': theme,
	});
	assert.deepEqual(run(tree(':root { --yeti-button-radius: url("data:image/svg+xml;charset=utf8,%3Csvg%3E"); }\n')).lines, []);
	assert.deepEqual(run(tree(':root { --yeti-button-radius: 1px; color: red; }\n')).lines, ['src/themes/round.css:1: themes may only set --yeti-* tokens (found "color")']);
});

test('validateThemes rejects a bare at-rule statement with no block', () => {
	const tree = (theme) => componentTree({
		'src/tokens/tokens.json': [{ name: '--yeti-radius-md', group: 'radius', public: true, default: '0.5rem', description: 'x' }],
		'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
		'src/tokens/radius.css': '@layer yeti.base { :root { --yeti-radius-md: 0.5rem; } }\n',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/radius.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "components/tag/tag.css";\n',
		'src/themes/round.css': theme,
	});
	assert.deepEqual(run(tree('@layer theme;\n')).lines, ['src/themes/round.css:1: the only @layer statement a theme may make is Yeti\'s own order, first in the file: @layer yeti.reset, yeti.base, yeti.theme, yeti.layouts, yeti.components, yeti.utilities; (found "@layer theme;")']);
	assert.deepEqual(run(tree('@import "x.css";\n:root { --yeti-radius-md: 0; }\n')).lines, ['src/themes/round.css:1: themes may only set --yeti-* tokens on :root (found "@import "x.css";")']);
});

test('validateThemes rejects a media block nested inside another', () => {
	const tree = (theme) => componentTree({
		'src/tokens/tokens.json': [{ name: '--yeti-radius-md', group: 'radius', public: true, default: '0.5rem', description: 'x' }],
		'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
		'src/tokens/radius.css': '@layer yeti.base { :root { --yeti-radius-md: 0.5rem; } }\n',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/radius.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "components/tag/tag.css";\n',
		'src/themes/round.css': theme,
	});
	assert.deepEqual(run(tree('@media (prefers-color-scheme: dark) {\n\t@media (prefers-color-scheme: dark) {\n\t}\n}\n')).lines, ['src/themes/round.css:2: themes may only set --yeti-* tokens on :root (found "@media (prefers-color-scheme: dark)")']);
});

const elementThemeTree = (theme) => componentTree({
	'src/tokens/tokens.json': [{ name: '--yeti-radius-md', group: 'radius', public: true, default: '0.5rem', description: 'x' }],
	'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
	'src/tokens/radius.css': '@layer yeti.base { :root { --yeti-radius-md: 0.5rem; } }\n',
	'src/yeti.css': '@import "layers.css";\n@import "tokens/radius.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "components/tag/tag.css";\n',
	'src/themes/round.css': theme,
});

test('validateThemes accepts bare element rules inside @layer yeti.theme', () => {
	const theme = ':root { --yeti-radius-md: 0; }\n@layer yeti.theme {\n\th1, h2 { text-transform: uppercase; }\n\ta:hover { color: red; }\n\tfigure > figcaption, blockquote p { font-style: italic; }\n\tli::marker { color: red; }\n\t@media (width > 40rem) {\n\t\t@supports (text-wrap: balance) {\n\t\t\th1 { text-wrap: balance; }\n\t\t}\n\t}\n}\n';
	assert.deepEqual(run(elementThemeTree(theme)).lines, []);
});

test('validateThemes accepts a bare allowed pseudo-element as a whole selector inside @layer yeti.theme', () => {
	const theme = '@layer yeti.theme {\n\t::selection { background: yellow; }\n\t::placeholder, ::marker { color: gray; }\n}\n';
	assert.deepEqual(run(elementThemeTree(theme)).lines, []);
	assert.deepEqual(run(elementThemeTree('@layer yeti.theme {\n\t::before { color: red; }\n}\n')).lines, ['src/themes/round.css:2: theme element rules may only select bare HTML elements (found "::before")']);
	assert.deepEqual(run(elementThemeTree('@layer yeti.theme {\n\t::selection p { color: red; }\n}\n')).lines, ['src/themes/round.css:2: theme element rules may only select bare HTML elements (found "::selection p")']);
});

test('validateThemes refuses anything but bare element selectors inside @layer yeti.theme', () => {
	const refused = (sel) => run(elementThemeTree(`@layer yeti.theme {\n\t${sel} { color: red; }\n}\n`)).lines;
	for (const sel of ['.card', '[data-x]', '*', 'h1:has(a)', '#main', 'p .card', 'h1 + p', 'a:focus', ':hover']) {
		assert.deepEqual(refused(sel), [`src/themes/round.css:2: theme element rules may only select bare HTML elements (found "${sel}")`], sel);
	}
	assert.deepEqual(refused('h1, .card'), ['src/themes/round.css:2: theme element rules may only select bare HTML elements (found ".card")']);
	assert.deepEqual(refused('card p'), ['src/themes/round.css:2: theme element rules may only select bare HTML elements ("card" is not an HTML element)']);
});

test('validateThemes refuses a custom property inside @layer yeti.theme', () => {
	assert.deepEqual(run(elementThemeTree('@layer yeti.theme {\n\th1 { color: red; --yeti-x: 1; }\n}\n')).lines, [
		'src/themes/round.css:2: theme element rules may not set custom properties; set tokens on :root (found "--yeti-x")',
	]);
});

test('validateThemes refuses any other layer, and element rules outside yeti.theme', () => {
	assert.deepEqual(run(elementThemeTree('@layer other {\n}\n')).lines, ['src/themes/round.css:1: themes may only open @layer yeti.theme (found "@layer other")']);
	assert.deepEqual(run(elementThemeTree('h1 { text-transform: uppercase; }\n')).lines, ['src/themes/round.css:1: themes may only set --yeti-* tokens on :root (found "h1")']);
	assert.deepEqual(run(elementThemeTree('@media (prefers-color-scheme: dark) {\n\t@layer yeti.theme {\n\t}\n}\n')).lines, ['src/themes/round.css:2: themes may only set --yeti-* tokens on :root (found "@layer yeti.theme")']);
});

test('validateThemes checks the starter theme as well as src/themes', () => {
	const tree = elementThemeTree(':root { --yeti-radius-md: 0; }\n');
	assert.deepEqual(run({ ...tree, 'src/starter/theme.css': '/* :root { --yeti-radius-md: 0; } */\n' }).lines, []);
	assert.deepEqual(run({ ...tree, 'src/starter/theme.css': '.card { color: red; }\n' }).lines, ['src/starter/theme.css:1: themes may only set --yeti-* tokens on :root (found ".card")']);
});

test('the starter page is checked against the manifests, like an example', () => {
	const r = run(validTree({ 'src/starter/index.html': '<!doctype html>\n<html lang="en">\n<body>\n<div class="rail" data-nope="1"><p>x</p></div>\n</body>\n</html>\n' }));
	assert.deepEqual(r.lines, ['src/starter/index.html:4: .rail <div>: unknown attribute data-nope']);
});

test('the starter theme may set tokens outside src/tokens/, like a theme', () => {
	const tree = elementThemeTree(':root { --yeti-radius-md: 0; }\n');
	assert.deepEqual(run({ ...tree, 'src/starter/theme.css': ':root { --yeti-radius-md: 1rem; }\n' }).lines, []);
});

test('validateImportOrder rejects the starter imported into yeti.css', () => {
	const r = run(validTree({
		'src/tokens/scale.css': ':root { --yeti-base-min: 1rem; }\n',
		'src/starter/theme.css': ':root { --yeti-base-min: 2rem; }\n',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/scale.css";\n@import "layouts/rail/rail.css";\n@import "starter/theme.css";\n',
	}));
	assert.deepEqual(r.lines, ['src/yeti.css:4: the starter is copied, not bundled, and must not be imported into yeti.css (found "starter/theme.css")']);
});

test('no framework file ships rules in the yeti.theme layer', () => {
	const r = run(validTree({
		'src/layouts/rail/rail.css': '@layer yeti.layouts {\n  .rail { display: flex; }\n}\n@layer yeti.theme {\n  h1 { color: red; }\n}\n',
		'src/themes/round.css': null,
	}));
	assert.deepEqual(r.lines, ['src/layouts/rail/rail.css:4: Yeti ships nothing in the yeti.theme layer; it belongs to a theme (found "@layer yeti.theme")']);
	const statement = run(validTree({ 'src/base/extra.css': '@layer yeti.base, yeti.theme;\n', 'src/yeti.css': '@import "layers.css";\n@import "base/extra.css";\n@import "layouts/rail/rail.css";\n' }));
	assert.deepEqual(statement.lines, ['src/base/extra.css:1: Yeti ships nothing in the yeti.theme layer; it belongs to a theme (found "@layer yeti.base, yeti.theme")']);
});

test('validateThemes accepts Yeti\'s layer order repeated first in the file, and no other layer statement', () => {
	const body = '@layer yeti.theme {\n\th1 { text-transform: uppercase; }\n}\n';
	assert.deepEqual(run(elementThemeTree(`${LAYER_STATEMENT}\n:root { --yeti-radius-md: 0; }\n${body}`)).lines, []);
	assert.deepEqual(run(elementThemeTree(`/* order */\n@layer yeti.reset,\n\tyeti.base, yeti.theme, yeti.layouts, yeti.components, yeti.utilities;\n${body}`)).lines, []);
	const refused = (statement) => `the only @layer statement a theme may make is Yeti's own order, first in the file: ${LAYER_STATEMENT} (found "${statement}")`;
	const wrongOrder = '@layer yeti.reset, yeti.theme, yeti.base, yeti.layouts, yeti.components, yeti.utilities;';
	assert.deepEqual(run(elementThemeTree(`${wrongOrder}\n${body}`)).lines, [`src/themes/round.css:1: ${refused(wrongOrder)}`]);
	assert.deepEqual(run(elementThemeTree(`:root { --yeti-radius-md: 0; }\n${LAYER_STATEMENT}\n`)).lines, [`src/themes/round.css:2: ${refused(LAYER_STATEMENT)}`]);
});

test('validateThemes sees a rule hidden between comment markers inside strings', () => {
	const theme = '@layer yeti.theme {\n\tq { quotes: "/*" "x"; }\n}\n.card { color: red; }\n@layer yeti.theme {\n\tq { quotes: "*/" "x"; }\n}\n';
	assert.deepEqual(run(elementThemeTree(theme)).lines, ['src/themes/round.css:4: themes may only set --yeti-* tokens on :root (found ".card")']);
});

test('validateThemes reports leftover text at the end of a layer or nested at-rule block', () => {
	assert.deepEqual(run(elementThemeTree('@layer yeti.theme {\n\th1 { color: red; }\n\tcolor: blue;\n}\n')).lines, ['src/themes/round.css:3: theme blocks may only hold rules (found "color: blue;")']);
	assert.deepEqual(run(elementThemeTree('@layer yeti.theme {\n\t@media (width > 40rem) {\n\t\th1 { color: red; }\n\t\t@import "x.css";\n\t}\n}\n')).lines, ['src/themes/round.css:4: theme blocks may only hold rules (found "@import "x.css";")']);
});

test('validateThemes refuses a rule or at-rule nested inside an element rule', () => {
	const message = (found) => `nest @media or @supports around the rule, not inside it; nested selectors are not allowed (found "${found}")`;
	assert.deepEqual(run(elementThemeTree('@layer yeti.theme {\n\ta { color: red;\n\t\t&:hover { color: blue; }\n\t}\n}\n')).lines, [`src/themes/round.css:3: ${message('&:hover')}`]);
	assert.deepEqual(run(elementThemeTree('@layer yeti.theme {\n\th1 {\n\t\t@media (width > 40rem) { font-size: 2rem; }\n\t}\n}\n')).lines, [`src/themes/round.css:3: ${message('@media (width > 40rem)')}`]);
});

const markerTree = (example) => layoutTree({
	'src/layouts/rail/manifest.json': validManifest({
		markers: [
			{ name: 'data-span', type: 'enum', vocabulary: 'span', on: '> *', description: 'Shares of the row.' },
			{ name: 'data-split', type: 'boolean', on: '> *', description: 'Pushed to the end.' },
		],
	}),
	'src/layouts/rail/example.html': example,
});

test('a marker value is checked on descendants of the component that declares it', () => {
	const bad = run(markerTree('<div class="rail">\n\t<p data-span="13">x</p>\n\t<p data-split="yes">y</p>\n</div>\n'));
	assert.deepEqual(bad.lines, [
		'src/layouts/rail/example.html:2: .rail <div>: attribute data-span="13" on <p> is not one of 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12',
		'src/layouts/rail/example.html:3: .rail <div>: attribute data-split on <p> is a boolean attribute and takes no value',
	]);
	const ok = run(markerTree('<div class="rail"><p data-span="2">x</p><p data-split>y</p></div>\n'));
	assert.deepEqual(ok.lines, []);
});

test('a marker outside its component is left alone', () => {
	const r = run(componentTree({
		'src/layouts/rail/manifest.json': validManifest({ markers: [{ name: 'data-span', type: 'enum', vocabulary: 'span', description: 'x' }] }),
		'src/components/tag/example.html': '<span class="tag" data-span="13">New</span>\n',
	}));
	assert.deepEqual(r.lines, []);
});

test('a marker inside nested components of one kind is reported once', () => {
	const r = run(markerTree('<div class="rail"><div class="rail"><p data-span="13">x</p></div></div>\n'));
	assert.equal(r.lines.length, 1);
});

test('data-paint and data-text are markers checked against the paint vocabulary', () => {
	const tree = layoutTree({
		'src/layouts/rail/manifest.json': validManifest({
			markers: [
				{ name: 'data-paint', type: 'enum', vocabulary: 'paint', on: '*', description: 'x' },
				{ name: 'data-text', type: 'enum', vocabulary: 'paint', on: '*', description: 'x' },
			],
		}),
		'src/layouts/rail/example.html': '<div class="rail" data-paint="gray-20">\n\t<p data-paint="grey-75">x</p>\n\t<span data-text="blue">y</span>\n</div>\n',
	});
	assert.deepEqual(run(tree).lines, [
		'src/layouts/rail/example.html:1: .rail <div>: attribute data-paint="gray-20" on <div> is not one of primary, secondary, success, warning, alert, neutral, white, black, grey, grey-0, grey-10, grey-20, grey-30, grey-40, grey-50, grey-60, grey-70, grey-80, grey-90, grey-100',
		'src/layouts/rail/example.html:2: .rail <div>: attribute data-paint="grey-75" on <p> is not one of primary, secondary, success, warning, alert, neutral, white, black, grey, grey-0, grey-10, grey-20, grey-30, grey-40, grey-50, grey-60, grey-70, grey-80, grey-90, grey-100',
		'src/layouts/rail/example.html:3: .rail <div>: attribute data-text="blue" on <span> is not one of primary, secondary, success, warning, alert, neutral, white, black, grey, grey-0, grey-10, grey-20, grey-30, grey-40, grey-50, grey-60, grey-70, grey-80, grey-90, grey-100',
	]);
	tree['src/layouts/rail/example.html'] = '<div class="rail"><p data-paint="grey-40">x</p><span data-text="primary">y</span><b data-paint="grey-80" data-text="white">z</b></div>\n';
	assert.deepEqual(run(tree).lines, []);
});

test('a marker referencing a vocabulary validate does not map is reported', () => {
	const r = run(layoutTree({
		'src/layouts/rail/manifest.json': validManifest({ markers: [{ name: 'data-tone', type: 'enum', vocabulary: 'align', description: 'x' }] }),
	}));
	assert.deepEqual(r.lines, [
		'src/layouts/rail/manifest.json: attribute data-tone references vocabulary "align" but validate does not check it; add it to MAPPED or READ_DIRECTLY in bin/validate.js',
	]);
});

const manifestTokensTree = (tokens, css = '@layer yeti.layouts {\n\t.rail { display: flex; gap: var(--yeti-space-md); --_yeti-rail-gap: 1rem; }\n}\n') => catalogueTree({
	'src/tokens/tokens.json': [
		{ name: '--yeti-base-min', group: 'scale', public: true, default: '1rem', description: 'x' },
		{ name: '--yeti-base', group: 'scale', public: true, declared: false, default: 'unset', description: 'x' },
		{ name: '--yeti-space-md', group: 'space', public: true, default: '1rem', description: 'x' },
		{ name: '--yeti-space-lg', group: 'space', public: true, default: '2rem', description: 'x' },
	],
	'src/tokens/scale.css': '@layer yeti.base {\n\t:root {\n\t\t--yeti-base-min: var(--yeti-base, 1rem);\n\t\t--yeti-space-md: 1rem;\n\t\t--yeti-space-lg: 2rem;\n\t\t--_yeti-t: 0;\n\t}\n}\n',
	'src/layouts/rail/manifest.json': validManifest({ tokens }),
	'src/layouts/rail/rail.css': css,
});

test('validateManifestTokens passes when tokens[] matches what the CSS reads and declares', () => {
	const r = run(manifestTokensTree([
		{ name: '--yeti-space-md', public: true, description: 'The gap.' },
		{ name: '--_yeti-rail-gap', public: false },
	]));
	assert.deepEqual(r.lines, []);
});

test('validateManifestTokens reports a public token the CSS reads but the manifest omits', () => {
	const r = run(manifestTokensTree([{ name: '--_yeti-rail-gap', public: false }]));
	assert.deepEqual(r.lines, ['src/layouts/rail/manifest.json: CSS reads --yeti-space-md but the manifest does not list it']);
});

test('validateManifestTokens reports a listed token the CSS never reads, and a missing description', () => {
	const r = run(manifestTokensTree([
		{ name: '--yeti-space-md', public: true, description: 'The gap.' },
		{ name: '--yeti-space-lg', public: true },
		{ name: '--_yeti-rail-gap', public: false },
	]));
	assert.deepEqual(r.lines, [
		'src/layouts/rail/manifest.json: --yeti-space-lg needs a description: what it controls, in one line',
		'src/layouts/rail/manifest.json: manifest lists --yeti-space-lg but the CSS never reads it',
	]);
});

test('validateManifestTokens diffs private tokens against declarations both ways', () => {
	const undeclared = run(manifestTokensTree([
		{ name: '--yeti-space-md', public: true, description: 'The gap.' },
		{ name: '--_yeti-rail-gap', public: false },
		{ name: '--_yeti-ghost', public: false },
	]));
	assert.deepEqual(undeclared.lines, ['src/layouts/rail/manifest.json: manifest lists --_yeti-ghost but the CSS never declares it']);
	const unlisted = run(manifestTokensTree([{ name: '--yeti-space-md', public: true, description: 'The gap.' }]));
	assert.deepEqual(unlisted.lines, ['src/layouts/rail/manifest.json: CSS declares --_yeti-rail-gap but the manifest does not list it']);
});

test('validateManifestTokens counts a token the JS module reads as read', () => {
	const r = run(manifestTokensTree(
		[{ name: '--yeti-space-md', public: true, description: 'The gap.' }, { name: '--yeti-space-lg', public: true, description: 'The wide gap.' }],
		'@layer yeti.layouts {\n\t.rail { gap: var(--yeti-space-md); }\n}\n',
	));
	assert.deepEqual(r.lines, ['src/layouts/rail/manifest.json: manifest lists --yeti-space-lg but the CSS never reads it']);
	const withJs = run({
		...manifestTokensTree(
			[{ name: '--yeti-space-md', public: true, description: 'The gap.' }, { name: '--yeti-space-lg', public: true, description: 'The wide gap.' }],
			'@layer yeti.layouts {\n\t.rail { gap: var(--yeti-space-md); }\n}\n',
		),
		'src/layouts/rail/manifest.json': validManifest({
			tokens: [{ name: '--yeti-space-md', public: true, description: 'The gap.' }, { name: '--yeti-space-lg', public: true, description: 'The wide gap.' }],
			js: [{ module: 'rail.js', optional: true }],
		}),
		'src/layouts/rail/rail.js': "getComputedStyle(el).getPropertyValue('--yeti-space-lg');\n",
	});
	assert.deepEqual(withJs.lines, []);
});

test('a group inside a fieldset with a legend is named by the fieldset', () => {
	const tree = (html) => validTree({
		'src/layouts/rail/manifest.json': validManifest({ a11y: { role: 'group', requiredAttributes: ['role', 'aria-label | aria-labelledby'], keyboard: [] } }),
		'src/layouts/rail/example.html': html,
	});
	assert.deepEqual(run(tree('<fieldset><legend>Rails</legend><div class="rail"><p>x</p></div></fieldset>')).lines, []);
	assert.equal(run(tree('<fieldset><div class="rail"><p>x</p></div></fieldset>')).errors.length, 2);
	assert.equal(run(tree('<div class="rail"><p>x</p></div>')).errors.length, 2);
});

test('a required attribute written as an alternation is satisfied by any one of its options', () => {
	const tree = (html) => validTree({
		'src/layouts/rail/manifest.json': validManifest({ a11y: { requiredAttributes: ['aria-label | aria-labelledby'], keyboard: [] } }),
		'src/layouts/rail/example.html': html,
	});
	assert.deepEqual(run(tree('<div class="rail" aria-label="Rail"><p>x</p></div>')).lines, []);
	assert.deepEqual(run(tree('<div class="rail" aria-labelledby="h"><p>x</p></div>')).lines, []);
	assert.deepEqual(run(tree('<div class="rail"><p>x</p></div>')).errors.map((e) => e.message), ['.rail <div>: missing required attribute: one of aria-label, aria-labelledby']);
});

test('fixtures are validated against the manifests, with the test-only contrast hooks allowed', () => {
	const fixture = (body) => componentTree({
		'test/browser/fixtures/components/tag.html': `<!doctype html>\n<html>\n<body>\n${body}\n</body>\n</html>\n`,
	});
	assert.deepEqual(run(fixture('<span class="tag" data-contrast data-contrast-border data-contrast-id="a" data-contrast-edge-id="b">New</span>')).lines, []);
	assert.deepEqual(run(fixture('<span class="tag" data-glow>New</span>')).lines, ['test/browser/fixtures/components/tag.html:4: .tag <span>: unknown attribute data-glow']);
	assert.deepEqual(run(fixture('<span class="tag" data-variant="loud">New</span>')).lines, ['test/browser/fixtures/components/tag.html:4: .tag <span>: data-variant="loud" is not one of primary, secondary, success, warning, alert, danger, neutral, black, white']);
});

test('a fixture whose body carries the class is validated like any other element', () => {
	const r = run(componentTree({
		'test/browser/fixtures/components/tag.html': '<!doctype html>\n<html>\n<body class="tag" data-glow>\n<p>x</p>\n</body>\n</html>\n',
	}));
	assert.deepEqual(r.lines, ['test/browser/fixtures/components/tag.html:3: .tag <body>: unknown attribute data-glow']);
});

const direct = (fn, files, ...args) => {
	const root = makeTree(files);
	return fn(root, ...args).map((e) => formatError(root, e));
};

test('validateTokenReads resolves every public read to the catalogue and every private read to a declaration', () => {
	const typo = direct(validateTokenReads, catalogueTree({ 'src/layouts/rail/rail.css': '@layer yeti.layouts {\n\t.rail {\n\t\tdisplay: flex;\n\t\tgap: var(--yeti-base-mim);\n\t}\n}\n' }));
	assert.deepEqual(typo, ['src/layouts/rail/rail.css:4: reads --yeti-base-mim, which is not in the catalogue']);
	const ghost = direct(validateTokenReads, catalogueTree({ 'src/layouts/rail/rail.css': '@layer yeti.layouts {\n\t.rail { gap: var(--_yeti-gapp, 1rem); }\n}\n' }));
	assert.deepEqual(ghost, ['src/layouts/rail/rail.css:2: reads --_yeti-gapp, which nothing in src/ declares']);
	const ok = direct(validateTokenReads, catalogueTree({ 'src/layouts/rail/rail.css': '@layer yeti.layouts {\n\t.rail { gap: var(--_yeti-t); font-size: var(--yeti-base-min); }\n}\n' }));
	assert.deepEqual(ok, []);
});

test('validateTokenReads ignores a var() inside a comment', () => {
	const r = direct(validateTokenReads, catalogueTree({ 'src/layouts/rail/rail.css': '@layer yeti.layouts {\n\t/* was var(--yeti-nope) */\n\t.rail { display: flex; }\n}\n' }));
	assert.deepEqual(r, []);
});

test('validateThemes rejects a theme that sets a theme: false token', () => {
	const tree = (theme) => componentTree({
		'src/tokens/tokens.json': [
			{ name: '--yeti-radius-md', group: 'radius', public: true, default: '0.5rem', description: 'x' },
			{ name: '--yeti-range-value', group: 'field', public: true, theme: false, default: '0%', description: 'x' },
		],
		'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
		'src/tokens/radius.css': '@layer yeti.base { :root { --yeti-radius-md: 0.5rem; --yeti-range-value: 0%; } }\n',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/radius.css";\n@import "layouts/attributes.css";\n@import "layouts/rail/rail.css";\n@import "components/tag/tag.css";\n',
		'src/themes/round.css': theme,
	});
	assert.deepEqual(run(tree(':root { --yeti-radius-md: 0; }\n')).lines, []);
	assert.deepEqual(run(tree(':root { --yeti-range-value: 50%; }\n')).lines, ['src/themes/round.css:1: theme sets "--yeti-range-value", which is a per-element input, not a theme value']);
});

const motion = (files) => direct((root) => validateMotion(path.join(root, 'src')), files);

test('validateMotion requires token-based durations, iteration counts and scroll behaviour', () => {
	const css = (body) => `@layer yeti.components {\n\t.tag { display: inline-flex; }\n\t.tag:hover {\n\t\t${body}\n\t}\n}\n`;
	const at = (message) => [`src/components/tag/tag.css:4: ${message}`];
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('transition: color var(--yeti-duration-fast) var(--yeti-ease), background-color var(--yeti-duration-fast) var(--yeti-ease);') })), []);
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('transition: none; animation: none; scroll-behavior: auto; transition-duration: 0s;') })), []);
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('animation: spin calc(var(--yeti-duration-base) * 4) linear var(--yeti-motion-iterations);') })), []);
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('transition: color 150ms var(--yeti-ease);') })), at('transition must read a --yeti-* token or be none (found "150ms")'));
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('transition-duration: .2s;') })), at('transition-duration must read a --yeti-* token or be none (found ".2s")'));
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('animation: spin var(--yeti-duration-base) linear infinite;') })), at('animation must read a --yeti-* token or be none (found "infinite")'));
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('animation-iteration-count: 3;') })), at('animation-iteration-count must read a --yeti-* token or be none (found "3")'));
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('scroll-behavior: smooth;') })), at('scroll-behavior must read a --yeti-* token or be none (found "smooth")'));
	assert.deepEqual(motion(componentTree({ 'src/components/tag/tag.css': css('overscroll-behavior-x: contain;') })), []);
});

test('validateMotion covers layouts as well and reports the property line inside a multi-line value', () => {
	const r = motion(layoutTree({ 'src/layouts/rail/rail.css': '@layer yeti.layouts {\n\t.rail {\n\t\tdisplay: flex;\n\t\ttransition:\n\t\t\topacity 1s,\n\t\t\tcolor var(--yeti-duration-fast);\n\t}\n}\n' }));
	assert.deepEqual(r, ['src/layouts/rail/rail.css:4: transition must read a --yeti-* token or be none (found "1s")']);
});

test('every anchor-name needs an anchor-scope in the same file', () => {
	const scoped = run(componentTree({ 'src/components/tag/tag.css': '@layer yeti.components {\n\t.tag { anchor-scope: --yeti-tag; }\n\t.tag > button { anchor-name: --yeti-tag; }\n}\n' }));
	assert.deepEqual(scoped.lines, []);
	const loose = run(componentTree({ 'src/components/tag/tag.css': '@layer yeti.components {\n\t.tag { display: block; }\n\t.tag > button { anchor-name: --yeti-tag; }\n}\n' }));
	assert.deepEqual(loose.lines, ['src/components/tag/tag.css:3: anchor-name without anchor-scope; scope every anchor to its component']);
});

test('container thresholds must be a width token default, a whole multiple of one, or a calc( of one', () => {
	const css = (query) => `@layer yeti.components {\n\t.tag { container-type: inline-size; }\n\t@container (inline-size ${query}) {\n\t\t.tag > * { display: none; }\n\t}\n}\n`;
	for (const ok of ['< 12rem', '< 16rem', '>= 24rem', '< 32rem', '>= 48rem', '< 64rem', '>= 80rem', '>= 96rem', '>= 240rem', '< calc(24rem + 2 * 1rem)']) {
		assert.deepEqual(run(componentTree({ 'src/components/tag/tag.css': css(ok) })).lines, [], ok);
	}
	assert.deepEqual(run(componentTree({ 'src/components/tag/tag.css': css('< 22rem') })).lines, [
		'src/components/tag/tag.css:3: @container threshold "22rem" is not a width token\'s default (8, 12, 16, 24, 32, 48, 64, 80rem), a whole multiple of one, or a calc( of one',
	]);
	assert.deepEqual(run(componentTree({ 'src/components/tag/tag.css': css('> 400px') })).lines, [
		'src/components/tag/tag.css:3: @container threshold "400px" is not a width token\'s default (8, 12, 16, 24, 32, 48, 64, 80rem), a whole multiple of one, or a calc( of one',
	]);
});

test('the real src/ passes the motion, anchor and container lints', () => {
	assert.deepEqual(validateMotion(path.join(REPO_ROOT, 'src')), []);
	assert.deepEqual(validateAnchorsAndContainers(path.join(REPO_ROOT, 'src')), []);
});

test('findBareMargin catches an attribute selector on the identity class', () => {
	assert.deepEqual(findBareMargin('.rail[data-raised] { margin: 1rem; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin('.rail[data-raised] > * { margin: 1rem; }', 'rail'), []);
});

test('findBareMargin catches :not() and other pseudo-classes on the identity class', () => {
	assert.deepEqual(findBareMargin('.rail:not([data-x]) { margin: 1rem; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin('.rail:hover { margin: 1rem; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin('.rail:not(.grid > .rail) { margin: 1rem; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin('.other:not(.rail) { margin: 1rem; }', 'rail'), []);
});

test('findBareMargin catches :is() and :where() wrapping the identity class', () => {
	assert.deepEqual(findBareMargin(':is(.rail) { margin: 1rem; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin(':where(.pill, .rail):hover { margin: 1rem; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin(':is(.rail) > * { margin: 1rem; }', 'rail'), []);
});

test('findBareMargin catches a nested & block inside the identity class', () => {
	assert.deepEqual(findBareMargin('.rail {\n  display: flex;\n  &[data-raised] { margin: 1rem; }\n}', 'rail'), [3]);
	assert.deepEqual(findBareMargin('.rail {\n  &:hover { margin: 1rem; }\n}', 'rail'), [2]);
	assert.deepEqual(findBareMargin('.rail {\n  @supports (gap: 1rem) {\n    &[data-x] { margin: 1rem; }\n  }\n}', 'rail'), [3]);
	assert.deepEqual(findBareMargin('.rail {\n  & > [data-x] { margin: 1rem; }\n}', 'rail'), []);
	assert.deepEqual(findBareMargin('.other {\n  &[data-x] { margin: 1rem; }\n}', 'rail'), []);
});

test('findBareMargin treats a tag or extra class on the identity class as the same box, and a pseudo-element as another', () => {
	assert.deepEqual(findBareMargin('article.rail { margin: 1rem; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin('.rail.wide { margin: 1rem; }', 'rail'), [1]);
	assert.deepEqual(findBareMargin('.rail::before { margin: 1rem; }', 'rail'), []);
});

test('validateImportOrder rejects a theme imported into yeti.css', () => {
	const r = run(validTree({
		'src/tokens/scale.css': ':root { --yeti-base-min: 1rem; }\n',
		'src/themes/sharp.css': ':root { --yeti-base-min: 2rem; }\n',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/scale.css";\n@import "layouts/rail/rail.css";\n@import "themes/sharp.css";\n',
	}));
	assert.deepEqual(r.lines, ['src/yeti.css:4: themes are opt-in and must not be imported into yeti.css (found "themes/sharp.css")']);
});

// The fit vocabulary is read directly by billboard.css rather than mapped
// into attributes.css, so validateVocabulary cannot see it: a pair added to
// the list with no rule behind it would be offered by the manifest, accepted
// by the validator, and do nothing in the browser. This is that check. The
// vocabulary and the attribute are still called fit after the class became
// billboard, because they name the range the text fits within rather than the
// thing that reads it.
test('every value of the fit vocabulary has a rule in billboard.css', () => {
	const vocabulary = JSON.parse(fs.readFileSync(VOCABULARY_PATH, 'utf8'));
	const css = fs.readFileSync(path.join(REPO_ROOT, 'src/utilities/billboard/billboard.css'), 'utf8');
	assert.equal(vocabulary.fit.length, 28);
	for (const value of vocabulary.fit) {
		assert.ok(css.includes(`.billboard[data-fit="${value}"]`), `${value} has no rule in billboard.css`);
	}
});

// The print vocabulary is read directly by print.css rather than mapped into
// attributes.css, so validateVocabulary cannot see it: a value added to the
// list with no rule behind it would be offered by the manifest, accepted by
// the validator, and do nothing in the browser. The two selectors are not the
// same shape — only is also what an absent attribute means, so it is written
// as a :not() of the other value — which is why this names both rather than
// building a selector from the value, and why a third value fails here loudly
// instead of failing silently in a browser.
test('every value of the print vocabulary has a rule in print.css', () => {
	const expected = { only: '.print:not([data-print="none"])', none: '.print[data-print="none"]' };
	const vocabulary = JSON.parse(fs.readFileSync(VOCABULARY_PATH, 'utf8'));
	const css = fs.readFileSync(path.join(REPO_ROOT, 'src/utilities/print/print.css'), 'utf8');
	assert.equal(vocabulary.print.length, 2);
	for (const value of vocabulary.print) {
		assert.ok(expected[value], `${value} is a print value this test has no expected selector for`);
		assert.ok(css.includes(expected[value]), `${value} has no rule in print.css`);
	}
});

test('a .js file in a component folder that the manifest does not declare is reported', () => {
	const r = run(validTree({ 'src/layouts/rail/stray.js': '// nobody declared me\n' }));
	assert.deepEqual(r.lines, ['src/layouts/rail/manifest.json: stray.js is in the folder but the manifest does not declare it under js']);
});

test('an event the manifest promises must be named in the module source', () => {
	const r = run(validTree({
		'src/layouts/rail/manifest.json': validManifest({ js: [{ module: 'rail.js', optional: true, events: [{ name: 'yeti:slide', description: 'The rail moved.' }] }] }),
		'src/layouts/rail/rail.js': '// says nothing\n',
	}));
	assert.deepEqual(r.lines, ['src/layouts/rail/manifest.json: rail.js is declared to dispatch yeti:slide but its source never names it']);
});

test('an event a module dispatches must be declared in the manifest', () => {
	const r = run(validTree({
		'src/layouts/rail/manifest.json': validManifest({ js: [{ module: 'rail.js', optional: true }] }),
		'src/layouts/rail/rail.js': "document.dispatchEvent(new CustomEvent('yeti:slide'));\n",
	}));
	assert.deepEqual(r.lines, ['src/layouts/rail/manifest.json: rail.js names yeti:slide but the manifest does not declare it under js[].events']);
});

test('a module and its declared events agreeing is silent', () => {
	const r = run(validTree({
		'src/layouts/rail/manifest.json': validManifest({ js: [{ module: 'rail.js', optional: true, events: [{ name: 'yeti:slide', detail: '{ index }', description: 'The rail moved.' }] }] }),
		'src/layouts/rail/rail.js': "document.dispatchEvent(new CustomEvent('yeti:slide', { detail: { index: 0 } }));\n",
	}));
	assert.deepEqual(r.lines, []);
});

const warned = (files) => {
	const root = makeTree(files);
	const r = validate({ root });
	return { root, errors: r.errors.map((e) => formatError(root, e)), warnings: (r.warnings ?? []).map((w) => formatError(root, w)) };
};

test('data-show with no size container above it is a warning, not an error', () => {
	const r = warned(example('<div class="rail">\n<div class="box"><p data-show="md">x</p></div></div>\n'));
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.warnings, ['src/layouts/rail/example.html:2: data-show on <p> has no size container above it to measure, so it never changes; put it inside a container']);
});

test('data-hide inside a container, or any known size container, is silent', () => {
	for (const html of [
		'<div class="rail"><div class="container"><div class="box"><p data-hide="md">x</p></div></div></div>',
		'<div class="rail"><nav class="nav"><a data-show="md" href="#">x</a></nav></div>',
		'<div class="rail"><div class="grid" data-fold><p data-show="md">x</p></div></div>',
		'<div class="rail"><div class="grid" data-tracks="12"><p data-show="md">x</p></div></div>',
		'<div class="rail"><div class="cluster" data-threshold="sm"><p data-show="md">x</p></div></div>',
		'<div class="rail"><div class="breakout"><p data-note>n</p><p data-show="md">x</p></div></div>',
		'<div class="rail"><article class="card"><img src="a.png" alt=""><p data-show="md">x</p></article></div>',
		'<div class="rail"><div style="container-type: inline-size"><p data-show="md">x</p></div></div>',
		'<div class="rail"><div class="demo"><div data-preview><p data-show="md">x</p></div></div></div>',
	]) {
		assert.deepEqual(warned(example(html)).warnings, [], html);
	}
});

test('a card without leading media and a breakout without a note are not containers', () => {
	const r = warned(example('<div class="rail"><article class="card"><h2>t</h2><p data-show="md">x</p></article><div class="breakout"><p data-hide="md">y</p></div></div>'));
	assert.equal(r.warnings.length, 2);
});

test('the warning covers fixtures, guide demos and the starter', () => {
	const r = warned(validTree({
		'test/browser/fixtures/layouts/loose.html': '<!doctype html><html lang="en"><head><title>x</title></head><body><p data-show="md">x</p></body></html>\n',
		'src/guides/visibility.md': '# V\n\n```html\n<p data-hide="sm">x</p>\n```\n',
		'src/starter/index.html': '<!doctype html><html lang="en"><head><title>x</title></head><body><p data-show="lg">x</p></body></html>\n',
	}));
	assert.deepEqual(r.warnings.map((w) => w.split(':')[0]).sort(), ['src/guides/visibility.md', 'src/starter/index.html', 'test/browser/fixtures/layouts/loose.html']);
});

test('validate prints the warning and still exits 0', async () => {
	const { spawnSync } = await import('node:child_process');
	const root = makeTree(example('<div class="rail"><p data-show="md">x</p></div>\n'));
	const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'bin', 'validate.js')], { cwd: root, encoding: 'utf8' });
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr + result.stdout, /^warning: src\/layouts\/rail\/example\.html:1: data-show on <p>/m);
	assert.match(result.stdout, /validate: ok/);
});

test('a thresholded cluster that is an item of another cluster is a warning', () => {
	const r = warned(example('<div class="rail"><div class="cluster">\n<div class="cluster" data-threshold="sm"><a href="#">a</a></div></div></div>\n'));
	assert.deepEqual(r.warnings, ['src/layouts/rail/example.html:2: .cluster[data-threshold] is an item of another .cluster, so it has no width of its own to measure; give it one, or flex-grow']);
	assert.deepEqual(warned(example('<div class="rail"><div class="stack"><div class="cluster" data-threshold="sm"><a href="#">a</a></div></div></div>\n')).warnings, []);
});

test('the real tree prints no warnings', () => {
	assert.deepEqual(validate({ root: REPO_ROOT }).warnings.map((w) => formatError(REPO_ROOT, w)), []);
});

test('the size containers validate knows cover every container-type: inline-size rule in src', () => {
	const found = new Set();
	for (const file of walkSrcCss(path.join(REPO_ROOT, 'src'))) {
		const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
		for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
			if (!/(?:^|[;\s])container-type\s*:\s*inline-size/.test(m[2])) continue;
			const selector = m[1].split(';').pop().trim();
			for (const one of selector.split(/,(?![^()]*\))/)) found.add(one.trim().replace(/\s+/g, ' '));
		}
	}
	assert.ok(found.size >= 9, `read ${found.size} selectors; the scan is not finding the rules`);
	const missing = [...found].filter((s) => !SIZE_CONTAINERS.includes(s));
	assert.deepEqual(missing, []);
});

test('a demo is a container only at its preview', () => {
	assert.equal(warned(example('<div class="rail"><div class="demo"><p data-show="md">x</p></div></div>')).warnings.length, 1);
	assert.deepEqual(warned(example('<div class="rail"><div class="demo"><div data-preview><p data-show="md">x</p></div></div></div>')).warnings, []);
});

test('grid placement attributes on a grid without data-tracks are a warning', () => {
	const r = warned(gridTree('<div class="grid" data-threshold="sm">\n<p data-start="2">a</p>\n<p data-span="3">b</p>\n<p>c</p>\n</div>\n'));
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.warnings, [
		'src/layouts/grid/example.html:1: data-threshold on a .grid without data-tracks does nothing',
		'src/layouts/grid/example.html:2: data-start on <p> does nothing in a .grid without data-tracks',
		'src/layouts/grid/example.html:3: data-span on <p> does nothing in a .grid without data-tracks',
	]);
	assert.deepEqual(warned(gridTree('<div class="grid" data-tracks="12" data-threshold="sm"><p data-start="2" data-span="3">a</p></div>\n')).warnings, []);
	assert.deepEqual(warned(example('<div class="rail"><div class="columns"><p data-span="2">a</p><p>b</p></div></div>')).warnings, []);
});
