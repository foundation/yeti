import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderPage, generateDocs, isGenerated, GENERATED_MARK, renderTokensPage, escapeAttribute, renderDemo, renderAttributeTable, replaceMarked, ATTRIBUTES_START, ATTRIBUTES_END, GUIDE_TABLES, renderGuide, stampGuide, frontMatterTitle, parseDemoFence, renderGuideDemos, headingText, DEMO_HEIGHTS, DEMO_WIDTHS } from '../../bin/gen-docs.js';
import { makeTree, validManifest, validTree, TOKENS_SCHEMA_PATH, REPO_ROOT } from './helpers.js';
import { KIND_DIRS } from '../../bin/lib/manifest.js';

const exampleHtml = '<div class="rail" data-gap="l"><p>One</p><p>Two</p></div>\n';

test('renderPage starts with front matter and the generated mark', () => {
	const page = renderPage({ manifest: validManifest(), exampleHtml, navOrder: 3 });
	assert.ok(page.startsWith(
		'---\nraw: true\ntitle: "Rail"\ndescription: "A horizontal rail of items with a shared gap."\nnav_group: "Layouts"\nnav_order: 3\n---\n'
		+ `${GENERATED_MARK} from src/layouts/rail/manifest.json. Do not edit. -->\n`,
	));
});

test('renderPage includes every section with the manifest content', () => {
	const page = renderPage({ manifest: validManifest(), exampleHtml, navOrder: 1 });
	for (const heading of ['# Rail', '## Example', '## Attributes', '## Children', '## Tokens', '## Accessibility', '## Browser support', '## JavaScript']) {
		assert.ok(page.includes(`\n${heading}\n`), `missing ${heading}`);
	}
	assert.ok(page.includes('```html\n<div class="rail" data-gap="l"><p>One</p><p>Two</p></div>\n```'));
	assert.ok(page.includes('| `data-gap` | enum | `s`, `m`, `l` | `m` | Gap between items. |'));
	assert.ok(page.includes('| `data-wrap` | boolean |  |  | Allow items to wrap. |'));
	assert.ok(page.includes('- `> *`: at least 1. The items.'));
	assert.ok(page.includes('| `--rail-gap` | The gap between items. |'));
	assert.ok(page.includes('<details><summary>Internal tokens'));
	assert.ok(page.includes('- `--rail-internal`'));
	assert.ok(page.includes('- Used without guards: flexbox'));
	assert.ok(page.includes('None. This component is CSS only.'));
	assert.ok(page.includes('Available since 7.0.0.'));
});

test('renderPage handles roles, keyboard, js, and multi-word names', () => {
	const manifest = validManifest({
		name: 'tab-strip', class: 'tab-strip', kind: 'component',
		a11y: { role: 'tablist', requiredAttributes: ['aria-label'], keyboard: [{ key: 'ArrowRight', action: 'Next tab' }], notes: 'Labels are required.' },
		js: [{ module: 'tab-strip.js', optional: true }],
		support: { unguarded: [], guarded: ['anchor positioning'] },
	});
	const page = renderPage({ manifest, exampleHtml, navOrder: 1 });
	assert.ok(page.includes('title: "Tab Strip"'));
	assert.ok(page.includes('nav_group: "Components"'));
	assert.ok(page.includes('- Role: `tablist`'));
	assert.ok(page.includes('- Required attributes: `aria-label`'));
	assert.ok(page.includes('| `ArrowRight` | Next tab |'));
	assert.ok(page.includes('Optional enhancement: `components/tab-strip/tab-strip.js`. The component works without it.'));
	assert.ok(page.includes('- Behind `@supports`: anchor positioning'));
});

test('renderPage lists every module a component ships', () => {
	const manifest = validManifest({
		name: 'tab-strip', class: 'tab-strip', kind: 'component',
		js: [{ module: 'tab-strip.js', optional: true }, { module: 'validate.js', optional: true }],
	});
	const page = renderPage({ manifest, exampleHtml, navOrder: 1 });
	assert.ok(page.includes('Optional enhancement: `components/tab-strip/tab-strip.js`. The component works without it.'));
	assert.ok(page.includes('Optional enhancement: `components/tab-strip/validate.js`. The component works without it.'));
});

test('renderPage renders a module\'s events as a table', () => {
	const manifest = validManifest({
		name: 'tab-strip', class: 'tab-strip', kind: 'component',
		js: [{ module: 'tab-strip.js', optional: true, events: [
			{ name: 'yeti:select', detail: '{ tab, panel }', description: 'A tab was selected.' },
			{ name: 'yeti:close', description: 'The strip closed.' },
		] }],
	});
	const page = renderPage({ manifest, exampleHtml, navOrder: 1 });
	assert.ok(page.includes('| Event | Module | Detail | Description |'));
	assert.ok(page.includes('| `yeti:select` | `tab-strip.js` | `{ tab, panel }` | A tab was selected. |'));
	assert.ok(page.includes('| `yeti:close` | `tab-strip.js` | none | The strip closed. |'));
});

test('renderPage says nothing about events when no module dispatches any', () => {
	const manifest = validManifest({ name: 'tab-strip', class: 'tab-strip', kind: 'component', js: [{ module: 'tab-strip.js', optional: true }] });
	assert.ok(!renderPage({ manifest, exampleHtml, navOrder: 1 }).includes('| Event |'));
});

