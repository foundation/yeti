import { test, expect } from 'playwright/test';
import { rect, style, axe, token, painted } from '../lib/layout.js';

// A narrow case sizes the viewport before the page loads, since the page's
// own scroll width is what it checks. A right-to-left case turns the whole
// document, so the viewport's edges swap along with the button's.
const open = async (page, { width, dir } = {}) => {
	if (width) await page.setViewportSize({ width, height: 640 });
	const response = await page.goto('/test/browser/fixtures/components/popover.html');
	expect(response.status()).toBe(200);
	if (dir) await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
	await painted(page);
};
const isOpen = (page, id) => page.evaluate((i) => document.getElementById(i).matches(':popover-open'), id);
// The panel fades in, and the flip is chosen at layout, so wait for both
// before reading where it landed.
const settle = (page, selector) => page.evaluate((s) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	.then(() => Promise.all(document.querySelector(s).getAnimations().map((a) => a.finished.catch(() => {})))), selector);
const show = async (page, id) => {
	await page.click(`#${id}-open`);
	await settle(page, `#${id}`);
	expect(await isOpen(page, id)).toBe(true);
	return { panel: await rect(page, `#${id}`), button: await rect(page, `#${id}-open`) };
};
const shut = async (page, id) => {
	await page.keyboard.press('Escape');
	expect(await isOpen(page, id)).toBe(false);
};
const viewport = (page) => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
// Within a pixel: the gap is a fluid token, so its edges land on fractions.
const near = (actual, expected, label) => expect(Math.abs(actual - expected), `${label}: ${actual} against ${expected}`).toBeLessThanOrEqual(1);
// Deletes every @supports block from the popover's own stylesheet, which is
// what a browser without anchor positioning sees. The sheet is reached
// through yeti.css's @import rules.
const unguard = (page) => page.evaluate(() => {
	const find = (sheet) => {
		for (const rule of sheet.cssRules) {
			if (!(rule instanceof CSSImportRule) || !rule.styleSheet) continue;
			if (rule.href.endsWith('popover/popover.css')) return rule.styleSheet;
			const inner = find(rule.styleSheet);
			if (inner) return inner;
		}
		return null;
	};
	let removed = 0;
	const strip = (group) => {
		for (let i = group.cssRules.length - 1; i >= 0; i -= 1) {
			const rule = group.cssRules[i];
			if (rule instanceof CSSSupportsRule) { group.deleteRule(i); removed += 1; } else if (rule.cssRules) strip(rule);
		}
	};
	for (const sheet of document.styleSheets) {
		const own = find(sheet);
		if (own) { strip(own); break; }
	}
	return removed;
});

