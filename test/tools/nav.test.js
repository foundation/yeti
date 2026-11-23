import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// nav.js is a plain script that wires itself to the page as it loads, so it
// runs here against a page that ignores listeners; its top-level functions are
// then globals of the context.
const source = readFileSync(new URL('../../src/components/nav/nav.js', import.meta.url), 'utf8');
const context = vm.createContext({ document: { addEventListener: () => {} } });
vm.runInContext(source, context);
const { startsOpen } = context;

test('a group opens on first sight only when it holds the current page', () => {
	assert.equal(startsOpen(undefined, true), true);
	assert.equal(startsOpen(undefined, false), false);
});

test('what the reader chose wins over the current page', () => {
	assert.equal(startsOpen(false, true), false);
	assert.equal(startsOpen(true, false), true);
});
