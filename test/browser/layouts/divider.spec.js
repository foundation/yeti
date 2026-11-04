import { test, expect } from 'playwright/test';
import { open, rect, style, token, axe } from '../lib/layout.js';

const line = (page, selector, which) => page.evaluate(([s, w]) => {
	const box = getComputedStyle(document.querySelector(s), w);
	return { content: box.content, display: box.display, width: parseFloat(box.width), border: box.borderTopStyle };
}, [selector, which]);

test.describe('divider', () => {
	test('a line fills the space either side of centered text', async ({ page }) => {
		await open(page, 'divider', 800);
		const [before, after] = await Promise.all([line(page, '#center', '::before'), line(page, '#center', '::after')]);
		expect(before.border).toBe('solid');
		expect(before.width).toBeGreaterThan(100);
		expect(before.width).toBeCloseTo(after.width, 0);
	});

	test('it fills its container, past the heading measure', async ({ page }) => {
		await open(page, 'divider', 1400);
		expect(await style(page, '#center', 'max-inline-size')).toBe('none');
		expect((await rect(page, '#center')).width).toBeCloseTo((await rect(page, '#stage')).width, 0);
	});

	test('data-align drops the line on the side the text sits', async ({ page }) => {
		await open(page, 'divider', 800);
		expect((await line(page, '#start', '::before')).content).toBe('none');
		expect((await line(page, '#start', '::after')).content).not.toBe('none');
		expect((await line(page, '#end', '::after')).content).toBe('none');
		expect((await line(page, '#end', '::before')).content).not.toBe('none');
	});

	test('data-gap is the space either side of the text', async ({ page }) => {
		await open(page, 'divider', 800);
		expect(parseFloat(await style(page, '#gapped', 'column-gap'))).toBeCloseTo(await token(page, '--yeti-space-xl'), 1);
		expect(parseFloat(await style(page, '#center', 'column-gap'))).toBeCloseTo(await token(page, '--yeti-space-md'), 1);
	});

	test('long text wraps and keeps a line on each side', async ({ page }) => {
		await open(page, 'divider', 320);
		const [before, after, text] = await Promise.all([line(page, '#long', '::before'), line(page, '#long', '::after'), rect(page, '#long-text')]);
		expect(text.height).toBeGreaterThan(50);
		const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
		expect(before.width).toBeGreaterThanOrEqual(1.5 * rem - 0.5);
		expect(after.width).toBeGreaterThanOrEqual(1.5 * rem - 0.5);
		const page_ = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(page_).toBeLessThanOrEqual(0);
	});

	test('--yeti-divider-line sets the line', async ({ page }) => {
		await open(page, 'divider', 800);
		await page.addStyleTag({ content: '#center { --yeti-divider-line: 3px dotted rgb(200, 0, 0); }' });
		expect((await line(page, '#center', '::before')).border).toBe('dotted');
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page, 'divider', 800);
		expect(await axe(page)).toEqual([]);
	});
});
