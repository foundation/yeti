import { test, expect } from 'playwright/test';
import { open, rect, token, style, px, axe } from '../lib/layout.js';

test.describe('attribute vocabulary', () => {
	test('single stops resolve to their token', async ({ page }) => {
		await open(page, 'attributes');
		expect((await rect(page, '#gap-md')).width).toBeCloseTo(await token(page, '--yeti-space-md'), 1);
		expect((await rect(page, '#gap-none')).width).toBe(0);
		expect((await rect(page, '#width-sm')).width).toBeCloseTo(await token(page, '--yeti-width-sm'), 1);
		expect((await rect(page, '#min-none')).width).toBe(0);
	});

	test('an element without the attribute has no value', async ({ page }) => {
		await open(page, 'attributes');
		// inline-size: var(--_yeti-gap) is invalid at computed-value time, so it falls back to auto and fills the stage.
		expect((await rect(page, '#no-attr')).width).toBe(1000);
	});

	test('a fluid pair runs from the small stop at 320 to the large stop at 1280', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await open(page, 'attributes', 300);
		expect((await rect(page, '#gap-sm-lg')).width).toBeCloseTo(await token(page, '--yeti-space-sm-static'), 1);
		await page.setViewportSize({ width: 1280, height: 800 });
		expect((await rect(page, '#gap-sm-lg')).width).toBeCloseTo(await token(page, '--yeti-space-lg'), 1);
	});

	test('data-nowrap keeps any element on one line', async ({ page }) => {
		await open(page, 'attributes');
		await page.evaluate(() => document.querySelector('main').insertAdjacentHTML('beforeend', '<p><span id="kept" data-nowrap>one line</span><span id="free">wraps</span></p>'));
		expect(await style(page, '#kept', 'white-space')).toBe('nowrap');
		expect(await style(page, '#free', 'white-space')).toBe('normal');
	});

	test('data-numeric gives any element tabular figures', async ({ page }) => {
		await open(page, 'attributes');
		expect(await style(page, '#numeric', 'font-variant-numeric')).toBe('tabular-nums');
		expect(await style(page, '#not-numeric', 'font-variant-numeric')).toBe('normal');
	});

	test('data-border draws the border on any element', async ({ page }) => {
		await open(page, 'attributes');
		const width = await token(page, '--yeti-border-width');
		expect(await px(page, '#framed', 'border-top-width')).toBe(width);
		expect(await px(page, '#bordered-text', 'border-top-width')).toBe(width);
		expect(await px(page, '#no-attr', 'border-top-width')).toBe(0);
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page, 'attributes');
		expect(await axe(page)).toEqual([]);
	});
});
