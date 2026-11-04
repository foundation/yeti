import { test, expect } from 'playwright/test';
import { px, token, style, axe, painted } from '../lib/layout.js';

const open = async (page) => {
	const response = await page.goto('/test/browser/fixtures/utilities/billboard.html');
	expect(response.status()).toBe(200);
	await painted(page);
};

test.describe('billboard', () => {
	test('the same line is set larger in a wider container', async ({ page }) => {
		await open(page);
		const [narrow, wide] = await Promise.all([px(page, '#narrow-title', 'font-size'), px(page, '#wide-title', 'font-size')]);
		expect(wide).toBeGreaterThan(narrow + 5);
	});

	test('it fills its board, with no reading measure on a heading or a paragraph', async ({ page }) => {
		await open(page);
		expect(await style(page, '#wide-title', 'max-inline-size')).toBe('none');
		expect(await style(page, 'p.billboard', 'max-inline-size')).toBe('none');
	});

	test('it is clamped at both ends of its pair', async ({ page }) => {
		await open(page);
		const [tiny, huge, min, max] = await Promise.all([
			px(page, '#tiny-title', 'font-size'),
			px(page, '#huge-title', 'font-size'),
			token(page, '--yeti-text-md'),
			token(page, '--yeti-text-3xl'),
		]);
		expect(tiny).toBeCloseTo(min, 0);
		expect(huge).toBeCloseTo(max, 0);
	});

	test('a pair sets its own ends, so a lower maximum grows more slowly', async ({ page }) => {
		await open(page);
		const [pair, wide, pairMin, pairMax] = await Promise.all([
			px(page, '#pair-title', 'font-size'),
			px(page, '#wide-title', 'font-size'),
			token(page, '--yeti-text-sm'),
			token(page, '--yeti-text-xl'),
		]);
		// Same container width, lower ceiling: sm-xl is behind md-3xl all the
		// way up, and is still inside its own two ends at this width.
		expect(pair).toBeLessThan(wide);
		expect(pair).toBeGreaterThan(pairMin);
		expect(pair).toBeLessThan(pairMax);
	});

	test('with no size container above it the line falls back to the viewport', async ({ page }) => {
		await open(page);
		// The default viewport is wider than --yeti-fit-width (32rem = 512px),
		// so the fallback alone would sit at the ceiling and prove nothing the
		// clamp test above does not already prove. Shrinking the viewport
		// below that width moves cqi onto the ramp, so a smaller reading here
		// shows the bare billboard is tracking the window rather than sitting
		// on a fixed size all along.
		const wide = await px(page, '#bare-title', 'font-size');
		await page.setViewportSize({ width: 360, height: 800 });
		const narrow = await px(page, '#bare-title', 'font-size');
		expect(narrow).toBeLessThan(wide);
	});

	test('reads the heading tracking token', async ({ page }) => {
		await open(page);
		expect(await style(page, '#prose-board', 'letter-spacing')).toBe('normal');
		await page.addStyleTag({ content: ':root { --yeti-tracking-heading: -0.03em; }' });
		const size = await px(page, '#prose-board', 'font-size');
		expect(await px(page, '#prose-board', 'letter-spacing')).toBeCloseTo(-0.03 * size, 1);
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page);
		expect(await axe(page)).toEqual([]);
	});
});
