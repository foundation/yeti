import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompact, renderFull } from '../../bin/gen-llms.js';

const pkg = { name: '@foundation/yeti', version: '7.0.0-beta.0', homepage: 'https://foundationcss.com/yeti/' };
const merged = {
	rail: {
		name: 'rail', kind: 'layout', class: 'rail', description: 'A horizontal rail of items with a shared gap.',
		attributes: [
			{ name: 'data-gap', type: 'enum', vocabulary: 'gap', values: ['s', 'm', 'l'], default: 'm', description: 'Gap between items.' },
			{ name: 'data-wrap', type: 'boolean', description: 'Allow items to wrap.' },
		],
		markers: [{ name: 'data-span', type: 'enum', values: ['1', '2'], on: '> *', description: 'Shares of the row.' }],
		classes: [], children: [{ selector: '> *', min: 1, max: null, description: 'The items.' }], tokens: [{ name: '--rail-gap', public: true, description: 'The gap.' }],
		a11y: { requiredAttributes: ['aria-label | aria-labelledby'], keyboard: [{ key: 'Tab', action: 'Moves between items.' }], notes: 'Give it a name.' },
		js: [{ module: 'rail.js', optional: true, events: [{ name: 'yeti:slide', detail: '{ index }', description: 'The rail moved.' }] }], support: { unguarded: ['flexbox'], guarded: [] }, since: '7.0.0', example: 'example.html',
	},
	pill: {
		name: 'pill', kind: 'component', class: 'pill', description: 'A pill.',
		attributes: [], markers: [], classes: [], children: [], tokens: [], a11y: { requiredAttributes: [], keyboard: [] }, js: null, support: { unguarded: [], guarded: [] }, since: '7.0.0', example: 'example.html',
	},
};
const tokens = [{ name: '--yeti-space-md', group: 'space', public: true, default: '1rem', description: 'Medium space.' }];
const docs = { rail: '## When to use it\n\nA row of things.\n' };

test('the compact file names every component once with its class, kind and attributes', () => {
	const out = renderCompact(merged, pkg);
	assert.equal(out.match(/^## rail /gm).length, 1);
	assert.equal(out.match(/^## pill /gm).length, 1);
	assert.ok(out.includes('## rail (layout, class="rail")'));
	assert.ok(out.includes('- data-gap: s | m (default) | l — Gap between items.'));
	assert.ok(out.includes('- data-wrap (boolean) — Allow items to wrap.'));
	assert.ok(out.includes('- data-span on > *: 1 | 2 — Shares of the row.'));
	assert.ok(out.includes('module: rail.js (optional)'));
	assert.ok(out.indexOf('## rail') < out.indexOf('## pill'), 'layouts come before components');
});

test('the compact file names each module and the events it dispatches', () => {
	const out = renderCompact(merged, pkg);
	assert.ok(out.includes('module: rail.js (optional)'));
	assert.ok(out.includes('- event yeti:slide with detail { index } — The rail moved.'));
});

test('the compact file opens with the framework name, version and the three-part model', () => {
	const out = renderCompact(merged, pkg);
	assert.ok(out.startsWith('# Yeti 7.0.0-beta.0\n'));
	assert.ok(out.includes('identity is a class'));
	assert.ok(!out.includes('When to use it'), 'no docs fragments in the compact file');
});

test('the full file adds the docs fragment, accessibility, children and the token catalogue', () => {
	const out = renderFull(merged, tokens, docs, pkg);
	assert.ok(out.includes('A row of things.'));
	assert.ok(out.includes('Required: aria-label | aria-labelledby'));
	assert.ok(out.includes('- Tab: Moves between items.'));
	assert.ok(out.includes('Give it a name.'));
	assert.ok(out.includes('- > *: at least 1. The items.'));
	assert.ok(out.includes('--yeti-space-md (space): 1rem — Medium space.'));
	assert.ok(out.includes('- --rail-gap — The gap.'));
});

test("the generated accessibility block is labelled apart from a fragment's own heading", () => {
	const out = renderFull(merged, tokens, docs, pkg);
	assert.ok(out.includes('Accessibility contract:'));
	assert.ok(!out.includes('\nAccessibility:\n'), 'a bare label reads as the fragment\'s own section');
});

test('every enumerated value appears and the default is marked exactly once per attribute', () => {
	const out = renderCompact(merged, pkg);
	const line = out.split('\n').find((l) => l.startsWith('- data-gap:'));
	for (const v of ['s', 'm', 'l']) assert.ok(line.includes(v));
	assert.equal((line.match(/\(default\)/g) || []).length, 1);
});

test('the preamble says what an agent gets wrong without it', () => {
	for (const out of [renderCompact(merged, pkg), renderFull(merged, tokens, docs, pkg)]) {
		assert.ok(out.includes('Never set or read `--_yeti-*`'), 'private tokens');
		assert.ok(out.includes('color-scheme: dark'), 'a dark region');
		assert.ok(out.includes('--yeti-link-color'), 'link color');
		assert.ok(out.includes('`@layer yeti.theme`'), 'where a rule goes');
	}
});

test('the compact file lists the children a component needs and every public token by name', () => {
	const out = renderCompact(merged, pkg, tokens);
	assert.ok(out.includes('- > *: at least 1. The items.'));
	assert.ok(out.includes('--yeti-space-md'));
});

test('the compact file links the guides and the full file carries them', () => {
	const guides = [{ name: 'color', title: 'Color', body: '---\ntitle: "Color"\n---\n\n# Color\n\nForce a scheme.\n' }];
	const compact = renderCompact(merged, pkg, tokens, guides);
	assert.ok(compact.includes('- Color: https://foundationcss.com/yeti/guides/color/'));
	const full = renderFull(merged, tokens, docs, pkg, guides);
	assert.ok(full.includes('## Guide: Color'));
	assert.ok(full.includes('Force a scheme.'));
	assert.ok(!full.includes('title: "Color"'), 'front matter is dropped');
});

test('the compact file gives the address of the full file at its own version', () => {
	assert.ok(renderCompact(merged, pkg).includes('https://cdn.jsdelivr.net/npm/@foundation/yeti@7.0.0-beta.0/dist/llms-full.txt'));
});
