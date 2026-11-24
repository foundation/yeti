import { test, expect } from 'playwright/test';
import { stage, rect, rects, style, axe } from '../lib/layout.js';

// The narrow cases size the viewport rather than only the stage, and before
// the page loads: the page's own scroll width is what they check, and the
// starting position is chosen once, as the page lays out.
const open = async (page, width) => {
	if (width) await page.setViewportSize({ width, height: 640 });
	const response = await page.goto('/test/browser/fixtures/components/tabnav.html');
	expect(response.status()).toBe(200);
	if (!width) await stage(page, 1000);
};
// A scroll timeline's value lands on the next frame after the scroll, so two
// frames pass before the fade is read.
const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const scrollTo = async (page, selector, where) => {
	await page.evaluate(([s, w]) => {
		const list = document.querySelector(s);
		const max = list.scrollWidth - list.clientWidth;
		// Right to left, the start is 0 and the end is a negative offset.
		const sign = getComputedStyle(list).direction === 'rtl' ? -1 : 1;
		list.scrollLeft = w === 'end' ? sign * max : 0;
	}, [selector, where]);
	await frames(page);
};
const fade = async (page, selector) => ({
	start: parseFloat(await style(page, selector, '--_yeti-tabnav-fade-start')),
	end: parseFloat(await style(page, selector, '--_yeti-tabnav-fade-end')),
});
const colorOf = (page, name) => page.evaluate((n) => {
	const probe = document.createElement('div');
	probe.style.cssText = `color: var(${n})`;
	document.body.append(probe);
	const value = getComputedStyle(probe).color;
	probe.remove();
	return value;
}, name);
const pageFits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const listScrolls = (page, selector) => page.evaluate((s) => {
	const list = document.querySelector(s);
	return list.scrollWidth > list.clientWidth;
}, selector);
const supports = (page, condition) => page.evaluate((c) => CSS.supports(c), condition);
const known = '#tn { --_yeti-variant: rgb(1, 2, 3); --_yeti-variant-text: rgb(4, 5, 6); --_yeti-variant-subtle: rgb(7, 8, 9); }';