test('generateDocs writes a page per component, removes orphans, and leaves hand-written files alone', () => {
	const root = makeTree(validTree({
		'docs/guides/.gitkeep': '',
		'docs/hand-written.md': '# Mine\n',
		'docs/stale.md': `---\ntitle: "Old"\n---\n${GENERATED_MARK} from src/layouts/old/manifest.json. Do not edit. -->\n`,
	}));
	const r = generateDocs({ root });
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.written.map((f) => path.relative(root, f)), ['docs/rail.md']);
	assert.deepEqual(r.deleted.map((f) => path.relative(root, f)), ['docs/stale.md']);
	assert.ok(fs.existsSync(path.join(root, 'docs/hand-written.md')));
	assert.ok(fs.readFileSync(path.join(root, 'docs/rail.md'), 'utf8').includes('nav_order: 1'));
	const again = generateDocs({ root });
	assert.deepEqual(again.deleted, []);
});

test('isGenerated requires the mark right after the front matter, not anywhere in the file', () => {
	assert.equal(isGenerated(`---\ntitle: "X"\n---\n${GENERATED_MARK} from src/layouts/x/manifest.json. Do not edit. -->\n`), true);
	assert.equal(isGenerated(`---\ntitle: "Guide"\n---\n\n# About the generator\n\n\`\`\`html\n${GENERATED_MARK} from src/layouts/x/manifest.json. Do not edit. -->\n\`\`\`\n`), false);
	assert.equal(isGenerated(`# No front matter\n${GENERATED_MARK}`), false);
});

test('generateDocs keeps a hand-written page that quotes the generated mark', () => {
	const root = makeTree(validTree({
		'docs/about-docs.md': `---\ntitle: "About"\n---\n\nGenerated pages begin with:\n\n\`\`\`html\n${GENERATED_MARK} from src/layouts/x/manifest.json. Do not edit. -->\n\`\`\`\n`,
	}));
	const r = generateDocs({ root });
	assert.deepEqual(r.deleted, []);
	assert.ok(fs.existsSync(path.join(root, 'docs/about-docs.md')));
});

test('generateDocs refuses to overwrite a hand-written page with a component name', () => {
	const root = makeTree(validTree({ 'docs/rail.md': '# My own rail page\n' }));
	const r = generateDocs({ root });
	assert.equal(r.errors.length, 1);
	assert.match(r.errors[0].message, /refusing to overwrite/);
	assert.equal(fs.readFileSync(path.join(root, 'docs/rail.md'), 'utf8'), '# My own rail page\n');
});

test('generateDocs refuses to run on manifest errors', () => {
	const root = makeTree(validTree({ 'src/layouts/rail/manifest.json': validManifest({ since: 'x' }) }));
	const r = generateDocs({ root });
	assert.equal(r.errors.length, 1);
	assert.deepEqual(r.written, []);
});

const entries = [
	{ name: '--yeti-space-md', group: 'space', public: true, default: 'step 0', description: 'Default gap.' },
	{ name: '--yeti-hue-primary', group: 'hue', public: true, default: '250', description: 'Brand hue.' },
	{ name: '--yeti-base', group: 'scale', public: true, declared: false, default: 'unset', description: 'Pins both ends.' },
];

test('renderTokensPage groups by group with a table per group and notes internals', () => {
	const page = renderTokensPage(entries, 12);
	assert.ok(page.startsWith('---\nraw: true\ntitle: "Tokens"\n'));
	assert.ok(page.includes(`${GENERATED_MARK} from src/tokens/tokens.json. Do not edit. -->`));
	for (const h of ['## Scale', '## Space', '## Hue']) assert.ok(page.includes(`\n${h}\n`), h);
	assert.ok(page.indexOf('## Scale') < page.indexOf('## Space') && page.indexOf('## Space') < page.indexOf('## Hue'));
	assert.ok(page.includes('| `--yeti-space-md` | `step 0` | Default gap. |'));
	assert.ok(page.includes('| `--yeti-base` | unset (override only) | Pins both ends. |'));
	assert.ok(page.includes('12 internal `--_yeti-*` tokens'));
});

test('the tokens page has a heading for every group the real catalogue uses', () => {
	const catalogue = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src/tokens/tokens.json'), 'utf8'));
	const page = renderTokensPage(catalogue, 0);
	for (const group of new Set(catalogue.map((e) => e.group))) {
		assert.ok(page.includes(`\n## ${group[0].toUpperCase()}${group.slice(1)}\n`), `missing heading for ${group}`);
	}
});

test('generateDocs writes tokens.md when a catalogue exists and never sweeps it', () => {
	const root = makeTree(validTree({
		'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
		'src/tokens/scale.css': '@layer yeti.base { :root { --yeti-base-min: 1rem; --_yeti-t: 0; --_yeti-base: 1rem; } }\n',
		'src/tokens/tokens.json': [{ name: '--yeti-base-min', group: 'scale', public: true, default: '1rem', description: 'x' }],
		'src/base/reset.css': '',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/scale.css";\n@import "base/reset.css";\n@import "layouts/rail/rail.css";\n',
	}));
	const r = generateDocs({ root });
	assert.deepEqual(r.errors, []);
	assert.ok(r.written.map((f) => path.basename(f)).includes('tokens.md'));
	const again = generateDocs({ root });
	assert.deepEqual(again.deleted, []);
	assert.ok(fs.readFileSync(path.join(root, 'docs/tokens.md'), 'utf8').includes('2 internal `--_yeti-*` tokens'));
});

test('generateDocs sweeps a stale generated docs/tokens.md when there is no catalogue', () => {
	const root = makeTree(validTree({
		'docs/tokens.md': `---\ntitle: "Tokens"\n---\n${GENERATED_MARK} from src/tokens/tokens.json. Do not edit. -->\n`,
	}));
	const r = generateDocs({ root });
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.deleted.map((f) => path.basename(f)), ['tokens.md']);
	assert.ok(!fs.existsSync(path.join(root, 'docs/tokens.md')));
});

