import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { typeName, renderTypes, renderModuleTypes } from '../../bin/gen-types.js';
import { SCHEMA_PATH, TOKENS_SCHEMA_PATH } from './helpers.js';

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const tokensSchema = JSON.parse(fs.readFileSync(TOKENS_SCHEMA_PATH, 'utf8'));

/** The field names declared inside one emitted interface, optional marker stripped. */
function fieldsOf(out, name) {
	const start = out.indexOf(`export interface ${name} {`);
	assert.ok(start >= 0, `${name} is not emitted`);
	const body = out.slice(out.indexOf('\n', start) + 1, out.indexOf('\n}', start));
	return new Set(body.split('\n').map((line) => line.trim().replace(/\??:.*$/, '')));
}

const vocabulary = { gap: ['s', 'm', 'l'], 'width-or-none': ['none', 'sm'] };
const merged = {
	rail: {
		name: 'rail', kind: 'layout', class: 'rail', description: 'A rail.',
		attributes: [{ name: 'data-gap', type: 'enum', vocabulary: 'gap', values: ['s', 'm', 'l'], default: 'm', description: 'Gap.' }],
		markers: [], classes: [], children: [], tokens: [], a11y: { requiredAttributes: [], keyboard: [] }, js: null, support: { unguarded: [], guarded: [] }, since: '7.0.0', example: 'example.html',
	},
	pill: {
		name: 'pill', kind: 'component', class: 'pill', description: 'A pill.',
		attributes: [], markers: [], classes: [], children: [], tokens: [], a11y: { requiredAttributes: [], keyboard: [] }, js: [{ module: 'pill.js', optional: true }], support: { unguarded: [], guarded: [] }, since: '7.0.0', example: 'example.html',
	},
};

test('typeName turns a vocabulary name into a PascalCase Yeti type', () => {
	assert.equal(typeName('gap'), 'YetiGap');
	assert.equal(typeName('width-or-none'), 'YetiWidthOrNone');
	assert.equal(typeName('size-control'), 'YetiSizeControl');
});

test('renderTypes emits one string union per vocabulary and a union of component names', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	assert.ok(out.includes("export type YetiGap = 's' | 'm' | 'l';"));
	assert.ok(out.includes("export type YetiWidthOrNone = 'none' | 'sm';"));
	assert.ok(out.includes("export type YetiComponentName = 'rail' | 'pill';"));
});

test('renderTypes types the manifest and token catalogue shapes', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	for (const name of ['YetiAttribute', 'YetiMarker', 'YetiToken', 'YetiChild', 'YetiA11y', 'YetiModule', 'YetiEvent', 'YetiComponent', 'YetiManifest', 'YetiTokenEntry', 'YetiTokenCatalogue']) {
		assert.ok(out.includes(`export interface ${name}`) || out.includes(`export type ${name}`), name);
	}
	assert.ok(out.includes('components: Record<YetiComponentName, YetiComponent>;'));
});

test('renderTypes augments no module, since @foundation/yeti/manifest resolves to JSON', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	assert.ok(!out.includes('declare module'), 'a module augmentation of a JSON specifier is a compile error');
});

test('renderModuleTypes declares one JSON entry point against a type from yeti.d.ts', () => {
	const out = renderModuleTypes('YetiManifest', 'manifest');
	assert.ok(out.includes("import type { YetiManifest } from './yeti.js';"));
	assert.ok(out.includes('declare const manifest: YetiManifest;'));
	assert.ok(out.includes('export default manifest;'));
});

test('YetiComponent declares every property the manifest schema does', () => {
	const fields = fieldsOf(renderTypes(merged, vocabulary, tokensSchema), 'YetiComponent');
	for (const key of Object.keys(schema.properties)) assert.ok(fields.has(key), key);
});

test('YetiAttribute declares every property the schema\'s attribute definition does', () => {
	const fields = fieldsOf(renderTypes(merged, vocabulary, tokensSchema), 'YetiAttribute');
	for (const key of Object.keys(schema.$defs.attribute.properties)) assert.ok(fields.has(key), key);
});

test('YetiMarker declares every property the schema\'s marker definition does', () => {
	const fields = fieldsOf(renderTypes(merged, vocabulary, tokensSchema), 'YetiMarker');
	for (const key of Object.keys(schema.$defs.marker.properties)) assert.ok(fields.has(key), key);
});

test('YetiChild declares every property the schema\'s child definition does', () => {
	const fields = fieldsOf(renderTypes(merged, vocabulary, tokensSchema), 'YetiChild');
	for (const key of Object.keys(schema.$defs.child.properties)) assert.ok(fields.has(key), key);
});

test('YetiToken declares every property the schema\'s token definition does', () => {
	const fields = fieldsOf(renderTypes(merged, vocabulary, tokensSchema), 'YetiToken');
	for (const key of Object.keys(schema.$defs.token.properties)) assert.ok(fields.has(key), key);
});

test('YetiTokenEntry types group as the closed list of group names in the tokens schema', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	const expected = tokensSchema.items.properties.group.enum.map((g) => `'${g}'`).join(' | ');
	assert.ok(out.includes(`\tgroup: ${expected};`), 'group is not the schema enum');
});

test('a component types its modules as a list, with optional as the const true the schema requires', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	assert.ok(out.includes('js: YetiModule[] | null;'));
	assert.ok(out.includes('\toptional: true;'));
});

test('YetiModule and YetiEvent declare every property their schema definitions do', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	for (const key of Object.keys(schema.$defs.module.properties)) assert.ok(fieldsOf(out, 'YetiModule').has(key), key);
	for (const key of Object.keys(schema.$defs.event.properties)) assert.ok(fieldsOf(out, 'YetiEvent').has(key), key);
});

test('markers is not optional, because the loader always normalises it to a list', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	assert.ok(out.includes('\tmarkers: YetiMarker[];'));
	assert.ok(!out.includes('\tmarkers?:'));
});

test('renderTypes types match the schema\'s optional and typed fields', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	assert.ok(out.includes('role?: string;'));
	assert.ok(out.includes("type: 'boolean'; description: string }>;"));
	assert.ok(out.includes('description?: string;'));
	assert.ok(out.includes('default?: string | number | boolean;'));
});

test('renderTypes output is structurally sound: balanced braces and every export named', () => {
	const out = renderTypes(merged, vocabulary, tokensSchema);
	const opens = (out.match(/\{/g) || []).length;
	const closes = (out.match(/\}/g) || []).length;
	assert.equal(opens, closes);
	for (const line of out.split('\n').filter((l) => l.startsWith('export '))) {
		assert.match(line, /^export (type|interface) Yeti[A-Za-z]+/, line);
	}
});
