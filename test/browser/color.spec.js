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

		test('the greys are true greys by default, and --yeti-chroma-neutral gives them a tint', async ({ page }) => {
			const spread = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
			const [bg, fg] = await pair(page, '#page');
			// One step of rounding is all that is left between the channels.
			expect(spread(bg)).toBeLessThanOrEqual(1);
			expect(spread(fg)).toBeLessThanOrEqual(1);
			expect(await ratio(page, '#page')).toBeGreaterThanOrEqual(7);
			await page.evaluate(() => document.documentElement.style.setProperty('--yeti-chroma-neutral', '0.02'));
			const [tinted] = await pair(page, '#page');
			expect(spread(tinted)).toBeGreaterThan(1);
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

	// Every hue angle, at each chroma: what the two themes ship (0.05 and
	// 0.12 sit under the default and read better than it), the default, and
	// as far above it as a theme might go. The weakest hue is near teal, 190,
	// which a sweep in steps of thirty degrees stepped over. One evaluate per
	// chroma returns every pair of colors, so 360 angles cost one round trip.
	test(`every hue holds contrast at every chroma in ${scheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme });
		await page.addInitScript(PAGE_HELPERS);
		await page.goto('/test/browser/fixtures/hues.html');
		const PAIRS = { '#primary': 4.5, '#primary-text': 4.5, '#page': 7, '#primary-on-surface': 4.5, '#primary-subtle': 7 };
		for (const chroma of [0.05, 0.15, 0.2, 0.25, 0.3]) {
			const rows = await page.evaluate(([c, selectors]) => {
				const root = document.documentElement;
				root.style.setProperty('--yeti-chroma', String(c));
				const out = [];
				for (let hue = 0; hue < 360; hue += 1) {
					root.style.setProperty('--yeti-hue-primary', String(hue));
					out.push(selectors.map((s) => [window.__yeti.bg(s), window.__yeti.fg(s)]));
				}
				return out;
			}, [chroma, Object.keys(PAIRS)]);
			expect(rows.length).toBe(360);
			Object.entries(PAIRS).forEach(([selector, least], i) => {
				const ratios = rows.map((row) => contrast(...row[i]));
				const weakest = Math.min(...ratios);
				expect(weakest, `${selector} at chroma ${chroma}, weakest at hue ${ratios.indexOf(weakest)}`).toBeGreaterThanOrEqual(least);
			});
		}
	});

	// A region works its accents out again from its own inputs, so a chroma
	// raised on the region alone has to reach the base step there too. Teal
	// at 0.25 is the pair that drops to 3.9:1 at the ladder's own lightness.
	test(`a data-palette region that raises the chroma keeps its contrast in ${scheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme });
		await page.addInitScript(PAGE_HELPERS);
		await page.goto('/test/browser/fixtures/hues.html');
		await page.evaluate(() => {
			const region = document.createElement('div');
			region.setAttribute('data-palette', '');
			region.style.cssText = '--yeti-chroma: 0.25; --yeti-hue-primary: 190';
			region.append(document.getElementById('primary'), document.getElementById('primary-on-surface'));
			document.querySelector('main').append(region);
		});
		expect(await ratio(page, '#primary')).toBeGreaterThanOrEqual(4.5);
		expect(await ratio(page, '#primary-on-surface')).toBeGreaterThanOrEqual(4.5);
	});
}