test('generateDocs refuses to run on an invalid catalogue', () => {
	const root = makeTree(validTree({
		'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
		'src/tokens/scale.css': '@layer yeti.base { :root { --yeti-base-min: 1rem; } }\n',
		'src/tokens/tokens.json': [{ name: '--yeti-base-min', group: 'nope', public: true, default: '1rem', description: 'x' }],
		'src/base/reset.css': '',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/scale.css";\n@import "base/reset.css";\n@import "layouts/rail/rail.css";\n',
	}));
	const r = generateDocs({ root });
	assert.equal(r.errors.length, 1);
	assert.deepEqual(r.written, []);
	assert.ok(!fs.existsSync(path.join(root, 'docs/tokens.md')));
});

test('the internal token count ignores comments', () => {
	const root = makeTree(validTree({
		'schema/tokens.schema.json': fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'),
		'src/tokens/scale.css': '/* --_yeti-commented: 0; */\n@layer yeti.base { :root { --yeti-base-min: 1rem; --_yeti-real: 1; } }\n',
		'src/tokens/tokens.json': [{ name: '--yeti-base-min', group: 'scale', public: true, default: '1rem', description: 'x' }],
		'src/base/reset.css': '',
		'src/yeti.css': '@import "layers.css";\n@import "tokens/scale.css";\n@import "base/reset.css";\n@import "layouts/rail/rail.css";\n',
	}));
	generateDocs({ root });
	assert.ok(fs.readFileSync(path.join(root, 'docs/tokens.md'), 'utf8').includes('1 internal `--_yeti-*` tokens'));
});

test('the tokens page renders the width and layout groups in order', () => {
	const page = renderTokensPage([
		{ name: '--yeti-width-xs', group: 'width', public: true, default: '16rem', description: 'x' },
		{ name: '--yeti-cover-height', group: 'layout', public: true, default: '100dvh', description: 'x' },
		{ name: '--yeti-radius-sm', group: 'radius', public: true, default: 'x', description: 'x' },
	], 0);
	assert.ok(page.indexOf('## Radius') < page.indexOf('## Width') && page.indexOf('## Width') < page.indexOf('## Layout'));
});

test('renderPage inserts a docs.md fragment after the example', () => {
	const page = renderPage({ manifest: validManifest(), exampleHtml, navOrder: 1, docsMd: '## When to use it\n\nProse here.\n\n## Why this name\n\nBecause.\n' });
	assert.ok(page.indexOf('## Example') < page.indexOf('## When to use it'));
	assert.ok(page.indexOf('## Why this name') < page.indexOf('## Attributes'));
});

test('generateDocs reads docs.md from the component folder', () => {
	const root = makeTree(validTree({ 'src/layouts/rail/docs.md': '## Why this name\n\nBecause.\n' }));
	generateDocs({ root });
	assert.ok(fs.readFileSync(path.join(root, 'docs/rail.md'), 'utf8').includes('## Why this name'));
});

test('an html demo block in a component\'s docs.md is a live figure named after its heading', () => {
	const docs = '## Wide\n\nProse.\n\n```html demo md\n<div class="rail"><p>One</p></div>\n```\n\n```html\n<p>Stays code.</p>\n```\n';
	const root = makeTree(validTree({ 'src/layouts/rail/docs.md': docs }));
	const r = generateDocs({ root, demoStylesheet: ['/site/yeti.css'] });
	assert.deepEqual(r.errors, []);
	const page = fs.readFileSync(path.join(root, 'docs/rail.md'), 'utf8');
	assert.ok(page.includes('<figure class="demo" data-height="md">'), 'the block is a demo figure');
	assert.ok(page.includes('data-preview="Wide"'), 'the frame is named after the section');
	// The page's own Example and the prose demo are both framed with the host's stylesheet.
	assert.equal(page.split('/site/yeti.css').length - 1, 2);
	assert.ok(page.includes('```html\n<p>Stays code.</p>\n```'), 'a plain block is still a code block');
});

test('a bad demo fence in a component\'s docs.md is reported at its line, and that page is not written', () => {
	const root = makeTree(validTree({ 'src/layouts/rail/docs.md': '## Wide\n\n```html demo huge\n<p>a</p>\n```\n' }));
	const r = generateDocs({ root });
	assert.equal(r.errors.length, 1);
	assert.ok(r.errors[0].file.endsWith(path.join('src', 'layouts', 'rail', 'docs.md')));
	assert.equal(r.errors[0].line, 3);
	assert.match(r.errors[0].message, /unknown token huge/);
	assert.ok(!fs.existsSync(path.join(root, 'docs/rail.md')));
});

test('a recipe renders into the Recipes group', () => {
	const page = renderPage({ manifest: validManifest({ name: 'duo', kind: 'recipe', class: 'duo' }), exampleHtml: '<div class="duo"><p>a</p><p>b</p></div>\n', navOrder: 1 });
	assert.ok(page.includes('nav_group: "Recipes"'));
	assert.ok(page.includes('from src/recipes/duo/manifest.json'));
});

test('the tokens page renders component groups after the framework groups', () => {
	const page = renderTokensPage([
		{ name: '--yeti-card-radius', group: 'card', public: true, default: 'x', description: 'x' },
		{ name: '--yeti-border-width', group: 'border', public: true, default: '1px', description: 'x' },
		{ name: '--yeti-color-text', group: 'color', public: true, default: 'x', description: 'x' },
	], 0);
	assert.ok(page.indexOf('## Color') < page.indexOf('## Border') && page.indexOf('## Border') < page.indexOf('## Card'));
});

