import { test, expect } from 'playwright/test';
import { open, stage, rects, style, px, token, axe } from '../lib/layout.js';

const columns = async (page, selector) => new Set((await rects(page, `${selector} > *`)).map((r) => Math.round(r.left))).size;
const expected = (width, min, gap) => Math.floor((width + gap) / (min + gap));
const native = (page) => page.evaluate(() => CSS.supports('grid-template-rows', 'masonry'));

test.describe('masonry', () => {
	test('fits as many columns as the minimum allows', async ({ page }) => {
		await open(page, 'masonry', 1000);
		const [min, gap] = await Promise.all([token(page, '--yeti-width-xs'), token(page, '--yeti-space-md')]);
		expect(await columns(page, '#masonry')).toBe(expected(1000, min, gap));
		await stage(page, 500);
		expect(await columns(page, '#masonry')).toBe(expected(500, min, gap));
	});

	test('a child with a layout class of its own keeps the masonry\'s gap below it', async ({ page }) => {
		await open(page, 'masonry', 1000);
		test.skip(await native(page), 'native masonry spaces items with gap, not a margin');
		await page.evaluate(() => {
			document.querySelector('#stage').insertAdjacentHTML('beforeend', `<div class="masonry" data-gap="sm">
				<article id="own-gap" class="stack" data-gap="2xl"><p>One</p></article>
				<article id="default-gap" class="stack"><p>Two</p></article>
			</div>`);
		});
		const sm = await token(page, '--yeti-space-sm');
		expect(await px(page, '#own-gap', 'margin-bottom')).toBeCloseTo(sm, 1);
		expect(await px(page, '#default-gap', 'margin-bottom')).toBeCloseTo(sm, 1);
	});

	test('data-columns caps the count', async ({ page }) => {
		await open(page, 'masonry', 1000);
		expect(await columns(page, '#capped')).toBe(2);
	});

	test('data-min="none" alone gives a single full-width column', async ({ page }) => {
		await open(page, 'masonry', 1000);
		expect(await columns(page, '#none')).toBe(1);
	});

	test('data-min="none" with data-columns gives an exact count', async ({ page }) => {
		await open(page, 'masonry', 1000);
		expect(await columns(page, '#exact')).toBe(3);
		await stage(page, 500);
		expect(await columns(page, '#exact')).toBe(3);
	});

	test('packs items under each other with the gap between', async ({ page }) => {
		await open(page, 'masonry', 1000);
		const gap = await token(page, '--yeti-space-md');
		const items = await rects(page, '#masonry > *');
		const firstColumn = items.filter((r) => Math.round(r.left) === Math.round(items[0].left)).sort((a, b) => a.top - b.top);
		expect(firstColumn.length).toBeGreaterThan(1);
		expect(firstColumn[1].top - firstColumn[0].bottom).toBeCloseTo(gap, 0);
	});

	test('uses the native path where it exists and the column path elsewhere', async ({ page }) => {
		await open(page, 'masonry', 1000);
		if (await native(page)) {
			expect(await style(page, '#masonry', 'display')).toBe('grid');
			expect(await style(page, '#masonry > :first-child', 'margin-bottom')).toBe('0px');
		} else {
			expect(await style(page, '#masonry', 'display')).toBe('block');
			expect(parseFloat(await style(page, '#masonry', 'column-width'))).toBeCloseTo(await token(page, '--yeti-width-xs'), 0);
		}
	});

	test('children have no inline margins', async ({ page }) => {
		await open(page, 'masonry');
		const margins = await page.evaluate(() => [...document.querySelectorAll('.masonry > *')].map((el) => { const cs = getComputedStyle(el); return `${cs.marginLeft} ${cs.marginRight} ${cs.marginTop}`; }));
		for (const m of margins) expect(m).toBe('0px 0px 0px');
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page, 'masonry');
		expect(await axe(page)).toEqual([]);
	});
});
