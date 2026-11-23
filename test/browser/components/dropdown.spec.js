import { test, expect } from 'playwright/test';
import { stage, rect, axe, withoutModule } from '../lib/layout.js';

const open = async (page, width = 1000) => {
	const response = await page.goto('/test/browser/fixtures/components/dropdown.html');
	expect(response.status()).toBe(200);
	await stage(page, width);
};
const isOpen = (page, id) => page.evaluate((i) => document.getElementById(i).matches(':popover-open'), id);
const settle = (page, selector) => page.evaluate((s) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	.then(() => Promise.all(document.querySelector(s).getAnimations().map((a) => a.finished.catch(() => {})))), selector);
const anchored = (page) => page.evaluate(() => CSS.supports('anchor-name: --a') && CSS.supports('anchor-scope: --a') && CSS.supports('position-area', 'block-end'));

test.describe('dropdown', () => {
	test('the panel is shut until the trigger is pressed, and Escape shuts it again', async ({ page }) => {
		await open(page);
		expect(await isOpen(page, 'menu-one')).toBe(false);
		await page.click('#trigger-one');
		expect(await isOpen(page, 'menu-one')).toBe(true);
		await page.keyboard.press('Escape');
		expect(await isOpen(page, 'menu-one')).toBe(false);
	});

	test('the panel takes its text and its hover from the dropdown tokens', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: '#menu-one { --yeti-dropdown-text: rgb(1, 2, 3); --yeti-dropdown-hover: rgb(4, 5, 6); }' });
		await page.click('#trigger-one');
		await settle(page, '#menu-one');
		const item = page.locator('#menu-one a').first();
		expect(await item.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(1, 2, 3)');
		await item.hover();
		expect(await item.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(4, 5, 6)');
	});

	test('a click outside shuts it', async ({ page }) => {
		await open(page);
		await page.click('#trigger-one');
		await settle(page, '#menu-one');
		const viewport = page.viewportSize();
		await page.mouse.click(viewport.width - 5, viewport.height - 5);
		expect(await isOpen(page, 'menu-one')).toBe(false);
	});

	test('each panel hangs under its own trigger', async ({ page }) => {
		await open(page);
		test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
		await page.click('#trigger-two');
		await settle(page, '#menu-two');
		const [trigger, panel] = await Promise.all([rect(page, '#trigger-two'), rect(page, '#menu-two')]);
		expect(panel.top).toBeGreaterThanOrEqual(trigger.bottom - 1);
		expect(Math.abs(panel.right - trigger.right)).toBeLessThan(4);
		await page.keyboard.press('Escape');
		await page.click('#trigger-one');
		await settle(page, '#menu-one');
		const [first, firstPanel] = await Promise.all([rect(page, '#trigger-one'), rect(page, '#menu-one')]);
		expect(firstPanel.top).toBeGreaterThanOrEqual(first.bottom - 1);
		// The anchor name is scoped, so this panel hangs off its own trigger
		// rather than off the last one on the page.
		expect(Math.abs(firstPanel.left - first.left)).toBeLessThan(4);
	});

	test('Tab from the trigger reaches the first item', async ({ page, browserName }) => {
		await open(page);
		await page.focus('#trigger-one');
		await page.keyboard.press('Enter');
		await settle(page, '#menu-one');
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
		expect(await page.evaluate(() => document.activeElement.id)).toBe('item-one');
	});

	// The delays make timing part of these assertions, so they poll rather
	// than wait a fixed period.
	const becomes = async (page, id, state) => {
		await expect.poll(() => isOpen(page, id), { timeout: 3000 }).toBe(state);
	};

	test('a hover dropdown opens under the pointer, and a default one does not', async ({ page }) => {
		await open(page);
		expect(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)).toBe(true);
		await page.hover('#trigger-three');
		// The pause is the point: a pointer crossing the trigger on its way
		// somewhere else must not flash the panel open.
		expect(await isOpen(page, 'menu-three')).toBe(false);
		await becomes(page, 'menu-three', true);
		await page.hover('h1');
		expect(await isOpen(page, 'menu-three')).toBe(true);
		await becomes(page, 'menu-three', false);
		// The module is loaded for the whole page, so the opt in has to be what
		// separates these two, not the module's presence.
		await page.hover('#trigger-one');
		await page.waitForTimeout(600);
		expect(await isOpen(page, 'menu-one')).toBe(false);
	});

	test('hovering the open panel keeps it open', async ({ page }) => {
		await open(page);
		await page.hover('#trigger-three');
		await becomes(page, 'menu-three', true);
		await settle(page, '#menu-three');
		await page.hover('#item-three');
		await page.waitForTimeout(600);
		expect(await isOpen(page, 'menu-three')).toBe(true);
	});

	test('the keyboard path is untouched on a hover dropdown', async ({ page }) => {
		await open(page);
		// Park the pointer first: with a fine pointer, reaching the trigger to
		// click it would open the panel by hover before the press landed.
		await page.mouse.move(5, 5);
		await page.focus('#trigger-three');
		await page.keyboard.press('Enter');
		expect(await isOpen(page, 'menu-three')).toBe(true);
		await page.keyboard.press('Escape');
		expect(await isOpen(page, 'menu-three')).toBe(false);
	});

	test('a press closes a panel hover opened, instead of racing it', async ({ page }) => {
		await open(page);
		await page.hover('#trigger-three');
		await becomes(page, 'menu-three', true);
		await page.click('#trigger-three');
		await becomes(page, 'menu-three', false);
	});

	test('pressing to dismiss does not let a pending open spring it back', async ({ page }) => {
		await open(page);
		await page.hover('#trigger-three');
		await becomes(page, 'menu-three', true);
		// Leave and come straight back: the return schedules another open while
		// the panel is still up. The press that follows must cancel it, or the
		// click closes the panel and the stale timer reopens it a moment later.
		await page.hover('h1');
		await page.hover('#trigger-three');
		await page.click('#trigger-three');
		expect(await isOpen(page, 'menu-three')).toBe(false);
		await page.waitForTimeout(600);
		expect(await isOpen(page, 'menu-three')).toBe(false);
	});

	test('that guarantee holds after the panel has once been opened by hover', async ({ page }) => {
		await open(page);
		// showPopover queues its own open toggle, so bookkeeping attached right
		// after the call must not be a once-listener: the open toggle consumed it,
		// the close never cleared the panel from the set, and every later
		// keyboard-open was treated as hover's to close.
		await page.hover('#trigger-three');
		await becomes(page, 'menu-three', true);
		await page.hover('h1');
		await becomes(page, 'menu-three', false);
		await page.mouse.move(5, 5);
		await page.focus('#trigger-three');
		await page.keyboard.press('Enter');
		expect(await isOpen(page, 'menu-three')).toBe(true);
		await page.hover('#trigger-three');
		await page.waitForTimeout(400);
		await page.mouse.move(5, 5);
		await page.waitForTimeout(800);
		expect(await isOpen(page, 'menu-three')).toBe(true);
	});

	test('a panel opened from the keyboard survives the pointer sweeping over it', async ({ page }) => {
		await open(page);
		// Only a panel the module opened is a panel the module may close, or a
		// stray sweep shuts a menu whose trigger still holds focus.
		await page.mouse.move(5, 5);
		await page.focus('#trigger-three');
		await page.keyboard.press('Enter');
		expect(await isOpen(page, 'menu-three')).toBe(true);
		await page.hover('#trigger-three');
		await page.waitForTimeout(400);
		await page.mouse.move(5, 5);
		await page.waitForTimeout(800);
		expect(await isOpen(page, 'menu-three')).toBe(true);
	});

	test('without the module hover does nothing and the click still works', async ({ page }) => {
		await withoutModule(page, 'hover');
		await open(page);
		await page.hover('#trigger-three');
		await page.waitForTimeout(800);
		expect(await isOpen(page, 'menu-three')).toBe(false);
		await page.click('#trigger-three');
		expect(await isOpen(page, 'menu-three')).toBe(true);
	});

	test('a split parent is a link and a square toggle on one row', async ({ page }) => {
		await open(page);
		await page.click('#tree-toggle');
		await settle(page, '#tree-menu');
		const [link, toggle, menu] = await Promise.all([rect(page, '#sub-link'), rect(page, '#sub-toggle'), rect(page, '#tree-menu')]);
		expect(Math.abs(link.top - toggle.top)).toBeLessThan(2);
		expect(toggle.left).toBeGreaterThanOrEqual(link.right - 1);
		expect(toggle.right).toBeLessThanOrEqual(menu.right);
		expect(Math.abs(toggle.width - toggle.height)).toBeLessThan(2);
	});

	test('an empty toggle draws a chevron and has a name', async ({ page }) => {
		await open(page);
		expect(await page.evaluate(() => getComputedStyle(document.querySelector('#tree-toggle'), '::after').content)).not.toBe('none');
		await expect(page.getByRole('button', { name: 'Tree pages' })).toHaveCount(1);
	});

	test('a standalone dropdown button draws no chevron', async ({ page }) => {
		await open(page);
		expect(await page.evaluate(() => getComputedStyle(document.querySelector('#trigger-one'), '::after').content)).toBe('none');
	});

	test('a long parent label wraps and its toggle stays a square on the first line', async ({ page }) => {
		// A popover sits in the top layer, so only the viewport can narrow it.
		await page.setViewportSize({ width: 320, height: 720 });
		await open(page, 320);
		await page.evaluate(() => { document.querySelector('#sub-link').textContent = 'A parent page with a very long name that has to wrap in a narrow panel'; });
		await page.click('#tree-toggle');
		await settle(page, '#tree-menu');
		const [link, toggle, menu] = await Promise.all([rect(page, '#sub-link'), rect(page, '#sub-toggle'), rect(page, '#tree-menu')]);
		expect(link.height).toBeGreaterThan(toggle.height);
		expect(Math.abs(link.top - toggle.top)).toBeLessThan(2);
		expect(toggle.right).toBeLessThanOrEqual(menu.right);
		expect(menu.right).toBeLessThanOrEqual(320);
	});

	test('a label trigger in a panel draws a chevron at the row end', async ({ page }) => {
		await open(page);
		await page.click('#tree-toggle');
		await settle(page, '#tree-menu');
		expect(await page.evaluate(() => getComputedStyle(document.querySelector('#lab-trigger'), '::after').content)).not.toBe('none');
				const { margin, xs } = await page.evaluate(() => {
			const probe = document.createElement('div');
			probe.style.inlineSize = 'var(--yeti-space-xs)';
			document.body.append(probe);
			const xs = probe.getBoundingClientRect().width;
			probe.remove();
			return { margin: parseFloat(getComputedStyle(document.querySelector('#lab-trigger'), '::after').marginInlineStart), xs };
		});
		// An auto margin on a flex item is not reported as a length: the browser
		// gives 0px, where the token's fixed space would give its own length.
		expect(margin).toBeLessThan(1);
		expect(xs).toBeGreaterThan(1);
	});

	const openTree = async (page) => {
		await page.click('#tree-toggle'); await settle(page, '#tree-menu');
		await page.click('#sub-toggle'); await settle(page, '#sub-menu');
	};

	test('a nested panel flies out beside its own row', async ({ page }) => {
		await open(page);
		test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
		await openTree(page);
		const [row, fly, parent] = await Promise.all([rect(page, '#sub'), rect(page, '#sub-menu'), rect(page, '#tree-menu')]);
		expect(fly.left).toBeGreaterThanOrEqual(parent.right - 1);
		expect(Math.abs(fly.top - row.top)).toBeLessThan(8);
	});

	test('it flips to the other side at the viewport edge, and stays on screen', async ({ page }) => {
		await open(page);
		test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
		await page.addStyleTag({ content: '#tree { margin-inline-start: calc(100vw - 16rem); }' });
		await openTree(page);
		const [fly, parent] = await Promise.all([rect(page, '#sub-menu'), rect(page, '#tree-menu')]);
		expect(fly.right).toBeLessThanOrEqual(parent.left + 1);
		expect(fly.left).toBeGreaterThanOrEqual(0);
	});

	test('in a right-to-left page it flies out to the left', async ({ page }) => {
		await open(page);
		test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
		await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
		await openTree(page);
		const [fly, parent] = await Promise.all([rect(page, '#sub-menu'), rect(page, '#tree-menu')]);
		expect(fly.right).toBeLessThanOrEqual(parent.left + 1);
	});

	test('Escape closes the innermost panel and returns focus; a click outside closes the chain', async ({ page }) => {
		await open(page);
		// Opened from the keyboard: WebKit does not focus a button on a mouse click,
		// so after a click there is no focus for Escape to hand back.
		await page.focus('#tree-toggle'); await page.keyboard.press('Enter'); await settle(page, '#tree-menu');
		await page.focus('#sub-toggle'); await page.keyboard.press('Enter'); await settle(page, '#sub-menu');
		await page.keyboard.press('Escape');
		expect(await isOpen(page, 'sub-menu')).toBe(false);
		expect(await isOpen(page, 'tree-menu')).toBe(true);
		expect(await page.evaluate(() => document.activeElement.id)).toBe('sub-toggle');
		await page.click('#sub-toggle'); await settle(page, '#sub-menu');
		const v = page.viewportSize();
		await page.mouse.click(v.width - 5, v.height - 5);
		expect(await isOpen(page, 'tree-menu')).toBe(false);
		expect(await isOpen(page, 'sub-menu')).toBe(false);
	});

	test('opening a sibling submenu closes the one beside it and keeps their parent open', async ({ page }) => {
		await open(page);
		await openTree(page);
		await page.click('#lab-trigger'); await settle(page, '#lab-menu');
		expect(await isOpen(page, 'lab-menu')).toBe(true);
		expect(await isOpen(page, 'sub-menu')).toBe(false);
		expect(await isOpen(page, 'tree-menu')).toBe(true);
	});

	const turn = (page, sel) => page.evaluate((s) => {
		const cs = getComputedStyle(document.querySelector(s), '::after');
		return `${cs.rotate}|${cs.transform}`;
	}, sel);

	test('a first-level chevron points down and turns up while its panel is open', async ({ page }) => {
		await open(page);
		const closed = await turn(page, '#tree-toggle');
		await page.click('#tree-toggle'); await settle(page, '#tree-menu');
		const opened = await turn(page, '#tree-toggle');
		expect(opened).not.toBe(closed);
	});

	test('a nested chevron points to the inline end and turns back while its panel is open', async ({ page }) => {
		await open(page);
		await page.click('#tree-toggle'); await settle(page, '#tree-menu');
		const first = await turn(page, '#tree-toggle');
		const closed = await turn(page, '#sub-toggle');
		expect(closed).not.toBe(first);
		await page.click('#sub-toggle'); await settle(page, '#sub-menu');
		expect(await turn(page, '#sub-toggle')).not.toBe(closed);
		const labClosed = await turn(page, '#lab-trigger');
		expect(labClosed).toBe(closed);
		await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
		expect(await turn(page, '#lab-trigger')).not.toBe(labClosed);
	});

	test('has no accessibility violations, shut and open', async ({ page }) => {
		await open(page);
		expect(await axe(page)).toEqual([]);
		await page.click('#trigger-one');
		await settle(page, '#menu-one');
		expect(await axe(page)).toEqual([]);
	});
});