test('renderPage renders a Markers table after Attributes, only when the manifest has markers', () => {
	const none = renderPage({ manifest: validManifest(), exampleHtml, navOrder: 1 });
	assert.ok(!none.includes('## Markers'));
	const manifest = validManifest({ markers: [
		{ name: 'data-span', type: 'enum', values: ['1', '2'], on: '> *', description: 'Shares of the row.' },
		{ name: 'data-split', type: 'boolean', description: 'Pushed to the end.' },
	] });
	const page = renderPage({ manifest, exampleHtml, navOrder: 1 });
	assert.ok(page.indexOf('## Attributes') < page.indexOf('## Markers'));
	assert.ok(page.indexOf('## Markers') < page.indexOf('## Children'));
	assert.ok(page.includes('| `data-span` | enum | `1`, `2` | `> *` | Shares of the row. |'));
	assert.ok(page.includes('| `data-split` | boolean |  |  | Pushed to the end. |'));
});

test('renderPage spells a required-attribute alternation with "or"', () => {
	const manifest = validManifest({ a11y: { requiredAttributes: ['role', 'aria-label | aria-labelledby'], keyboard: [] } });
	const page = renderPage({ manifest, exampleHtml, navOrder: 1 });
	assert.ok(page.includes('- Required attributes: `role`, `aria-label` or `aria-labelledby`'));
});

test('escapeAttribute escapes exactly what an attribute value needs and round-trips', () => {
	const raw = '<a href="x" data-q=\'y\'>a & b</a>';
	const escaped = escapeAttribute(raw);
	assert.equal(escaped, '&lt;a href=&quot;x&quot; data-q=&#39;y&#39;&gt;a &amp; b&lt;/a&gt;');
	const back = escaped.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
	assert.equal(back, raw);
});

test('renderDemo frames the example with the stylesheet ahead of it and fences it under a details', () => {
	const out = renderDemo({ title: 'Rail', exampleHtml: '<div class="rail"><p>One</p></div>', stylesheet: '/yeti/yeti.css' });
	assert.ok(out.startsWith('<figure class="demo" data-height="lg">\n<div data-preview="Rail"><iframe title="Rail, live" srcdoc="'));
	assert.ok(out.includes('&lt;link rel=&quot;stylesheet&quot; href=&quot;/yeti/yeti.css&quot;&gt;'));
	assert.ok(out.includes('&lt;div class=&quot;rail&quot;&gt;'));
	// markdown="1" makes PHP Markdown Extra parse the fence instead of passing
	// the whole details through as one raw block.
	assert.ok(out.includes('\n<details markdown="1">\n'));
	// Blank lines separate the raw HTML from the fence, so Markdown parses the code.
	assert.ok(out.includes('</div>\n\n<details markdown="1">\n<summary>View Code</summary>\n\n```html\n<div class="rail"><p>One</p></div>\n```\n\n</details>\n</figure>'));
});

test('renderDemo takes the height and starting width the manifest asks for', () => {
	const out = renderDemo({ title: 'Table', exampleHtml: '<table class="table"></table>', stylesheet: '/yeti/yeti.css', height: 'xl', width: 'sm' });
	assert.ok(out.startsWith('<figure class="demo" data-height="xl" data-width="sm">'));
	assert.ok(renderDemo({ title: 'T', exampleHtml: '<p></p>', stylesheet: '/y.css', resize: 'both' }).startsWith('<figure class="demo" data-height="lg" data-resize="both">'));
	// Without a width the attribute is absent, so the box opens at the column's width.
	assert.ok(!renderDemo({ title: 'Table', exampleHtml: '<p></p>', stylesheet: '/yeti/yeti.css' }).includes('data-width'));
});

test('generateDocs sends its stylesheet option all the way into the frames', () => {
	const root = makeTree(validTree());
	generateDocs({ root, demoStylesheet: '/yeti/frame.css' });
	const page = fs.readFileSync(path.join(root, 'docs', 'rail.md'), 'utf8');
	assert.ok(page.includes('href=&quot;/yeti/frame.css&quot;'));
	// The module bundle is found beside the stylesheet, so it follows it.
	assert.ok(page.includes('src=&quot;/yeti/yeti.js&quot;'));
});

test('renderPage passes a manifest demo block through to the figure', () => {
	const page = renderPage({ manifest: { ...validManifest(), demo: { height: 'sm', width: 'md' } }, exampleHtml, navOrder: 1 });
	assert.ok(page.includes('<figure class="demo" data-height="sm" data-width="md">'));
});

test('renderDemo pads the frame body unless the demo bleeds', () => {
	const padded = renderDemo({ title: 'Seam', exampleHtml: '<p></p>', stylesheet: '/y.css' });
	assert.ok(padded.includes('padding:var(--yeti-space-md)'), 'a body padded by default');
	const bled = renderDemo({ title: 'Seam', exampleHtml: '<p></p>', stylesheet: '/y.css', bleed: true });
	assert.ok(bled.includes('margin:0;padding:0&quot;'), 'no padding when the demo bleeds');
	assert.ok(!bled.includes('yeti-space-md'), 'and the padded form is gone');
	assert.ok(!bled.includes('data-bleed'), 'the figure itself carries nothing for it');
});

test('renderDemo links the module bundle into every frame, beside the stylesheet', () => {
	const out = renderDemo({ title: 'Dialog', exampleHtml: '<p></p>', stylesheet: '/assets/y.css' });
	assert.ok(out.includes('&lt;link rel=&quot;stylesheet&quot; href=&quot;/assets/y.css&quot;&gt;&lt;script type=&quot;module&quot; src=&quot;/assets/yeti.js&quot;&gt;&lt;/script&gt;'));
});

