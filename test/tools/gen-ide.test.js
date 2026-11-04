import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { collectAttributes, htmlData, webTypes } from '../../bin/gen-ide.js';
import { loadSchema, loadAndMerge, loadVocabulary } from '../../bin/lib/manifest.js';
import { REPO_ROOT } from './helpers.js';

const vocabulary = { gap: ['s', 'm', 'l'], span: ['1', '2'] };
const merged = {
	rail: {
		name: 'rail', kind: 'layout', class: 'rail', description: 'A horizontal rail.',
		attributes: [
			{ name: 'data-gap', type: 'enum', vocabulary: 'gap', values: ['s', 'm', 'l'], default: 'm', description: 'Gap between items.' },
			{ name: 'data-wrap', type: 'boolean', description: 'Allow items to wrap.' },
		],
		markers: [{ name: 'data-span', type: 'enum', vocabulary: 'span', values: ['1', '2'], on: '> *', description: 'Shares of the row the child takes.' }],
		classes: [], children: [], tokens: [], a11y: { requiredAttributes: [], keyboard: [] }, js: null, support: { unguarded: [], guarded: [] }, since: '7.0.0', example: 'example.html',
	},
	pill: {
		name: 'pill', kind: 'component', class: 'pill', description: 'A pill.',
		attributes: [{ name: 'data-gap', type: 'enum', vocabulary: 'gap', values: ['s', 'm', 'l'], default: 's', description: 'Space inside.' }],
		classes: [], children: [], tokens: [], a11y: { requiredAttributes: [], keyboard: [] }, js: null, support: { unguarded: [], guarded: [] }, since: '7.0.0', example: 'example.html',
	},
};

// The same fixture with one meaning for data-gap, for the shared-description case.
const shared = {
	rail: merged.rail,
	pill: { ...merged.pill, attributes: [{ ...merged.pill.attributes[0], description: 'Gap between items.' }] },
};

test('collectAttributes merges an attribute shared by two components and keeps markers apart by element', () => {
	const map = collectAttributes(merged);
	assert.deepEqual([...map.keys()].sort(), ['data-gap', 'data-span', 'data-wrap']);
	assert.deepEqual(map.get('data-gap').uses.map((u) => u.component), ['rail', 'pill']);
	assert.equal(map.get('data-span').uses[0].on, '> *');
	assert.equal(map.get('data-wrap').type, 'boolean');
});

test('htmlData emits one value set per used vocabulary', () => {
	const out = htmlData(merged, vocabulary);
	assert.equal(out.version, 1.1);
	assert.deepEqual(out.valueSets.map((s) => s.name).sort(), ['yeti-gap', 'yeti-span']);
	assert.deepEqual(out.valueSets.find((s) => s.name === 'yeti-gap').values.map((v) => v.name), ['s', 'm', 'l']);
});

test('htmlData emits one global attribute per name', () => {
	const out = htmlData(merged, vocabulary);
	const names = out.globalAttributes.map((a) => a.name);
	assert.deepEqual(names.sort(), ['data-gap', 'data-span', 'data-wrap']);
	assert.equal(names.length, new Set(names).size);
});

test('htmlData descriptions open with the components that accept the attribute', () => {
	const out = htmlData(shared, vocabulary);
	const gap = out.globalAttributes.find((a) => a.name === 'data-gap');
	assert.equal(gap.description, 'rail, pill: Gap between items.');
});

test('an attribute described differently by two components carries both descriptions', () => {
	const out = htmlData(merged, vocabulary);
	const gap = out.globalAttributes.find((a) => a.name === 'data-gap');
	assert.ok(gap.description.includes('rail: Gap between items.'), gap.description);
	assert.ok(gap.description.includes('pill: Space inside.'), gap.description);
	assert.ok(!gap.description.includes('.;'), 'a description already ends its own sentence');
});

test('an enumerated attribute names the value set its values live in', () => {
	const out = htmlData(merged, vocabulary);
	assert.equal(out.globalAttributes.find((a) => a.name === 'data-gap').valueSet, 'yeti-gap');
});

test("a marker's description names the element it lives on", () => {
	const out = htmlData(merged, vocabulary);
	const span = out.globalAttributes.find((a) => a.name === 'data-span');
	assert.ok(span.description.startsWith('rail, on a child (> *): '), span.description);
});

test('a boolean attribute carries no value set', () => {
	const out = htmlData(merged, vocabulary);
	const wrap = out.globalAttributes.find((a) => a.name === 'data-wrap');
	assert.equal(wrap.valueSet, undefined);
	assert.ok(wrap.description.length > 0);
});

test('every enumerated attribute references a value set that exists', () => {
	const out = htmlData(merged, vocabulary);
	const sets = new Set(out.valueSets.map((s) => s.name));
	const enumerated = out.globalAttributes.filter((a) => a.valueSet);
	assert.equal(enumerated.length, 2, 'data-gap and data-span are enumerated; a count keeps this from passing vacuously');
	for (const a of enumerated) assert.ok(sets.has(a.valueSet), a.name);
});

