import { test, expect } from 'playwright/test';
import { open, rect, px, token, axe } from '../lib/layout.js';

const leader = (page, selector) => page.evaluate((s) => {
	const after = getComputedStyle(document.querySelector(s), '::after');
	return { content: after.content, width: parseFloat(after.width), border: after.borderBottomStyle };
}, selector);
const lastLineBottom = (page, selector) => page.evaluate((s) => {
	const range = document.createRange();
	range.selectNodeContents(document.querySelector(s));
	const lines = [...range.getClientRects()];
	return Math.max(...lines.map((line) => line.bottom));
}, selector);

test.describe('leaders', () => {
	test('a name, a dotted line that fills the row, and a price at the end', async ({ page }) => {
		await open(page, 'leaders', 600);
		const [row, name, price] = await Promise.all([rect(page, '#short'), rect(page, '#short-name'), rect(page, '#short-price')]);
		expect(price.right).toBeCloseTo(row.right, 1);
		const line = await leader(page, '#short');
		expect(line.border).toBe('dotted');
		const gap = await token(page, '--yeti-space-xs');
		expect(line.width).toBeCloseTo(price.left - name.right - 2 * gap, 0);
	});

	test('a name that wraps keeps the line and the price on its last line', async ({ page }) => {
		await open(page, 'leaders', 320);
		const [name, price] = await Promise.all([rect(page, '#long-name'), rect(page, '#long-price')]);
		expect(name.height).toBeGreaterThan(price.height * 1.5);
		expect(await lastLineBottom(page, '#long-price')).toBeCloseTo(await lastLineBottom(page, '#long-name'), 0);
		expect(price.right).toBeCloseTo((await rect(page, '#long')).right, 1);
		// Falsification: a name this long would take the row; the line keeps its minimum.
		expect((await leader(page, '#long')).width).toBeGreaterThanOrEqual(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5 - 0.5));
	});

	test('the row gap comes from data-gap, and rows have no margins of their own', async ({ page }) => {
		await open(page, 'leaders', 600);
		const [one, two] = await Promise.all([rect(page, '#chapter-one'), rect(page, '#chapter-two')]);
		expect(two.top - one.bottom).toBeCloseTo(await token(page, '--yeti-space-lg'), 1);
		const [short, noValue] = await Promise.all([rect(page, '#short'), rect(page, '#no-value')]);
		expect(noValue.top - short.bottom).toBeCloseTo(await token(page, '--yeti-space-sm'), 1);
		expect(await px(page, '#short-price', 'margin-left')).toBe(0);
	});

	test('anything after the price sits below the row at full width', async ({ page }) => {
		await open(page, 'leaders', 600);
		const [row, name, price, text, notes] = await Promise.all(['#dish', '#dish-name', '#dish-price', '#dish-text', '#dish-notes'].map((s) => rect(page, s)));
		expect(price.right).toBeCloseTo(row.right, 1);
		expect(text.top).toBeGreaterThanOrEqual(Math.max(name.bottom, price.bottom));
		expect(notes.top).toBeGreaterThanOrEqual(text.bottom);
		expect(text.width).toBeCloseTo(row.width, 1);
	});

	test('a row with no value draws no line', async ({ page }) => {
		await open(page, 'leaders', 600);
		expect((await leader(page, '#no-value')).content).toBe('none');
		expect((await leader(page, '#plain-row')).content).toBe('none');
		// Falsification: a row with a value still has one.
		expect((await leader(page, '#short')).content).not.toBe('none');
	});

	test('--yeti-leaders-line sets the line', async ({ page }) => {
		await open(page, 'leaders', 600);
		await page.addStyleTag({ content: '#prices { --yeti-leaders-line: 3px dashed rgb(200, 0, 0); }' });
		expect(await page.evaluate(() => getComputedStyle(document.querySelector('#short'), '::after').borderBottom)).toContain('dashed');
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page, 'leaders', 600);
		expect(await axe(page)).toEqual([]);
	});
});