test('renderDemo takes several stylesheets, so a themed host reuses the cached framework', () => {
	const out = renderDemo({ title: 'Card', exampleHtml: '<p></p>', stylesheet: ['/yeti/yeti.css', '/css/theme.css'] });
	assert.ok(out.includes('&lt;link rel=&quot;stylesheet&quot; href=&quot;/yeti/yeti.css&quot;&gt;&lt;link rel=&quot;stylesheet&quot; href=&quot;/css/theme.css&quot;&gt;'));
	// The first one places the base and the module bundle beside it.
	assert.ok(out.includes('&lt;base href=&quot;/yeti/&quot;&gt;'));
	assert.ok(out.includes('src=&quot;/yeti/yeti.js&quot;'));
});

test('renderDemo gives the module bundle the first stylesheet\'s cache key', () => {
	const out = renderDemo({ title: 'Card', exampleHtml: '<p></p>', stylesheet: ['/yeti/yeti.css?v=abc123', '/css/theme.css?v=abc123'] });
	assert.ok(out.includes('&lt;base href=&quot;/yeti/&quot;&gt;'));
	assert.ok(out.includes('src=&quot;/yeti/yeti.js?v=abc123&quot;'));
});

test('renderDemo keeps the srcdoc on one line, whatever the example does', () => {
	const out = renderDemo({ title: 'Dialog', exampleHtml: '<p>One</p>\n\n<p>Two</p>\n', stylesheet: '/yeti/yeti.css' });
	const srcdoc = out.match(/srcdoc="([^"]*)"/);
	assert.ok(srcdoc, 'no srcdoc attribute');
	assert.ok(!srcdoc[1].includes('\n'));
	assert.ok(srcdoc[1].includes('&lt;p&gt;One&lt;/p&gt;&#10;&#10;&lt;p&gt;Two&lt;/p&gt;'));
});

test('renderDemo points relative example URLs at the stylesheet folder with a base', () => {
	const out = renderDemo({ title: 'Card', exampleHtml: '<img src="trail.jpg" alt="">', stylesheet: '/assets/y.css' });
	assert.ok(out.includes('&lt;base href=&quot;/assets/&quot;&gt;'));
	assert.ok(out.indexOf('&lt;base href=&quot;/assets/&quot;&gt;') < out.indexOf('&lt;link rel=&quot;stylesheet&quot;'));
});

test('renderPage puts the demo where the bare example was and honours the stylesheet option', () => {
	const page = renderPage({ manifest: validManifest(), exampleHtml, navOrder: 1, demoStylesheet: '/assets/y.css' });
	assert.ok(page.includes('## Example\n\n<figure class="demo"'));
	assert.ok(page.includes('href=&quot;/assets/y.css&quot;'));
	assert.ok(page.includes('```html\n<div class="rail" data-gap="l"><p>One</p><p>Two</p></div>\n```'));
	assert.ok(!page.includes('## Example\n\n```html'));
});

test('renderPage defaults the demo stylesheet to the site path', () => {
	const page = renderPage({ manifest: validManifest(), exampleHtml, navOrder: 1 });
	assert.ok(page.includes('href=&quot;/yeti/yeti.css&quot;'));
});

test('renderAttributeTable gives one row per attribute with its values and its readers', () => {
	const merged = {
		rail: validManifest(),
		siding: validManifest({ name: 'siding', class: 'siding', attributes: [{ name: 'data-gap', type: 'enum', values: ['s', 'm', 'l'], description: 'Gap between items.' }] }),
		badge: validManifest({ name: 'badge', class: 'badge', kind: 'component' }),
	};
	const table = renderAttributeTable({ merged, kinds: ['layout'], label: 'Layout attributes' });
	assert.ok(table.startsWith('<div class="scroller" role="region" aria-label="Layout attributes" tabindex="0" markdown="1">'));
	assert.ok(table.includes('| Attribute | Values | Read by |'));
	// Alphabetical by attribute, then by reader, and the other kinds are left out.
	assert.ok(table.includes('| `data-count` | number | rail |'));
	assert.ok(table.includes('| `data-gap` | `s`, `m`, `l` | rail, siding |'));
	assert.ok(table.includes('| `data-wrap` | boolean | rail |'));
	assert.ok(!table.includes('badge'));
	assert.ok(table.indexOf('`data-count`') < table.indexOf('`data-gap`'));
});

test('renderAttributeTable gives readers with a different value list their own row', () => {
	const merged = {
		cluster: validManifest({
			name: 'cluster', class: 'cluster',
			attributes: [{ name: 'data-justify', type: 'enum', values: ['start', 'center', 'end', 'between', 'around', 'evenly'], description: 'Main-axis alignment.' }],
		}),
		columns: validManifest({
			name: 'columns', class: 'columns',
			attributes: [{ name: 'data-justify', type: 'enum', values: ['start', 'center', 'end', 'between', 'around', 'evenly'], description: 'Main-axis alignment.' }],
		}),
		scroller: validManifest({
			name: 'scroller', class: 'scroller',
			attributes: [{ name: 'data-justify', type: 'enum', values: ['start', 'center', 'end'], description: 'Where each item settles when data-snap is set.' }],
		}),
	};
	const table = renderAttributeTable({ merged, kinds: ['layout'], label: 'Layout attributes' });
	// Same attribute name, two rows: the full vocabulary's readers on one, the
	// scroller's narrower list on the other, right after it.
	assert.ok(table.includes('| `data-justify` | `start`, `center`, `end`, `between`, `around`, `evenly` | cluster, columns |'));
	assert.ok(table.includes('| `data-justify` | `start`, `center`, `end` | scroller |'));
	assert.equal(table.indexOf('`data-justify` | `start`, `center`, `end` |'), table.lastIndexOf('`data-justify` | `start`, `center`, `end` |'));
	const fullRow = table.indexOf('cluster, columns');
	const narrowRow = table.indexOf('| scroller |');
	assert.ok(fullRow < narrowRow, 'the full-vocabulary row comes first, the narrower one right after');
});

