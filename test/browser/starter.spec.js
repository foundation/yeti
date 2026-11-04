// The starter page, tested where it lives rather than through a fixture copy.
// The screenshot suite walks only fixtures/, so this spec carries the page's
// own light and dark baselines, captured the way that suite captures them.
import { test, expect } from 'playwright/test';
import { axe, painted } from './lib/layout.js';

const open = async (page, width, height = 800) => {
	await page.setViewportSize({ width, height });
	const response = await page.goto('/src/starter/index.html');
	expect(response.status()).toBe(200);
	await painted(page);
};

const visible = (page, selector) => page.evaluate((s) => {
	const el = document.querySelector(s);
	const r = el.getBoundingClientRect();
	return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0;
}, selector);

test.describe('starter page', () => {
	for (const width of [390, 1280]) {
		test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
			await open(page, width);
			const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
			expect(scroll).toBeLessThanOrEqual(client);
		});
	}

	test('the skip link is the body\'s first child', async ({ page }) => {
		await open(page, 1280);
		const first = await page.evaluate(() => {
			const el = document.body.firstElementChild;
			return { tag: el.tagName, href: el.getAttribute('href'), target: !!document.querySelector(el.getAttribute('href')) };
		});
		expect(first).toEqual({ tag: 'A', href: '#content', target: true });
	});

	test('the nav shows its toggle on a phone and its links on a desktop', async ({ page }) => {
		await open(page, 390);
		expect(await visible(page, '.nav > button[popovertarget]')).toBe(true);
		expect(await visible(page, '.nav a[href="#features"]')).toBe(false);
		await open(page, 1280);
		expect(await visible(page, '.nav > button[popovertarget]')).toBe(false);
		expect(await visible(page, '.nav a[href="#features"]')).toBe(true);
	});

	test('the nav sits on the top edge once the page scrolls', async ({ page }) => {
		await open(page, 1280);
		await page.evaluate(() => window.scrollTo(0, 600));
		await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('.nav').getBoundingClientRect().top))).toBeLessThanOrEqual(1);
	});

	for (const [label, css] of [['at the default scale', null], ['on a larger type scale', ':root { --yeti-base-max: 1.5rem; --yeti-ratio-max: 1.5 }']]) {
		test(`its own links land below the bar ${label}`, async ({ page }) => {
			// A short window, so the page can scroll far enough for a jump to put
			// its target at the very top, where the bar would cover it.
			const clearance = (target) => page.evaluate((t) => document.querySelector(t).getBoundingClientRect().top - document.querySelector('.nav').getBoundingClientRect().bottom, target);
			const load = async () => {
				await open(page, 1280, 400);
				if (css) { await page.addStyleTag({ content: css }); await painted(page); }
			};
			await load();
			await page.click('.nav a[href="#about"]');
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
			await expect.poll(() => clearance('#about-heading')).toBeGreaterThanOrEqual(0);
			// The skip link, on a fresh load scrolled past the content's start.
			await load();
			// Instant: the page's links turn on smooth scrolling, and a scroll
			// still animating when the link is followed would race its jump.
			await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
			// Focused directly: WebKit leaves links out of Tab order by default.
			await page.focus('body > a:first-child');
			await page.keyboard.press('Enter');
			await expect.poll(() => page.evaluate(() => location.hash)).toBe('#content');
			await expect.poll(() => clearance('#content')).toBeGreaterThanOrEqual(0);
		});
	}

	for (const scheme of ['light', 'dark']) {
		test(`has no accessibility violations in ${scheme}`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await open(page, 1280);
			expect(await axe(page)).toEqual([]);
		});
	}
});

test.describe('starter page screenshots @screenshot', () => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'baselines are captured in Chromium only');

	for (const scheme of ['light', 'dark']) {
		test(`starter in ${scheme}`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await open(page, 1000);
			await expect(page).toHaveScreenshot(`starter-${scheme}.png`, { fullPage: true });
		});
	}
});