// The fixture cannot prove the generator handles the real manifest's shapes:
// the inline-values enum that shipped without a value set passed every test
// above. This runs the generator over what the package actually ships.
//
// A name two components share for different value lists (data-justify: the
// full vocabulary on cluster and columns, three values on scroller) makes the
// shared set a superset of any one reader's own list, not an exact match:
// editor completion cannot know which class an element carries, so it offers
// every value any reader accepts. The check is containment, not equality.
test('every enumerated attribute in the real manifest carries a value set holding its values', () => {
	const schema = loadSchema(path.join(REPO_ROOT, 'schema/manifest.schema.json'));
	const vocab = loadVocabulary(path.join(REPO_ROOT, 'schema/vocabulary.json'));
	const { merged: real, errors } = loadAndMerge(path.join(REPO_ROOT, 'src'), schema, vocab);
	assert.deepEqual(errors, []);
	const out = htmlData(real, vocab);
	const sets = new Map(out.valueSets.map((set) => [set.name, set.values.map((v) => v.name)]));
	const emitted = new Map(out.globalAttributes.map((a) => [a.name, a]));
	let checked = 0;
	for (const component of Object.values(real)) {
		for (const attr of [...component.attributes, ...component.markers]) {
			if (attr.type !== 'enum') continue;
			const where = `${component.name} ${attr.name}`;
			const set = emitted.get(attr.name).valueSet;
			assert.ok(set, where);
			for (const v of attr.values) assert.ok(sets.get(set).includes(v), `${where}: ${v} missing from its value set`);
			checked += 1;
		}
	}
	assert.ok(checked > 50, `only ${checked} enumerated attributes and markers were checked`);
});

test('collectAttributes merges an enum shared by two components into the union of their values', () => {
	const withVocabFirst = {
		cluster: {
			name: 'cluster', kind: 'layout', class: 'cluster', description: 'A cluster.',
			attributes: [{ name: 'data-justify', type: 'enum', vocabulary: 'justify', values: ['start', 'center', 'end', 'between', 'around', 'evenly'], description: 'Main-axis alignment.' }],
			classes: [], children: [], tokens: [], a11y: { requiredAttributes: [], keyboard: [] }, js: null, support: { unguarded: [], guarded: [] }, since: '7.0.0', example: 'example.html',
		},
		scroller: {
			name: 'scroller', kind: 'layout', class: 'scroller', description: 'A scroller.',
			attributes: [{ name: 'data-justify', type: 'enum', values: ['start', 'center', 'end'], description: 'Where each item settles.' }],
			classes: [], children: [], tokens: [], a11y: { requiredAttributes: [], keyboard: [] }, js: null, support: { unguarded: [], guarded: [] }, since: '7.0.0', example: 'example.html',
		},
	};
	// The narrower reader first, so the union only holds if merging appends
	// rather than only ever keeping whichever attribute is seen first.
	const withValuesFirst = { scroller: withVocabFirst.scroller, cluster: withVocabFirst.cluster };
	for (const merged of [withVocabFirst, withValuesFirst]) {
		const out = htmlData(merged, { justify: ['start', 'center', 'end', 'between', 'around', 'evenly'] });
		const attr = out.globalAttributes.find((a) => a.name === 'data-justify');
		assert.equal(out.globalAttributes.filter((a) => a.name === 'data-justify').length, 1);
		assert.deepEqual(out.valueSets.find((s) => s.name === attr.valueSet).values.map((v) => v.name), ['start', 'center', 'end', 'between', 'around', 'evenly']);
	}
});

test('an enum with inline values and no vocabulary still gets a value set', () => {
	const withInline = {
		tabs: {
			name: 'tabs', kind: 'component', class: 'tabs', description: 'A tab list.',
			attributes: [{ name: 'data-orientation', type: 'enum', values: ['horizontal', 'vertical'], default: 'horizontal', description: 'Layout direction.' }],
			classes: [], children: [], tokens: [], a11y: { requiredAttributes: [], keyboard: [] }, js: null, support: { unguarded: [], guarded: [] }, since: '7.0.0', example: 'example.html',
		},
	};
	const html = htmlData(withInline, {});
	const attr = html.globalAttributes.find((a) => a.name === 'data-orientation');
	assert.equal(attr.valueSet, 'yeti-data-orientation');
	assert.deepEqual(html.valueSets.find((s) => s.name === 'yeti-data-orientation').values.map((v) => v.name), ['horizontal', 'vertical']);

	const types = webTypes(withInline, {}, { name: '@foundation/yeti', version: '7.0.0-beta.0' });
	const wtAttr = types.contributions.html.attributes.find((a) => a.name === 'data-orientation');
	assert.deepEqual(wtAttr.values.map((v) => v.name), ['horizontal', 'vertical']);
});

test('webTypes carries the package name and version and lists values for enumerated attributes', () => {
	const out = webTypes(merged, vocabulary, { name: '@foundation/yeti', version: '7.0.0-beta.0' });
	assert.equal(out.name, '@foundation/yeti');
	assert.equal(out.version, '7.0.0-beta.0');
	const attrs = out.contributions.html.attributes;
	const gap = attrs.find((a) => a.name === 'data-gap');
	assert.deepEqual(gap.values.map((v) => v.name), ['s', 'm', 'l']);
	assert.equal(gap.description, 'rail: Gap between items. pill: Space inside.');
	const wrap = attrs.find((a) => a.name === 'data-wrap');
	assert.equal(wrap.values, undefined);
	assert.equal(wrap.value.type, 'boolean');
});