test('renderAttributeTable names the element a marker is carried on', () => {
	const merged = {
		rail: validManifest({ markers: [{ name: 'data-split', type: 'boolean', on: '> *', description: 'Pinned to the end.' }] }),
		siding: validManifest({ name: 'siding', class: 'siding', attributes: [], markers: [{ name: 'data-split', type: 'boolean', on: 'td, th', description: 'Also split.' }] }),
	};
	const table = renderAttributeTable({ merged, kinds: ['layout'], label: 'Layout attributes' });
	// The parentheses keep a selector's own comma out of the list of readers.
	assert.ok(table.includes('| `data-split` | boolean | rail (> *), siding (td, th) |'));
});

test('renderAttributeTable spells a string and a number attribute by their type', () => {
	const merged = { rail: validManifest({ attributes: [{ name: 'data-label', type: 'string', description: 'A name.' }, { name: 'data-count', type: 'number', description: 'How many.' }] }) };
	const table = renderAttributeTable({ merged, kinds: ['layout'], label: 'Layout attributes' });
	assert.ok(table.includes('| `data-label` | string | rail |'));
	assert.ok(table.includes('| `data-count` | number | rail |'));
});

test('replaceMarked puts the block between the markers and leaves the rest alone', () => {
	const markdown = `# Guide\n\nBefore.\n\n${ATTRIBUTES_START}\n\nold table\n\n${ATTRIBUTES_END}\n\nAfter.\n`;
	assert.equal(replaceMarked(markdown, 'new table'), `# Guide\n\nBefore.\n\n${ATTRIBUTES_START}\n\nnew table\n\n${ATTRIBUTES_END}\n\nAfter.\n`);
});

test('replaceMarked is idempotent', () => {
	const markdown = `${ATTRIBUTES_START}\n\nsame\n\n${ATTRIBUTES_END}\n`;
	assert.equal(replaceMarked(markdown, 'same'), markdown);
});

test('replaceMarked returns null when the markers are missing or reversed', () => {
	assert.equal(replaceMarked('# Guide\n', 'x'), null);
	assert.equal(replaceMarked(`${ATTRIBUTES_END}\n${ATTRIBUTES_START}\n`, 'x'), null);
});

/** A guide source: front matter for the stamp to follow, a heading, then a body. */
const guideSource = (title, body) => `---\nraw: true\ntitle: "${title}"\nnav_group: "Guides"\nnav_order: 1\n---\n\n# ${title}\n\n${body}`;
/** A rendered guide with its stamp line taken back off, for comparing against the source. */
const unstamp = (page) => page.replace(/^(---\n[\s\S]*?\n---\n)<!--[^\n]*-->\n/, '$1');

test('stampGuide puts the generated mark directly after the front matter', () => {
	const stamped = stampGuide('---\ntitle: "X"\n---\n\n# X\n', 'src/guides/x.md');
	assert.equal(stamped, `---\ntitle: "X"\n---\n${GENERATED_MARK} from src/guides/x.md. Do not edit. -->\n\n# X\n`);
	assert.equal(isGenerated(stamped), true);
	assert.equal(stampGuide('# No front matter\n', 'src/guides/x.md'), null);
});

test('frontMatterTitle reads the title a demo falls back to', () => {
	assert.equal(frontMatterTitle('---\nraw: true\ntitle: "Visibility"\nnav_order: 6\n---\n\n# V\n'), 'Visibility');
	assert.equal(frontMatterTitle('# No front matter\n'), '');
});

test('generateDocs renders every guide source into docs/guides and stamps it', () => {
	const root = makeTree(validTree({ 'src/guides/theming.md': guideSource('Theming', 'Prose only.\n') }));
	const r = generateDocs({ root });
	assert.deepEqual(r.errors, []);
	const page = fs.readFileSync(path.join(root, 'docs/guides/theming.md'), 'utf8');
	assert.ok(page.includes(`${GENERATED_MARK} from src/guides/theming.md. Do not edit. -->`));
	assert.equal(isGenerated(page), true);
	assert.ok(r.written.some((f) => f.endsWith(path.join('guides', 'theming.md'))));
});

test('a rendered guide is its source with the stamp and nothing else', () => {
	const source = guideSource('Theming', 'Prose, and a plain block.\n\n```html\n<div class="rail" data-gap="l"><p>x</p></div>\n```\n');
	const root = makeTree(validTree({ 'src/guides/theming.md': source }));
	generateDocs({ root });
	assert.equal(unstamp(fs.readFileSync(path.join(root, 'docs/guides/theming.md'), 'utf8')), source);
});

test('generateDocs fills the attribute markers in the guide that declares them, and never writes the source', () => {
	const root = makeTree(validTree({ 'src/guides/layouts.md': guideSource('Layouts', `${ATTRIBUTES_START}\n\nstale\n\n${ATTRIBUTES_END}\n`) }));
	const r = generateDocs({ root });
	assert.deepEqual(r.errors, []);
	const page = fs.readFileSync(path.join(root, 'docs/guides/layouts.md'), 'utf8');
	assert.ok(!page.includes('stale'));
	assert.ok(page.includes('| `data-gap` | `s`, `m`, `l` | rail |'));
	// The markers stay in the output, so a second run finds them again.
	assert.ok(page.includes(ATTRIBUTES_START) && page.includes(ATTRIBUTES_END));
	assert.ok(fs.readFileSync(path.join(root, 'src/guides/layouts.md'), 'utf8').includes('stale'));
});

test('generateDocs reports a guide source whose attribute markers are missing, and writes no page', () => {
	const root = makeTree(validTree({ 'src/guides/layouts.md': guideSource('Layouts', 'No markers here.\n') }));
	const r = generateDocs({ root });
	assert.equal(r.errors.length, 1);
	assert.match(r.errors[0].message, /yeti:attributes:start/);
	assert.ok(r.errors[0].file.endsWith(path.join('src', 'guides', 'layouts.md')));
	assert.ok(!fs.existsSync(path.join(root, 'docs/guides/layouts.md')));
});

