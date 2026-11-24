import { test, expect } from 'playwright/test';
import { stage, rect, style, axe, token } from '../lib/layout.js';

const open = async (page, width = 300) => {
	const response = await page.goto('/test/browser/fixtures/components/subnav.html');
	expect(response.status()).toBe(200);
	await stage(page, width);
};
// A section opens through a transition on its row, which runs on the li that
// holds the details rather than on the details itself, so the wait covers the
// whole item. Two frames first, so the style change that starts the
// transition has happened and getAnimations() reports it.
const settle = (page, selector) => page.evaluate((s) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	.then(() => {
		const el = document.querySelector(s);
		const scope = el.closest('li') ?? el;
		return Promise.all(scope.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
	}), selector);
// WebKit does not tab to links with plain Tab; Alt+Tab is its link-reaching key.
const tab = (page, browserName) => page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');

test.describe('subnav', () => {
	test('a parent is a link with its toggle beside it, and its pages below both', async ({ page }) => {
		await open(page);
		const [link, summary, leaf] = await Promise.all(['#sn-parent-link', '#sn-summary', '#sn-leaf'].map((s) => rect(page, s)));
		expect(Math.abs(link.top - summary.top)).toBeLessThan(2);
		expect(summary.left).toBeGreaterThanOrEqual(link.right - 1);
		expect(leaf.top).toBeGreaterThanOrEqual(link.bottom - 1);
		expect(leaf.left).toBeGreaterThan(link.left);
	});
	test('a section opens in place and pushes what follows down', async ({ page }) => {
		await open(page);
		const before = await rect(page, '#sn-nolink-summary');
		await page.click('#sn-closed-summary');
		await settle(page, '#sn-closed-details');
		await expect(page.locator('#sn-hidden')).toBeVisible();
		expect((await rect(page, '#sn-nolink-summary')).top).toBeGreaterThan(before.top);
	});
	test('the current page and its parent are marked', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: '#sn { --yeti-subnav-current: rgb(10, 11, 12); }' });
		expect(await style(page, '#sn-leaf', 'color')).toBe('rgb(10, 11, 12)');
		expect(await style(page, '#sn-parent-link', 'color')).toBe('rgb(10, 11, 12)');
		expect(await style(page, '#sn-plain', 'color')).not.toBe('rgb(10, 11, 12)');
	});
	test('--yeti-subnav-current-surface fills the current page, and not the parents above it', async ({ page }) => {
		await open(page);
		expect(await style(page, '#sn-leaf', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		await page.addStyleTag({ content: '#sn { --yeti-subnav-current-surface: rgb(13, 14, 15); --yeti-subnav-hover: rgb(7, 8, 9); }' });
		expect(await style(page, '#sn-leaf', 'background-color')).toBe('rgb(13, 14, 15)');
		expect(await style(page, '#sn-parent-link', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		expect(await style(page, '#sn-plain', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		await page.hover('#sn-leaf');
		expect(await style(page, '#sn-leaf', 'background-color')).toBe('rgb(7, 8, 9)');
	});
	test('a parent that is not a page is a plain disclosure with its name in the summary', async ({ page }) => {
		await open(page);
		await expect(page.getByText('Reference')).toBeVisible();
		await page.click('#sn-nolink-summary');
		expect(await page.evaluate(() => document.querySelector('#sn-nolink details').open)).toBe(true);
	});
	test('each toggle has a name, and the page has no accessibility violations', async ({ page }) => {
		await open(page);
		await expect(page.locator('#sn-summary')).toHaveAccessibleName('Layouts pages');
		expect(await axe(page)).toEqual([]);
	});

	test('the current page keeps its strong weight, and its parent does not take it', async ({ page }) => {
		await open(page);
		const strong = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--yeti-weight-strong').trim());
		expect(await style(page, '#sn-leaf', 'font-weight')).toBe(strong);
		expect(await style(page, '#sn-parent-link', 'font-weight')).not.toBe(strong);
	});

	test('a parent whose link wraps keeps its toggle on the first line', async ({ page }) => {
		await open(page, 200);
		await page.evaluate(() => { document.getElementById('sn-parent-link').textContent = 'A parent page whose title runs onto a second line'; });
		const [link, summary, leaf] = await Promise.all(['#sn-parent-link', '#sn-summary', '#sn-leaf'].map((s) => rect(page, s)));
		expect(link.height).toBeGreaterThan(summary.height);
		expect(Math.abs(link.top - summary.top)).toBeLessThan(2);
		expect(summary.left).toBeGreaterThanOrEqual(link.right - 1);
		expect(leaf.top).toBeGreaterThanOrEqual(link.bottom - 1);
	});

	test('a third level nests by the same rules, one indent further', async ({ page }) => {
		await open(page);
		await page.evaluate(() => {
			const li = document.createElement('li');
			li.innerHTML = '<a href="#more" id="sn-l2">More</a><details open><summary aria-label="More pages" id="sn-l2-summary"></summary><ul role="list"><li><a href="#deep" id="sn-l3">Deep</a></li></ul></details>';
			document.querySelector('#sn-details > ul').append(li);
		});
		const indent = await token(page, '--yeti-subnav-indent');
		const [parent, l2, summary, l3] = await Promise.all(['#sn-parent-link', '#sn-l2', '#sn-l2-summary', '#sn-l3'].map((s) => rect(page, s)));
		expect(indent).toBeGreaterThan(0);
		expect(l2.left - parent.left).toBeCloseTo(indent, 0);
		expect(l3.left - l2.left).toBeCloseTo(indent, 0);
		expect(Math.abs(l2.top - summary.top)).toBeLessThan(2);
		expect(summary.left).toBeGreaterThanOrEqual(l2.right - 1);
		expect(l3.top).toBeGreaterThanOrEqual(l2.bottom - 1);
	});

	test('the keyboard reaches a toggle and opens its section', async ({ page, browserName }) => {
		await open(page);
		await page.focus('#sn-closed-link');
		await tab(page, browserName);
		expect(await page.evaluate(() => document.activeElement.id)).toBe('sn-closed-summary');
		await page.keyboard.press('Enter');
		await settle(page, '#sn-closed-details');
		expect(await page.evaluate(() => document.getElementById('sn-closed-details').open)).toBe(true);
		await expect(page.locator('#sn-hidden')).toBeVisible();
	});

	test('focus rings draw whole, inside an open section too', async ({ page, browserName }) => {
		await open(page);
		await page.focus('#sn-plain');
		const seen = [];
		for (let i = 0; i < 5; i++) {
			const ring = await page.evaluate(() => {
				const el = document.activeElement;
				const cs = getComputedStyle(el);
				const grow = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
				const r = el.getBoundingClientRect();
				// A panel's content clips its overflow, and the list inside it is
				// exactly as wide and tall as that content, so a ring that stays
				// inside its own list is never cut.
				const c = el.closest('ul').getBoundingClientRect();
				return { id: el.id, visible: el.matches(':focus-visible'), width: parseFloat(cs.outlineWidth), box: [r.top - grow, r.right + grow, r.bottom + grow, r.left - grow], clip: [c.top, c.right, c.bottom, c.left] };
			});
			seen.push(ring.id);
			expect(ring.visible).toBe(true);
			expect(ring.width).toBeGreaterThan(0);
			expect(ring.box[0]).toBeGreaterThanOrEqual(ring.clip[0] - 0.5);
			expect(ring.box[1]).toBeLessThanOrEqual(ring.clip[1] + 0.5);
			expect(ring.box[2]).toBeLessThanOrEqual(ring.clip[2] + 0.5);
			expect(ring.box[3]).toBeGreaterThanOrEqual(ring.clip[3] - 0.5);
			await tab(page, browserName);
		}
		expect(seen).toEqual(['sn-plain', 'sn-parent-link', 'sn-summary', 'sn-leaf', '']);
	});

	test('right to left, the toggle sits at the start of the row and the pages indent from the right', async ({ page }) => {
		await open(page);
		await page.evaluate(() => { document.getElementById('stage').dir = 'rtl'; });
		const [link, summary, leaf] = await Promise.all(['#sn-parent-link', '#sn-summary', '#sn-leaf'].map((s) => rect(page, s)));
		expect(Math.abs(link.top - summary.top)).toBeLessThan(2);
		expect(summary.right).toBeLessThanOrEqual(link.left + 1);
		expect(leaf.right).toBeLessThan(link.right);
	});

	test('--yeti-subnav-hover sets the fill under the pointer', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: '#sn { --yeti-subnav-hover: rgb(1, 2, 3); }' });
		await page.hover('#sn-plain');
		expect(await style(page, '#sn-plain', 'background-color')).toBe('rgb(1, 2, 3)');
		await page.hover('#sn-summary');
		expect(await style(page, '#sn-summary', 'background-color')).toBe('rgb(1, 2, 3)');
	});
});