test.describe('tabnav', () => {
	test('the fixture has no accessibility violations', async ({ page }) => {
		await open(page);
		expect(await axe(page)).toEqual([]);
	});

	test('the links sit in one row', async ({ page }) => {
		await open(page);
		const links = await rects(page, '#tn a');
		expect(links.length).toBe(3);
		for (const link of links) expect(link.top).toBeCloseTo(links[0].top, 1);
	});

	test('the marked link takes the variant\'s text color and edge, and the others have no edge', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: known });
		expect(await style(page, '#tn-issues', 'color')).toBe('rgb(4, 5, 6)');
		expect(await style(page, '#tn-issues', 'border-bottom-color')).toBe('rgb(1, 2, 3)');
		expect(await style(page, '#tn-code', 'border-bottom-color')).toBe('rgba(0, 0, 0, 0)');
		expect(await style(page, '#tn-code', 'color')).not.toBe('rgb(4, 5, 6)');
	});

	test('aria-current="true" marks a link the same way, and aria-current="false" does not', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: known });
		await page.evaluate(() => {
			document.getElementById('tn-code').setAttribute('aria-current', 'true');
			document.getElementById('tn-pulls').setAttribute('aria-current', 'false');
		});
		expect(await style(page, '#tn-code', 'color')).toBe('rgb(4, 5, 6)');
		expect(await style(page, '#tn-code', 'border-bottom-color')).toBe('rgb(1, 2, 3)');
		expect(await style(page, '#tn-pulls', 'color')).not.toBe('rgb(4, 5, 6)');
		expect(await style(page, '#tn-pulls', 'border-bottom-color')).toBe('rgba(0, 0, 0, 0)');
	});

	test('the marked link\'s edge covers the rule rather than sitting above it', async ({ page }) => {
		await open(page);
		const [nav, link] = await Promise.all([rect(page, '#tn'), rect(page, '#tn-issues')]);
		expect(parseFloat(await style(page, '#tn', 'border-bottom-width'))).toBeGreaterThan(0);
		expect(Math.abs(link.bottom - nav.bottom)).toBeLessThanOrEqual(0.5);
	});

	test('a link under the pointer takes the subtle tint', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: known });
		expect(await style(page, '#tn-code', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		await page.hover('#tn-code');
		expect(await style(page, '#tn-code', 'background-color')).toBe('rgb(7, 8, 9)');
	});

	test('data-variant changes the marked link\'s hue', async ({ page }) => {
		await open(page);
		const primary = await style(page, '#tn-issues', 'color');
		await page.evaluate(() => { document.getElementById('tn').dataset.variant = 'success'; });
		const success = await colorOf(page, '--yeti-color-success-text');
		expect(await style(page, '#tn-issues', 'color')).toBe(success);
		expect(success).not.toBe(primary);
	});

	test('data-emphasis="high" fills the marked link with the variant', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: '#tn-high { --_yeti-variant: rgb(1, 2, 3); --_yeti-on-variant: rgb(250, 251, 252); }' });
		expect(await style(page, '#tn-high-current', 'background-color')).toBe('rgb(1, 2, 3)');
		expect(await style(page, '#tn-high-current', 'color')).toBe('rgb(250, 251, 252)');
		expect(parseFloat(await style(page, '#tn-high-current', 'border-top-left-radius'))).toBeGreaterThan(0);
		expect(await style(page, '#tn-high-other', 'background-color')).toBe('rgba(0, 0, 0, 0)');
	});

	test('a long row scrolls sideways and the page does not, and no link wraps', async ({ page }) => {
		await open(page, 320);
		expect(await listScrolls(page, '#tn-long > ul')).toBe(true);
		expect(await pageFits(page)).toBe(true);
		const one = (await rect(page, '#tn-code')).height;
		const links = await rects(page, '#tn-long a');
		expect(links.length).toBe(12);
		for (const link of links) expect(link.height).toBeCloseTo(one, 1);
		for (const link of links) expect(link.top).toBeCloseTo(links[0].top, 1);
	});

	test('the rule does not move when the row scrolls', async ({ page }) => {
		await open(page, 320);
		const before = await rect(page, '#tn-long');
		await scrollTo(page, '#tn-long > ul', 'end');
		expect(await page.evaluate(() => document.querySelector('#tn-long > ul').scrollLeft)).toBeGreaterThan(0);
		const after = await rect(page, '#tn-long');
		expect(after.left).toBe(before.left);
		expect(after.right).toBe(before.right);
		expect(after.bottom).toBe(before.bottom);
	});

	test('where scroll timelines exist the scrollbar is hidden and the row fades at the edge with more beyond it', async ({ page }) => {
		await open(page, 320);
		test.skip(!(await supports(page, 'animation-timeline: scroll()')), 'this engine has no scroll timelines; the next test covers it');
		expect(await style(page, '#tn-long > ul', 'scrollbar-width')).toBe('none');
		await frames(page);
		expect(await fade(page, '#tn > ul')).toEqual({ start: 0, end: 0 });
		await scrollTo(page, '#tn-long > ul', 'start');
		const start = await fade(page, '#tn-long > ul');
		expect(start.start).toBe(0);
		expect(start.end).toBeGreaterThan(0);
		await scrollTo(page, '#tn-long > ul', 'end');
		const end = await fade(page, '#tn-long > ul');
		expect(end.start).toBeGreaterThan(0);
		expect(end.end).toBe(0);
	});

	test('without scroll timelines the browser\'s own thin scrollbar is the signal', async ({ page }) => {
		await open(page, 320);
		test.skip(await supports(page, 'animation-timeline: scroll()'), 'this engine has scroll timelines; the test above covers it');
		expect(await style(page, '#tn-long > ul', 'mask-image')).toBe('none');
		// Playwright's Firefox computes every scrollbar-width as none, whatever
		// is declared, so the expected value is what thin computes to here.
		const thin = await page.evaluate(() => {
			const probe = document.createElement('div');
			probe.style.scrollbarWidth = 'thin';
			document.body.append(probe);
			const value = getComputedStyle(probe).scrollbarWidth;
			probe.remove();
			return value;
		});
		expect(await style(page, '#tn-long > ul', 'scrollbar-width')).toBe(thin);
	});

	test('the row starts scrolled so the marked link is in view', async ({ page }) => {
		await open(page, 320);
		test.skip(!(await supports(page, 'scroll-initial-target: nearest')), 'this engine has no scroll-initial-target; the row starts at its start');
		const [list, link] = await Promise.all([rect(page, '#tn-long > ul'), rect(page, '#tn-long-current')]);
		expect(link.left).toBeGreaterThanOrEqual(list.left - 0.5);
		expect(link.right).toBeLessThanOrEqual(list.right + 0.5);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

	test('a focused link draws its ring inside the row', async ({ page }) => {
		await open(page);
		await page.keyboard.press('Tab');
		expect(await page.evaluate(() => document.activeElement.id)).toBe('tn-code');
		expect(await page.evaluate(() => document.activeElement.matches(':focus-visible'))).toBe(true);
		expect(parseFloat(await style(page, '#tn-code', 'outline-offset'))).toBeLessThan(0);
	});

	test('right to left the first link is at the right, and the row still scrolls without the page', async ({ page }) => {
		await open(page, 320);
		await page.evaluate(() => { document.getElementById('stage').dir = 'rtl'; });
		const [short, code] = await Promise.all([rect(page, '#tn > ul'), rect(page, '#tn-code')]);
		expect(Math.abs(code.right - short.right)).toBeLessThanOrEqual(0.5);
		expect(await listScrolls(page, '#tn-long > ul')).toBe(true);
		expect(await pageFits(page)).toBe(true);
		await scrollTo(page, '#tn-long > ul', 'start');
		const [list, first] = await Promise.all([rect(page, '#tn-long > ul'), rect(page, '#tn-long-first')]);
		expect(Math.abs(first.right - list.right)).toBeLessThanOrEqual(0.5);
		if (await supports(page, 'animation-timeline: scroll()')) {
			const start = await fade(page, '#tn-long > ul');
			expect(start.start).toBe(0);
			expect(start.end).toBeGreaterThan(0);
		}
	});
});