test('generateDocs refuses a guide source with no front matter to stamp', () => {
	const root = makeTree(validTree({ 'src/guides/theming.md': '# Theming\n' }));
	const r = generateDocs({ root });
	assert.equal(r.errors.length, 1);
	assert.match(r.errors[0].message, /front matter/);
});

test('generateDocs deletes a rendered guide whose source is gone and keeps a page it never wrote', () => {
	const root = makeTree(validTree({
		'src/guides/theming.md': guideSource('Theming', 'Prose.\n'),
		'docs/guides/removed.md': `---\ntitle: "Removed"\n---\n${GENERATED_MARK} from src/guides/removed.md. Do not edit. -->\n`,
		'docs/guides/hand-written.md': '# Somebody else\'s page\n',
	}));
	const r = generateDocs({ root });
	assert.deepEqual(r.deleted.map((f) => path.relative(root, f)), ['docs/guides/removed.md']);
	assert.ok(fs.existsSync(path.join(root, 'docs/guides/hand-written.md')));
});

test('generateDocs renders the guides into --out and leaves this repo\'s docs alone', () => {
	const root = makeTree(validTree({ 'src/guides/theming.md': guideSource('Theming', 'Prose.\n') }));
	const outDir = path.join(makeTree({}), 'site');
	const r = generateDocs({ root, outDir });
	assert.deepEqual(r.errors, []);
	assert.ok(fs.existsSync(path.join(outDir, 'guides/theming.md')));
	assert.ok(!fs.existsSync(path.join(root, 'docs/guides/theming.md')));
});

test('every guide table names a kind the manifests actually use', () => {
	const kinds = new Set(Object.values(KIND_DIRS));
	for (const entry of GUIDE_TABLES) {
		for (const kind of entry.kinds) assert.ok(kinds.has(kind), `${kind} is not a manifest kind`);
	}
});

/** A guide with front matter and one h1, so a demo has a heading to be named after. */
const demoGuide = (body) => `---\nraw: true\ntitle: "Layouts"\n---\n\n# Layouts\n\n${body}`;
/** Every frame's accessible name, in the order the page shows them. */
const previews = (markdown) => [...markdown.matchAll(/<div data-preview="([^"]*)"/g)].map((m) => m[1]);
const at = { file: 'src/guides/layouts.md', line: 31 };

test('the demo vocabularies are the schema\'s own height and width lists', () => {
	const vocabulary = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schema/vocabulary.json'), 'utf8'));
	assert.deepEqual(DEMO_HEIGHTS, vocabulary.height);
	assert.deepEqual(DEMO_WIDTHS, vocabulary.width);
});

test('parseDemoFence reads a height, a width and both', () => {
	assert.deepEqual(parseDemoFence('', at), { options: {}, errors: [] });
	assert.deepEqual(parseDemoFence(' md xs both', at).options, { height: 'md', width: 'xs', resize: 'both' });
	assert.deepEqual(parseDemoFence(' sm', at).options, { height: 'sm' });
	assert.deepEqual(parseDemoFence(' 2xl', at).options, { width: '2xl' });
	assert.deepEqual(parseDemoFence(' both', at).options, { resize: 'both' });
});

test('parseDemoFence reads nocode, and refuses it twice', () => {
	// A demo whose markup is not the lesson, such as a control panel wired by a
	// script, shows the frame alone.
	assert.deepEqual(parseDemoFence(' xl md nocode', at).options, { height: 'xl', width: 'md', code: false });
	assert.match(parseDemoFence(' nocode nocode', at).errors[0].message, /nocode is given twice/);
});

test('renderDemo leaves out the code when code is false', () => {
	const out = renderDemo({ title: 'Mixer', exampleHtml: '<p>One</p>', stylesheet: '/y.css', code: false });
	assert.ok(!out.includes('<details'));
	assert.ok(!out.includes('View Code'));
	assert.ok(out.includes('<iframe title="Mixer, live"'));
	assert.ok(out.endsWith('</iframe></div>\n</figure>'));
});

test('parseDemoFence takes a size in both vocabularies as the height first, the width second', () => {
	// sm, md, lg and xl are in both lists, so their order is what decides.
	assert.deepEqual(parseDemoFence(' lg sm', at).options, { height: 'lg', width: 'sm' });
	// A name that can only be a width is one wherever it appears.
	assert.deepEqual(parseDemoFence(' xs lg', at).options, { width: 'xs', height: 'lg' });
});

test('parseDemoFence names the file and the line of a token it does not know', () => {
	const { options, errors } = parseDemoFence(' huge', at);
	assert.deepEqual(options, {});
	assert.equal(errors.length, 1);
	assert.equal(errors[0].file, 'src/guides/layouts.md');
	assert.equal(errors[0].line, 31);
	assert.match(errors[0].message, /unknown token huge/);
});

test('parseDemoFence refuses a second height, a second width, and a repeated both', () => {
	assert.match(parseDemoFence(' sm md lg', at).errors[0].message, /lg is a second height/);
	assert.match(parseDemoFence(' xs 2xs', at).errors[0].message, /2xs is a second width/);
	assert.match(parseDemoFence(' both both', at).errors[0].message, /both is given twice/);
});

test('headingText drops the markup a heading carries and a frame name cannot use', () => {
	assert.equal(headingText('`data-show` and the [container](../container.md)'), 'data-show and the container');
});

