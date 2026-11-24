import { test, expect } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { contrast, luminance, PAGE_HELPERS } from './lib/color.js';

const pair = (page, selector) => page.evaluate((s) => [window.__yeti.bg(s), window.__yeti.fg(s)], selector);
const ratio = async (page, selector) => contrast(...(await pair(page, selector)));

for (const scheme of ['light', 'dark']) {
	test.describe(`color tokens in ${scheme}`, () => {
		test.beforeEach(async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await page.addInitScript(PAGE_HELPERS);
			const response = await page.goto('/test/browser/fixtures/color.html');
			expect(response.status()).toBe(200);
		});

		test('surface and text sit at the right ends and contrast at 7:1', async ({ page }) => {
			const [bg, fg] = await pair(page, '#page');
			expect(luminance(bg) > luminance(fg)).toBe(scheme === 'light');
			expect(await ratio(page, '#page')).toBeGreaterThanOrEqual(7);
			expect(await ratio(page, '#muted')).toBeGreaterThanOrEqual(4.5);
		});

		test('text on every base color reaches 4.5:1', async ({ page }) => {
			for (const id of ['primary', 'secondary', 'success', 'warning', 'alert']) {
				expect(await ratio(page, `#${id}`), id).toBeGreaterThanOrEqual(4.5);
			}
		});

		test('hued text on the surface reaches 4.5:1 and subtle backgrounds keep body text readable', async ({ page }) => {
			for (const id of ['primary', 'secondary', 'success', 'warning', 'alert']) {
				expect(await ratio(page, `#${id}-text`), `${id}-text`).toBeGreaterThanOrEqual(4.5);
			}
			expect(await ratio(page, '#subtle')).toBeGreaterThanOrEqual(7);
		});

		test('an ancestor can force light', async ({ page }) => {
			const [bg] = await pair(page, '#forced');
			expect(luminance(bg)).toBeGreaterThan(0.8);
		});

		test('has no accessibility violations', async ({ page }) => {
			expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		});

		test('an invalid hue override falls back instead of blanking the palette', async ({ page }) => {
			await page.evaluate(() => document.documentElement.style.setProperty('--yeti-hue-primary', 'blue'));
			const [bg] = await pair(page, '#primary');
			expect(bg).not.toEqual([0, 0, 0]);
			expect(await ratio(page, '#primary')).toBeGreaterThanOrEqual(4.5);
		});

		test('--yeti-chroma-neutral sets how much hue the greys carry, and zero makes them true greys', async ({ page }) => {
			const spread = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
			const [tinted] = await pair(page, '#page');
			expect(spread(tinted)).toBeGreaterThan(1);
			await page.evaluate(() => document.documentElement.style.setProperty('--yeti-chroma-neutral', '0'));
			const [bg, fg] = await pair(page, '#page');
			// One step of rounding is all that is left between the channels.
			expect(spread(bg)).toBeLessThanOrEqual(1);
			expect(spread(fg)).toBeLessThanOrEqual(1);
			expect(await ratio(page, '#page')).toBeGreaterThanOrEqual(7);
		});

		test('a theme element rule pins the scheme whatever the visitor prefers', async ({ page }) => {
			expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light dark');
			const pinned = scheme === 'light' ? 'dark' : 'light';
			await page.addStyleTag({ content: `@layer yeti.theme { html { color-scheme: ${pinned}; } }` });
			expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(pinned);
			// The derived colors follow: the page is light when pinned light, dark when pinned dark.
			const [bg, fg] = await pair(page, '#page');
			expect(luminance(bg) > luminance(fg)).toBe(pinned === 'light');
		});
	});

	test(`hue sweep holds contrast in ${scheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme });
		await page.addInitScript(PAGE_HELPERS);
		await page.goto('/test/browser/fixtures/hues.html');
		for (let hue = 0; hue < 360; hue += 30) {
			await page.evaluate((h) => document.documentElement.style.setProperty('--yeti-hue-primary', String(h)), hue);
			expect(await ratio(page, '#primary'), `on-primary at hue ${hue}`).toBeGreaterThanOrEqual(4.5);
			expect(await ratio(page, '#primary-text'), `primary-text at hue ${hue}`).toBeGreaterThanOrEqual(4.5);
			expect(await ratio(page, '#page'), `surface at hue ${hue}`).toBeGreaterThanOrEqual(7);
			expect(await ratio(page, '#primary-on-surface'), `primary on surface at hue ${hue}`).toBeGreaterThanOrEqual(4.5);
		}
	});
}
