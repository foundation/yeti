import { test, expect } from 'playwright/test';
import { open, stage, style, token, px, rects, expectNoChildMargins, axe } from '../lib/layout.js';

const columns = async (page, selector) => (await style(page, selector, 'grid-template-columns')).trim().split(/\s+/).length;
const expected = (width, min, gap) => Math.floor((width + gap) / (min + gap));
const perRow = (rs) => { const tops = [...new Set(rs.map((r) => Math.round(r.top)))].sort((a, b) => a - b); return rs.filter((r) => Math.round(r.top) === tops[0]).length; };

test.describe('grid', () => {
	test('fits as many columns as the minimum allows', async ({ page }) => {
		await open(page, 'grid', 1000);
		const [min, gap] = await Promise.all([token(page, '--yeti-width-xs'), token(page, '--yeti-space-md')]);
		expect(await columns(page, '#grid')).toBe(expected(1000, min, gap));
		await stage(page, 500);
		expect(await columns(page, '#grid')).toBe(expected(500, min, gap));
	});

	test('data-columns caps the count and still shrinks below it', async ({ page }) => {
		await open(page, 'grid', 1000);
		expect(await columns(page, '#capped')).toBe(3);
		await stage(page, 300);
		expect(await columns(page, '#capped')).toBe(1);
	});

	test('data-min="none" with data-columns gives an exact count', async ({ page }) => {
		await open(page, 'grid', 300);
		expect(await columns(page, '#exact')).toBe(3);
		await stage(page, 1000);
		expect(await columns(page, '#exact')).toBe(3);
	});

	test('data-min="none" without data-columns gives a single column, not a runaway count', async ({ page }) => {
		await open(page, 'grid', 1000);
		expect(await columns(page, '#loose')).toBe(1);
	});

	test('data-min="3xs" puts two abreast in a phone-wide container, where the default gives one', async ({ page }) => {
		await open(page, 'grid', 320);
		const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
		expect(await token(page, '--yeti-width-3xs')).toBeCloseTo(8 * rem, 1);
		expect(await columns(page, '#tight')).toBe(2);
		expect(await columns(page, '#grid')).toBe(1);
	});

	test('data-align places the cells on the cross axis; the default is stretch', async ({ page }) => {
		await open(page, 'grid', 1000);
		const [short, tall] = await rects(page, '#aligned > *');
		expect(short.bottom).toBeCloseTo(tall.bottom, 1);
		expect(short.height).toBeLessThan(tall.height);
		// Without the attribute a cell fills its row, as before.
		await page.evaluate(() => document.getElementById('aligned').removeAttribute('data-align'));
		const [s2, t2] = await rects(page, '#aligned > *');
		expect(s2.height).toBeCloseTo(t2.height, 1);
	});

	test('role="list" keeps padding reset even inside a grid', async ({ page }) => {
		await open(page, 'grid');
		expect(await px(page, '#list-grid', 'padding-inline-start')).toBe(0);
	});

	test('children have no margins', async ({ page }) => {
		await open(page, 'grid');
		await expectNoChildMargins(page, '.grid');
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page, 'grid');
		expect(await axe(page)).toEqual([]);
	});

	test('data-fold halves the count and never shows three', async ({ page }) => {
		await open(page, 'grid', 1100);
		expect(perRow(await rects(page, '#fold > *'))).toBe(4);
		await stage(page, 900);
		expect(perRow(await rects(page, '#fold > *'))).toBe(2);
		await stage(page, 700);
		expect(perRow(await rects(page, '#fold > *'))).toBe(2);
		await stage(page, 400);
		expect(perRow(await rects(page, '#fold > *'))).toBe(1);
	});

	test('data-gap="none" keeps the column count', async ({ page }) => {
		await open(page, 'grid', 1200);
		await page.evaluate(() => {
			const g = document.getElementById('fold');
			g.removeAttribute('data-fold');
			g.setAttribute('data-gap', 'none');
		});
		expect(perRow(await rects(page, '#fold > *'))).toBe(4);
	});

	for (const [min, four, two, one] of [['3xs', 600, 400, 200], ['2xs', 800, 500, 300]]) {
		test(`data-fold follows data-min="${min}"`, async ({ page }) => {
			await open(page, 'grid', four);
			await page.evaluate((m) => document.getElementById('fold').setAttribute('data-min', m), min);
			expect(perRow(await rects(page, '#fold > *'))).toBe(4);
			await stage(page, two);
			expect(perRow(await rects(page, '#fold > *'))).toBe(2);
			await stage(page, one);
			expect(perRow(await rects(page, '#fold > *'))).toBe(1);
		});
	}

	for (const [min, six, three, one] of [['3xs', 800, 500, 300], ['2xs', 1200, 700, 400]]) {
		test(`data-fold with data-min="${min}" and six columns steps 6, 3, 1`, async ({ page }) => {
			await open(page, 'grid', six);
			await page.evaluate((m) => document.getElementById('fold6').setAttribute('data-min', m), min);
			expect(perRow(await rects(page, '#fold6 > *'))).toBe(6);
			await stage(page, three);
			expect(perRow(await rects(page, '#fold6 > *'))).toBe(3);
			await stage(page, one);
			expect(perRow(await rects(page, '#fold6 > *'))).toBe(1);
		});
	}

	test('data-fold with data-min="sm" and six columns steps 6, 3, 1', async ({ page }) => {
		await open(page, 'grid', 2400);
		expect(perRow(await rects(page, '#fold6 > *'))).toBe(6);
		await stage(page, 1200);
		expect(perRow(await rects(page, '#fold6 > *'))).toBe(3);
		await stage(page, 1000);
		expect(perRow(await rects(page, '#fold6 > *'))).toBe(1);
	});

	test('data-rows lines up the parts of neighbours', async ({ page }) => {
		await open(page, 'grid', 1000);
		const heads = await rects(page, '#ranked h2');
		const paras = await rects(page, '#ranked p');
		expect(new Set(heads.map((r) => Math.round(r.top))).size).toBe(1);
		expect(new Set(paras.map((r) => Math.round(r.top))).size).toBe(1);
	});

	test('data-tracks places children by column line, leaving a skipped track empty', async ({ page }) => {
		await open(page, 'grid', 1000);
		const [grid, w1, w2, w3] = await rects(page, '#tracks, #tracks > *');
		const gap = await token(page, '--yeti-space-md');
		const track = (grid.width - 11 * gap) / 12;
		expect(w1.left).toBeCloseTo(grid.left + track + gap, 0);
		expect(w1.width).toBeCloseTo(6 * track + 5 * gap, 0);
		expect(w2.left).toBeCloseTo(grid.left + 8 * (track + gap), 0);
		expect(w2.width).toBeCloseTo(4 * track + 3 * gap, 0);
		expect(w2.top).toBeCloseTo(w1.top, 0);
		// Track one of the first row is empty: nothing in that row starts left of #w1.
		for (const r of [w1, w2, w3].filter((r) => Math.round(r.top) === Math.round(w1.top))) expect(r.left).toBeGreaterThanOrEqual(w1.left - 0.5);
		// The unmarked child flows into the next free track and spans one.
		expect(w3.top).toBeGreaterThan(w1.bottom);
		expect(w3.left).toBeCloseTo(grid.left, 0);
		expect(w3.width).toBeCloseTo(track, 0);
	});

	test('below its threshold a tracks grid is one column, in source order', async ({ page }) => {
		await open(page, 'grid', 400);
		const [grid, ...children] = await rects(page, '#tracks, #tracks > *');
		for (const r of children) {
			expect(r.width).toBeCloseTo(grid.width, 0);
			expect(r.left).toBeCloseTo(grid.left, 0);
		}
		for (let i = 1; i < children.length; i++) expect(children[i].top).toBeGreaterThan(children[i - 1].bottom);
		// data-threshold="sm" (24rem) is below a 400px content box, so the placement returns.
		await page.evaluate(() => document.getElementById('tracks').setAttribute('data-threshold', 'sm'));
		const [, w1, w2] = await rects(page, '#tracks, #tracks > *');
		expect(w2.top).toBeCloseTo(w1.top, 0);
		// No data-threshold means md: 32rem is above 400px, so it is one column again.
		await page.evaluate(() => document.getElementById('tracks').removeAttribute('data-threshold'));
		const [box, ...plain] = await rects(page, '#tracks, #tracks > *');
		for (const r of plain) expect(r.width).toBeCloseTo(box.width, 0);
	});

	test('data-fold does nothing on a tracks grid', async ({ page }) => {
		await open(page, 'grid', 1000);
		await page.evaluate(() => { const g = document.getElementById('tracks'); g.setAttribute('data-fold', ''); g.setAttribute('data-columns', '4'); });
		const [grid, w1, w2, w3] = await rects(page, '#tracks, #tracks > *');
		const gap = await token(page, '--yeti-space-md');
		const track = (grid.width - 11 * gap) / 12;
		expect(w1.left).toBeCloseTo(grid.left + track + gap, 0);
		expect(w1.width).toBeCloseTo(6 * track + 5 * gap, 0);
		expect(w2.left).toBeCloseTo(grid.left + 8 * (track + gap), 0);
		expect(w3.width).toBeCloseTo(track, 0);
	});

	test('a grid without data-tracks is not a container', async ({ page }) => {
		await open(page, 'grid', 1000);
		expect(await style(page, '#grid', 'container-type')).toBe('normal');
		expect(await style(page, '#capped', 'container-type')).toBe('normal');
		expect(await style(page, '#tracks', 'container-type')).toBe('inline-size');
	});

	test('the nested-columns twin steps through the same counts', async ({ page }) => {
		await open(page, 'grid', 1100);
		expect(perRow(await rects(page, '#nest .columns .columns > *'))).toBe(4);
		expect(new Set((await rects(page, '#nest .columns .columns > *')).map((r) => Math.round(r.top))).size).toBe(1);
		await stage(page, 700);
		expect(new Set((await rects(page, '#nest .columns .columns > *')).map((r) => Math.round(r.top))).size).toBe(2);
		await stage(page, 300);
		expect(new Set((await rects(page, '#nest .columns .columns > *')).map((r) => Math.round(r.top))).size).toBe(4);
	});
});
