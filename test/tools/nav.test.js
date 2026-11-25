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

// More: how many of the bar's items stay in it. Each case is the widths of
// the items, the gap between them, the More button's width and the room.
const { inBar, inBottomBar } = context;

test('every item fits: all stay, and More is not needed', () => {
	assert.equal(inBar([100, 100, 100], 10, 60, 320), 3);
	assert.equal(inBar([100, 100, 100], 10, 60, 1000), 3);
	assert.equal(inBar([], 10, 60, 0), 0);
});

test('an exact fit is a fit, with or without More', () => {
	// 100 + 10 + 100 + 10 + 100 is the room exactly.
	assert.equal(inBar([100, 100, 100], 10, 60, 320), 3);
	// Two items, their gaps and More are 100 + 10 + 100 + 10 + 60.
	assert.equal(inBar([100, 100, 100], 10, 60, 280), 2);
	assert.equal(inBar([100, 100, 100], 10, 60, 279.9), 1);
});

test('fractional widths do not lose an item at an exact fit', () => {
	// 0.1 + 0.2 is not 0.3 in floating point; the sum must still fit.
	assert.equal(inBar([0.1, 0.2, 33.4], 0, 0, 33.7), 3);
	assert.equal(inBar([33.3, 33.3, 33.4], 0, 20, 100), 3);
	// Two items, two gaps and More: 33.3 + 0.1 + 33.3 + 0.1 + 20.
	assert.equal(inBar([33.3, 33.3, 33.4], 0.1, 20, 86.8), 2);
	assert.equal(inBar([33.3, 33.3, 33.4], 0.1, 20, 86.7), 1);
});

test('otherwise the count is the most items that fit with More after them', () => {
	assert.equal(inBar([100, 100, 100], 10, 60, 319), 2);
	assert.equal(inBar([100, 100, 100], 10, 60, 200), 1);
	assert.equal(inBar([50, 200, 50], 10, 60, 300), 1);
});

test('the count may be none, leaving only More', () => {
	assert.equal(inBar([100, 100, 100], 10, 60, 169), 0);
	assert.equal(inBar([100, 100, 100], 10, 60, 20), 0);
});

test('More\'s own width is part of the decision, so a count that fits only without More is not chosen', () => {
	// Three fit without More at 320, but not at 319; with More only two fit.
	assert.equal(inBar([100, 100, 100], 10, 60, 319), 2);
	// At 320 all three fit without More, so More's width does not count.
	assert.equal(inBar([100, 100, 100], 10, 60, 320), 3);
});

test('a bottom bar keeps five items or fewer, and with more keeps four and More', () => {
	assert.equal(inBottomBar(0), 0);
	assert.equal(inBottomBar(3), 3);
	assert.equal(inBottomBar(5), 5);
	assert.equal(inBottomBar(6), 4);
	assert.equal(inBottomBar(12), 4);
});