test.describe('popover', () => {
	// Runs in all three engines.
	test('the button opens the panel, and Escape or a click elsewhere closes it', async ({ page }) => {
		await open(page);
		expect(await isOpen(page, 'share')).toBe(false);
		await page.click('#share-open');
		expect(await isOpen(page, 'share')).toBe(true);
		await page.keyboard.press('Escape');
		expect(await isOpen(page, 'share')).toBe(false);
		await page.click('#share-open');
		await settle(page, '#share');
		expect(await isOpen(page, 'share')).toBe(true);
		const view = await viewport(page);
		await page.mouse.click(view.width / 2, 5);
		expect(await isOpen(page, 'share')).toBe(false);
	});

	// Runs in all three engines.
	test('by default the panel opens below its button, a small gap away, lined up with its start', async ({ page }) => {
		await open(page);
		const gap = await token(page, '--yeti-space-xs');
		expect(gap).toBeGreaterThan(0);
		const { panel, button } = await show(page, 'share');
		near(panel.top, button.bottom + gap, 'top');
		near(panel.left, button.left, 'left');
	});

	// Runs in all three engines.
	test('data-placement puts it above, before or beside its button, the same gap away', async ({ page }) => {
		await open(page);
		const gap = await token(page, '--yeti-space-xs');
		const above = await show(page, 'above');
		near(above.panel.bottom, above.button.top - gap, 'top: bottom edge');
		near(above.panel.left, above.button.left, 'top: start edge');
		await shut(page, 'above');
		const beside = await show(page, 'beside');
		near(beside.panel.left, beside.button.right + gap, 'end: start edge');
		near(beside.panel.top, beside.button.top, 'end: top');
		await shut(page, 'beside');
		const before = await show(page, 'before');
		near(before.panel.right, before.button.left - gap, 'start: end edge');
		near(before.panel.top, before.button.top, 'start: top');
	});

	// Runs in all three engines.
	test('with no room below it opens above, and at the end edge it stays on the screen', async ({ page }) => {
		await open(page);
		const gap = await token(page, '--yeti-space-xs');
		const view = await viewport(page);
		const low = await show(page, 'low');
		near(low.panel.bottom, low.button.top - gap, 'flipped above');
		await shut(page, 'low');
		const edge = await show(page, 'edge');
		expect(edge.panel.width).toBeGreaterThan(view.width - edge.button.left);
		expect(edge.panel.right).toBeLessThanOrEqual(view.width + 0.5);
		expect(edge.panel.left).toBeGreaterThanOrEqual(-0.5);
		near(edge.panel.top, edge.button.bottom + gap, 'still below');
	});

	// Runs in all three engines.
	test('right to left, the panel lines up with the button\'s right edge, and end is to its left', async ({ page }) => {
		await open(page, { dir: 'rtl' });
		const gap = await token(page, '--yeti-space-xs');
		const { panel, button } = await show(page, 'share');
		near(panel.right, button.right, 'default: right edge');
		near(panel.top, button.bottom + gap, 'default: top');
		await shut(page, 'share');
		const beside = await show(page, 'beside');
		near(beside.panel.right, beside.button.left - gap, 'end: right edge');
		near(beside.panel.top, beside.button.top, 'end: top');
	});

	test('each panel hangs off its own button, wherever the two sit in the page', async ({ page }) => {
		await open(page);
		const gap = await token(page, '--yeti-space-xs');
		// The panel last in body, its button three containers deep.
		await page.evaluate(() => document.body.append(document.getElementById('nested')));
		expect(await page.evaluate(() => document.body.lastElementChild.id)).toBe('nested');
		const nested = await show(page, 'nested');
		near(nested.panel.top, nested.button.bottom + gap, 'nested: top');
		near(nested.panel.left, nested.button.left, 'nested: left');
		await shut(page, 'nested');
		for (const id of ['one', 'two', 'three']) {
			const { panel, button } = await show(page, id);
			near(panel.top, button.bottom + gap, `${id}: top`);
			near(panel.left, button.left, `${id}: left`);
			await shut(page, id);
		}
	});

	test('a long panel is the xs width, data-max widens it, and a phone keeps a margin each side', async ({ page }) => {
		await open(page);
		const long = await show(page, 'long');
		near(long.panel.width, await token(page, '--yeti-width-xs'), 'default width');
		await shut(page, 'long');
		const wide = await show(page, 'wide');
		near(wide.panel.width, await token(page, '--yeti-width-sm'), 'data-max="sm"');
		await open(page, { width: 320 });
		const phone = await show(page, 'wide');
		const view = await viewport(page);
		expect(phone.panel.width).toBeLessThanOrEqual(view.width - 2 * await token(page, '--yeti-space-md') + 0.5);
	});

	test('what it holds looks as it does on the page: links, buttons and the spacing of prose', async ({ page }) => {
		await open(page);
		await show(page, 'content');
		const read = (selector, props) => page.evaluate(([s, p]) => {
			const cs = getComputedStyle(document.querySelector(s));
			return Object.fromEntries(p.map((name) => [name, cs.getPropertyValue(name)]));
		}, [selector, props]);
		const link = ['color', 'text-decoration-line'];
		expect(await read('#content-link', link)).toEqual(await read('#out-link', link));
		expect((await read('#content-link', link))['text-decoration-line']).toBe('underline');
		const button = ['background-color', 'border-top-left-radius', 'padding-top', 'padding-inline-start'];
		expect(await read('#content-button', button)).toEqual(await read('#out-button', button));
		// The same heading and two paragraphs, in the panel and in an article.
		const gaps = (heading, one, two) => page.evaluate(([h, a, b]) => {
			const [rh, ra, rb] = [h, a, b].map((s) => document.querySelector(s).getBoundingClientRect());
			return [ra.top - rh.bottom, rb.top - ra.bottom];
		}, [heading, one, two]);
		const inPanel = await gaps('#content-heading', '#content-one', '#content-two');
		const inArticle = await gaps('#flow > h3', '#flow > p:nth-of-type(1)', '#flow > p:nth-of-type(2)');
		expect(inPanel[0]).toBeGreaterThan(0);
		expect(inPanel[1]).toBeGreaterThan(inPanel[0]);
		near(inPanel[0], inArticle[0], 'after the heading');
		near(inPanel[1], inArticle[1], 'between the paragraphs');
	});

	test('without anchor positioning the user agent centers the open panel', async ({ page }) => {
		await open(page);
		expect(await unguard(page)).toBe(1);
		const { panel } = await show(page, 'share');
		const view = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }));
		near(panel.left + panel.width / 2, view.width / 2, 'inline center');
		near(panel.top + panel.height / 2, view.height / 2, 'block center');
		expect(await style(page, '#share', 'position')).toBe('fixed');
	});

	// Runs in all three engines.
	test('a dialog element opens beside its button the same way, focuses its autofocus field, and leaves the page usable', async ({ page }) => {
		await open(page);
		const gap = await token(page, '--yeti-space-xs');
		const { panel, button } = await show(page, 'rename');
		near(panel.top, button.bottom + gap, 'top');
		near(panel.left, button.left, 'left');
		expect(await page.evaluate(() => document.activeElement.id)).toBe('rename-input');
		expect(await page.evaluate(() => document.getElementById('rename').matches(':modal'))).toBe(false);
		await page.evaluate(() => {
			window.outsideClicked = false;
			document.getElementById('outside').addEventListener('click', () => { window.outsideClicked = true; });
		});
		await page.click('#outside');
		expect(await page.evaluate(() => window.outsideClicked)).toBe(true);
		expect(await isOpen(page, 'rename')).toBe(false);
	});

	test('Tab goes from the button into the panel, and from its last control to what follows the button', async ({ page, browserName }) => {
		// WebKit does not focus a clicked button, and its Tab skips links unless
		// the reader turns that on, so the order it walks is not the page's.
		test.skip(browserName === 'webkit', 'WebKit does not focus a clicked button and its Tab skips links by default');
		await open(page);
		expect(await page.evaluate(() => document.body.lastElementChild.id)).toBe('share');
		await page.focus('#share-open');
		await page.keyboard.press('Enter');
		await settle(page, '#share');
		expect(await isOpen(page, 'share')).toBe(true);
		const focused = () => page.evaluate(() => document.activeElement.id);
		await page.keyboard.press('Tab');
		expect(await focused()).toBe('share-link');
		await page.keyboard.press('Tab');
		expect(await focused()).toBe('share-copy');
		await page.keyboard.press('Tab');
		expect(await focused()).toBe('after-share');
	});

	// The share panel sits outside every landmark, for the tab-order test,
	// and axe's region rule flags any content there; this panel is in main.
	test('has no accessibility violations with a panel open', async ({ page }) => {
		await open(page);
		await show(page, 'content');
		expect(await axe(page)).toEqual([]);
	});

	test('a closed panel is not displayed, and an open one on a phone adds no sideways scroll', async ({ page }) => {
		await open(page, { width: 320 });
		expect(await style(page, '#share', 'display')).toBe('none');
		await show(page, 'wide');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
	});
});