test('a demo takes its name from the nearest heading above it', () => {
	const body = '## Composing\n\n```html demo\n<p>One</p>\n```\n\n## The vocabulary\n\n```html demo\n<p>Two</p>\n```\n';
	const r = renderGuideDemos(demoGuide(body), { file: 'f', title: 'Layouts', stylesheet: '/yeti/yeti.css' });
	assert.deepEqual(r.errors, []);
	assert.deepEqual(previews(r.markdown), ['Composing', 'The vocabulary']);
});

test('a section with more than one demo numbers the rest, so no two frames share a name', () => {
	const body = '## Composing\n\n```html demo\n<p>One</p>\n```\n\n```html demo\n<p>Two</p>\n```\n\n```html demo\n<p>Three</p>\n```\n';
	const r = renderGuideDemos(demoGuide(body), { file: 'f', title: 'Layouts', stylesheet: '/yeti/yeti.css' });
	assert.deepEqual(previews(r.markdown), ['Composing', 'Composing (2)', 'Composing (3)']);
});

test('a demo above every heading takes the page title', () => {
	const markdown = '---\ntitle: "Visibility"\n---\n\n```html demo\n<p>a</p>\n```\n\n### `data-show`\n\n```html demo\n<p>b</p>\n```\n';
	const r = renderGuideDemos(markdown, { file: 'f', title: 'Visibility', stylesheet: '/yeti/yeti.css' });
	assert.deepEqual(previews(r.markdown), ['Visibility', 'data-show']);
});

test('a plain html block is left exactly as it was', () => {
	const source = demoGuide('## Composing\n\n```html\n<div class="rail"><p>x</p></div>\n```\n');
	const r = renderGuideDemos(source, { file: 'f', title: 'Layouts', stylesheet: '/yeti/yeti.css' });
	assert.equal(r.markdown, source);
	assert.deepEqual(r.errors, []);
});

test('a heading inside a fenced block is code, not a heading', () => {
	const body = '## Composing\n\n```markdown\n## Not a heading\n```\n\n```html demo\n<p>One</p>\n```\n';
	const r = renderGuideDemos(demoGuide(body), { file: 'f', title: 'Layouts', stylesheet: '/yeti/yeti.css' });
	assert.deepEqual(previews(r.markdown), ['Composing']);
});

test('a heading inside a tilde-fenced block is code, not a heading', () => {
	const body = '## Composing\n\n~~~markdown\n## Not a heading\n~~~\n\n```html demo\n<p>One</p>\n```\n';
	const r = renderGuideDemos(demoGuide(body), { file: 'f', title: 'Layouts', stylesheet: '/yeti/yeti.css' });
	assert.deepEqual(previews(r.markdown), ['Composing']);
});

test('an indented demo fence is an error naming the file and the line, not a silently skipped block', () => {
	const markdown = '## Composing\n\n> ```html demo\n> <p>One</p>\n> ```\n';
	const r = renderGuideDemos(markdown, { file: 'src/guides/responsive.md', title: 'Layouts', stylesheet: '/y.css' });
	assert.equal(r.errors.length, 1);
	assert.equal(r.errors[0].file, 'src/guides/responsive.md');
	assert.equal(r.errors[0].line, 3);
	assert.match(r.errors[0].message, /left margin/);
});

test('an indented plain html fence is not an error', () => {
	const markdown = '## Composing\n\n  ```html\n  <p>One</p>\n  ```\n';
	const r = renderGuideDemos(markdown, { file: 'f', title: 'Layouts', stylesheet: '/y.css' });
	assert.deepEqual(r.errors, []);
});

test('renderGuideDemos reports a demo fence that is never closed', () => {
	const r = renderGuideDemos(demoGuide('## Composing\n\n```html demo\n<p>One</p>\n'), { file: 'src/guides/layouts.md', title: 'Layouts', stylesheet: '/y.css' });
	assert.equal(r.errors.length, 1);
	assert.equal(r.errors[0].line, 10);
	assert.match(r.errors[0].message, /never closed/);
});

test('generateDocs renders a demo fence in a guide as the figure component pages use', () => {
	const root = makeTree(validTree({
		'src/guides/theming.md': guideSource('Theming', '## Composing\n\n```html demo sm xs both\n<div class="rail" data-gap="l"><p>One</p></div>\n```\n'),
	}));
	const r = generateDocs({ root, demoStylesheet: '/assets/y.css' });
	assert.deepEqual(r.errors, []);
	const page = fs.readFileSync(path.join(root, 'docs/guides/theming.md'), 'utf8');
	assert.ok(page.includes('<figure class="demo" data-height="sm" data-width="xs" data-resize="both">'));
	assert.ok(page.includes('<div data-preview="Composing"><iframe title="Composing, live" srcdoc="'));
	assert.ok(page.includes('href=&quot;/assets/y.css&quot;'));
	// The code is still under the frame, so a renderer that strips iframes shows it.
	assert.ok(page.includes('```html\n<div class="rail" data-gap="l"><p>One</p></div>\n```'));
	// And the source keeps the fence it was written with.
	assert.ok(fs.readFileSync(path.join(root, 'src/guides/theming.md'), 'utf8').includes('```html demo sm xs both'));
});

test('generateDocs reports a bad demo info string at its line and writes no page', () => {
	const root = makeTree(validTree({
		'src/guides/theming.md': guideSource('Theming', '## Composing\n\n```html demo enormous\n<p>x</p>\n```\n'),
	}));
	const r = generateDocs({ root });
	assert.equal(r.errors.length, 1);
	assert.equal(r.errors[0].line, 12);
	assert.match(r.errors[0].message, /unknown token enormous/);
	assert.ok(r.errors[0].file.endsWith(path.join('src', 'guides', 'theming.md')));
	assert.ok(!fs.existsSync(path.join(root, 'docs/guides/theming.md')));
});
