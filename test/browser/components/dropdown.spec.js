import { test, expect } from 'playwright/test';
import { stage, rect, style, axe, withoutModule, token } from '../lib/layout.js';

const open = async (page, width = 1000) => {
	const response = await page.goto('/test/browser/fixtures/components/dropdown.html');
	expect(response.status()).toBe(200);
	await stage(page, width);
};
const isOpen = (page, id) => page.evaluate((i) => document.getElementById(i).matches(':popover-open'), id);
const settle = (page, selector) => page.evaluate((s) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	.then(() => Promise.all(document.querySelector(s).getAnimations().map((a) => a.finished.catch(() => {})))), selector);
const anchored = (page) => page.evaluate(() => CSS.supports('anchor-name: --a') && CSS.supports('anchor-scope: --a') && CSS.supports('position-area', 'block-end'));
// The room left between a trigger's chevron and the end of its content box, in
// a left-to-right page. A pseudo-element has no box to measure, so its end is
// the label's end plus the flex gap, the chevron's used margin and its width.
const chevronRoom = (page, selector) => page.evaluate((s) => {
	const el = document.querySelector(s);
	const cs = getComputedStyle(el);
	const after = getComputedStyle(el, '::after');
	const range = document.createRange();
	range.selectNodeContents(el);
	const end = range.getBoundingClientRect().right + (parseFloat(cs.columnGap) || 0) + parseFloat(after.marginInlineStart) + parseFloat(after.width);
	return el.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) - end;
}, selector);

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

	test('an item is rounded inside a rounded panel, and square inside a square one', async ({ page }) => {
		await open(page);
		await page.click('#trigger-one');
		await settle(page, '#menu-one');
		// The panel's radius less its padding is nothing with the default
		// tokens, so the item falls back to the small radius for its fill.
		const small = await token(page, '--yeti-radius-sm');
		expect(small).toBeGreaterThan(0);
		for (const item of ['#menu-one a', '#menu-one button']) expect(parseFloat(await style(page, item, 'border-top-left-radius')), item).toBeCloseTo(small, 1);
		// A panel rounded past its padding keeps the corners concentric.
		await page.addStyleTag({ content: '#menu-one { --yeti-dropdown-radius: 20px; --yeti-dropdown-padding: 6px; }' });
		expect(parseFloat(await style(page, '#menu-one a', 'border-top-left-radius'))).toBeCloseTo(14, 1);
		// A theme that squares the panel squares its items with it.
		await page.addStyleTag({ content: '#menu-one { --yeti-dropdown-radius: 0px; }' });
		expect(parseFloat(await style(page, '#menu-one a', 'border-top-left-radius'))).toBe(0);
	});

	test('a split parent\'s toggle in a panel takes the same corners as an item', async ({ page }) => {
		await open(page);
		await page.click('#tree-toggle');
		await settle(page, '#tree-menu');
		expect(parseFloat(await style(page, '#sub-toggle', 'border-top-left-radius'))).toBeCloseTo(await token(page, '--yeti-radius-sm'), 1);
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
		// A longer open delay gives the "still shut" check below room to land
		// before the timer, which a slow engine could otherwise lose.
		await page.addStyleTag({ content: '#third { --yeti-dropdown-open-delay: 400ms; }' });
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

	test('hover opens each level in turn, and leaving for the page closes them all', async ({ page }) => {
		await open(page);
		await page.hover('#h-tree-toggle');
		await becomes(page, 'h-tree-menu', true);
		await page.hover('#h-sub-toggle');
		await becomes(page, 'h-sub-menu', true);
		await page.hover('#h-leaf');
		expect(await isOpen(page, 'h-tree-menu')).toBe(true);
		const v = page.viewportSize();
		await page.mouse.move(v.width - 5, v.height - 5);
		await becomes(page, 'h-sub-menu', false);
		await becomes(page, 'h-tree-menu', false);
	});

	test('hover leaves alone a panel that is already shown in flow', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: '#h-tree { --yeti-dropdown-open-delay: 0ms; }' });
		// The control: the same steps open the panel when it is not in flow.
		await page.hover('#h-tree-toggle');
		await becomes(page, 'h-tree-menu', true);
		await page.keyboard.press('Escape');
		await becomes(page, 'h-tree-menu', false);
		await page.hover('h1');
		await page.addStyleTag({ content: '#h-tree-menu:not(:popover-open) { display: block; position: static; }' });
		await page.hover('#h-tree-toggle');
		await page.evaluate(() => new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 0)));
		expect(await isOpen(page, 'h-tree-menu')).toBe(false);
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

	test('a press at a nested level is not raced by its pending open', async ({ page }) => {
		await open(page);
		// A long open delay keeps the re-entry's open pending when the press lands.
		await page.addStyleTag({ content: '#h-tree { --yeti-dropdown-open-delay: 300ms; }' });
		await page.hover('#h-tree-toggle');
		await becomes(page, 'h-tree-menu', true);
		await page.hover('#h-sub-toggle');
		await becomes(page, 'h-sub-menu', true);
		await page.hover('#h-tree-plain');
		await page.hover('#h-sub-toggle');
		await page.click('#h-sub-toggle');
		expect(await isOpen(page, 'h-sub-menu')).toBe(false);
		await page.waitForTimeout(700);
		expect(await isOpen(page, 'h-sub-menu')).toBe(false);
	});

	test('coming back over a submenu within the close delay keeps its parents open', async ({ page }) => {
		await open(page);
		await page.addStyleTag({ content: '#h-tree { --yeti-dropdown-close-delay: 400ms; }' });
		await page.hover('#h-tree-toggle');
		await becomes(page, 'h-tree-menu', true);
		await page.hover('#h-sub-toggle');
		await becomes(page, 'h-sub-menu', true);
		// Really leave every wrapper so a close is scheduled for each, then
		// return to the leaf well inside the delay.
		const v = page.viewportSize();
		await page.mouse.move(v.width - 5, v.height - 5);
		await page.hover('#h-leaf');
		// Nothing to wait on but the absence of a close, so wait past the delay.
		await page.waitForTimeout(900);
		expect(await isOpen(page, 'h-sub-menu')).toBe(true);
		expect(await isOpen(page, 'h-tree-menu')).toBe(true);
	});

	test('a button in a hover panel that opens a popover elsewhere is not a submenu', async ({ page }) => {
		await open(page);
		await page.hover('#h-share-trigger');
		await becomes(page, 'h-share-menu', true);
		await settle(page, '#h-share-menu');
		// Resting on an item past the open delay must not open the popover that
		// a button beside it names: that popover is not this panel's child, so
		// its button is not a submenu's trigger.
		await page.hover('#h-share-link');
		await page.waitForTimeout(600);
		expect(await isOpen(page, 'h-share-menu')).toBe(true);
		expect(await isOpen(page, 'h-other')).toBe(false);
		await page.click('#h-other-button');
		expect(await isOpen(page, 'h-other')).toBe(true);
	});

	test('a hover panel that holds a button and the popover it names is not itself a submenu', async ({ page }) => {
		await open(page);
		// The same button, with its popover now the panel's own child. The panel
		// then holds a trigger and the panel that trigger names, which is the
		// shape of a submenu's wrapper, but a panel is never a wrapper.
		await page.evaluate(() => document.getElementById('h-share-menu').append(document.getElementById('h-other')));
		await page.hover('#h-share-trigger');
		await becomes(page, 'h-share-menu', true);
		await settle(page, '#h-share-menu');
		await page.hover('#h-share-link');
		await page.waitForTimeout(600);
		expect(await isOpen(page, 'h-share-menu')).toBe(true);
		expect(await isOpen(page, 'h-other')).toBe(false);
		await page.click('#h-other-button');
		expect(await isOpen(page, 'h-other')).toBe(true);
	});

	test('from a split parent\'s link the pointer goes straight down into its hover panel', async ({ page }) => {
		await open(page);
		test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
		await page.addStyleTag({ content: '#h-tree { --yeti-dropdown-close-delay: 300ms; }' });
		await page.hover('#h-tree-link');
		await becomes(page, 'h-tree-menu', true);
		await settle(page, '#h-tree-menu');
		const [link, menu] = await Promise.all([rect(page, '#h-tree-link'), rect(page, '#h-tree-menu')]);
		await page.mouse.move((link.left + link.right) / 2, menu.top + 12, { steps: 12 });
		// Nothing to wait on but the absence of a close, so wait past the delay.
		await page.waitForTimeout(700);
		expect(await isOpen(page, 'h-tree-menu')).toBe(true);
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
		// Firefox reports the edge a hair past the viewport.
		expect(menu.right).toBeLessThanOrEqual(320.5);
	});

	test('a button in a list panel fills its row, so a label trigger\'s chevron is at the row end', async ({ page }) => {
		await open(page);
		await page.evaluate(() => document.querySelector('#tree-menu').insertAdjacentHTML('beforeend', '<li id="plain-button-row"><button type="button" id="plain-button">Sign out</button></li>'));
		await page.click('#tree-toggle');
		await settle(page, '#tree-menu');
		expect(await page.evaluate(() => getComputedStyle(document.querySelector('#lab-trigger'), '::after').content)).not.toBe('none');
		for (const [button, row] of [['#lab-trigger', '#lab'], ['#plain-button', '#plain-button-row']]) {
			const [b, r] = await Promise.all([rect(page, button), rect(page, row)]);
			expect(Math.abs(b.right - r.right), `${button} reaches its row's end`).toBeLessThanOrEqual(2);
			expect(Math.abs(b.width - r.width), `${button} is as wide as its row`).toBeLessThanOrEqual(2);
		}
		expect(await chevronRoom(page, '#lab-trigger')).toBeLessThan(2);
		// The split toggle is a button in a row too, and stays a square.
		const toggle = await rect(page, '#sub-toggle');
		expect(Math.abs(toggle.width - toggle.height)).toBeLessThan(2);
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

	test('in a right-to-left page it flips to the right at the viewport edge, and stays on screen', async ({ page }) => {
		await open(page);
		test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
		await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
		// The inline start is the right, so this pushes the tree to the left edge.
		await page.addStyleTag({ content: '#tree { margin-inline-start: calc(100vw - 16rem); }' });
		await openTree(page);
		const [fly, parent] = await Promise.all([rect(page, '#sub-menu'), rect(page, '#tree-menu')]);
		expect(parent.left).toBeLessThan(fly.width);
		expect(fly.left).toBeGreaterThanOrEqual(parent.right - 1);
		expect(fly.left).toBeGreaterThanOrEqual(0);
		expect(fly.right).toBeLessThanOrEqual(page.viewportSize().width + 0.5);
	});

	test('with data-side="end" a split parent\'s panel lines up with the end of its row', async ({ page }) => {
		await open(page);
		test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
		await page.evaluate(() => document.querySelector('#tree').setAttribute('data-side', 'end'));
		await page.addStyleTag({ content: '#tree { margin-inline-start: 20rem; }' });
		await page.click('#tree-toggle');
		await settle(page, '#tree-menu');
		const [row, menu] = await Promise.all([rect(page, '#tree'), rect(page, '#tree-menu')]);
		expect(Math.abs(menu.right - row.right)).toBeLessThanOrEqual(2);
		expect(menu.top).toBeGreaterThanOrEqual(row.bottom - 1);
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

	// The chevron is drawn with its physical bottom and right borders, so an
	// angle means the same direction in either page direction: 45 is down,
	// -45 right, 135 left, 225 up.
	const angle = (page, sel) => page.evaluate((s) => {
		const deg = parseFloat(getComputedStyle(document.querySelector(s), '::after').rotate);
		return ((deg % 360) + 360) % 360;
	}, sel);
	const DOWN = 45, UP = 225, RIGHT = 315, LEFT = 135;

	for (const dir of ['ltr', 'rtl']) {
		test(`chevrons point the right way in a ${dir} page`, async ({ page }) => {
			await open(page);
			await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
			const inlineEnd = dir === 'ltr' ? RIGHT : LEFT;
			const inlineStart = dir === 'ltr' ? LEFT : RIGHT;
			expect(await angle(page, '#tree-toggle')).toBe(DOWN);
			await page.click('#tree-toggle'); await settle(page, '#tree-menu');
			expect(await angle(page, '#tree-toggle')).toBe(UP);
			expect(await angle(page, '#sub-toggle')).toBe(inlineEnd);
			expect(await angle(page, '#lab-trigger')).toBe(inlineEnd);
			await page.click('#sub-toggle'); await settle(page, '#sub-menu');
			expect(await angle(page, '#sub-toggle')).toBe(inlineStart);
			expect(await angle(page, '#tree-toggle')).toBe(UP);
			const borders = await page.evaluate(() => {
				const cs = getComputedStyle(document.querySelector('#sub-toggle'), '::after');
				return [cs.borderBottomWidth, cs.borderRightWidth, cs.borderTopWidth, cs.borderLeftWidth].map(parseFloat);
			});
			expect(borders[0]).toBeGreaterThan(0);
			expect(borders[1]).toBeGreaterThan(0);
			expect(borders[2]).toBe(0);
			expect(borders[3]).toBe(0);
		});
	}

	test.describe('grouped', () => {
		const openGrouped = async (page, width = 1000) => {
			await open(page, width);
			await page.click('#g-tree-toggle');
			await settle(page, '#g-tree-menu');
		};

		test('a grouped dropdown lists the pages of each section under its heading, in columns', async ({ page }) => {
			await openGrouped(page);
			const [a, a1, b, b1] = await Promise.all(['#g-a-link', '#g-a-1', '#g-b-link', '#g-b-1'].map((s) => rect(page, s)));
			expect(a1.top).toBeGreaterThanOrEqual(a.bottom - 1);
			expect(b.left).toBeGreaterThanOrEqual(a.right - 1);
			expect(Math.abs(a.top - b.top)).toBeLessThan(2);
			expect(b1.top).toBeGreaterThanOrEqual(b.bottom - 1);
			await expect(page.locator('#g-a-toggle')).toBeHidden();
			expect(await isOpen(page, 'g-a-menu')).toBe(false);
		});

		test('a heading takes the strong weight and the small size', async ({ page }) => {
			await openGrouped(page);
			expect(Number(await style(page, '#g-a-link', 'font-weight'))).toBeGreaterThan(Number(await style(page, '#g-a-1', 'font-weight')));
			expect(parseFloat(await style(page, '#g-a-link', 'font-size'))).toBeLessThan(parseFloat(await style(page, '#g-a-1', 'font-size')));
		});

		test('an item with no pages sits in the grid as a column of its own', async ({ page }) => {
			await openGrouped(page);
			const [a, b, plain] = await Promise.all(['#g-a-link', '#g-b-link', '#g-plain'].map((s) => rect(page, s)));
			expect(plain.left).toBeGreaterThanOrEqual(b.right - 1);
			expect(Math.abs(plain.top - a.top)).toBeLessThan(2);
			expect((await rect(page, '#g-b-link')).left).toBeGreaterThanOrEqual((await rect(page, '#g-a-link')).right - 1);
		});

		test('a fourth level is not shown', async ({ page }) => {
			await page.goto('/test/browser/fixtures/components/dropdown.html');
			await page.evaluate(() => {
				const item = document.querySelector('#g-a-1').parentElement;
				item.classList.add('dropdown');
				item.insertAdjacentHTML('beforeend', '<button type="button" popovertarget="g-deep" id="g-deep-toggle" aria-label="Deep pages"></button><ul id="g-deep" popover role="list"><li><a href="#" id="g-deep-leaf">Deep leaf</a></li></ul>');
			});
			await stage(page, 1000);
			await page.click('#g-tree-toggle');
			await settle(page, '#g-tree-menu');
			await expect(page.locator('#g-a-1')).toBeVisible();
			await expect(page.locator('#g-deep-leaf')).toBeHidden();
			await expect(page.locator('#g-deep-toggle')).toBeHidden();
		});

		test('a label-only section keeps its button and flies out as a card without covering the others', async ({ page }) => {
			await openGrouped(page);
			await expect(page.locator('#g-lab-leaf')).toBeHidden();
			expect(await isOpen(page, 'g-lab-menu')).toBe(false);
			await page.click('#g-lab-trigger');
			await settle(page, '#g-lab-menu');
			expect(await isOpen(page, 'g-lab-menu')).toBe(true);
			expect(await style(page, '#g-lab-menu', 'background-color')).not.toBe('rgba(0, 0, 0, 0)');
			const menu = await rect(page, '#g-lab-menu');
			for (const id of ['#g-a', '#g-b']) {
				const r = await rect(page, id);
				const apart = menu.right <= r.left + 1 || menu.left >= r.right - 1 || menu.bottom <= r.top + 1 || menu.top >= r.bottom - 1;
				expect(apart, `${id} is not covered`).toBe(true);
			}
			const own = await rect(page, '#g-lab');
			expect(own.width).toBeGreaterThan(100);
			await expect(page.locator('#g-a-1')).toBeVisible();
			await expect(page.locator('#g-b-1')).toBeVisible();
		});

		test('a label-only item at the third level is not shown', async ({ page }) => {
			await page.goto('/test/browser/fixtures/components/dropdown.html');
			await page.evaluate(() => {
				document.querySelector('#g-a-menu').insertAdjacentHTML('beforeend', '<li class="dropdown" id="g-deep-lab"><button type="button" popovertarget="g-deep-lab-menu" id="g-deep-lab-trigger">Deep label</button><ul id="g-deep-lab-menu" popover role="list"><li><a href="#" id="g-deep-lab-leaf">Deep label leaf</a></li></ul></li>');
			});
			await stage(page, 1000);
			await page.click('#g-tree-toggle');
			await settle(page, '#g-tree-menu');
			await expect(page.locator('#g-a-1')).toBeVisible();
			await expect(page.locator('#g-deep-lab-trigger')).toBeHidden();
			await expect(page.locator('#g-deep-lab-leaf')).toBeHidden();
		});

		test('far along the line the panel still holds its columns and stays on screen', async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 720 });
			await open(page, 1280);
			test.skip(!(await anchored(page)) || !(await page.evaluate(() => CSS.supports('position-try-fallbacks', 'flip-inline'))), 'anchor positioning is missing, so the user agent centres the panel');
			await page.addStyleTag({ content: '#g-tree { margin-inline-start: calc(100vw - 12rem); }' });
			await page.click('#g-tree-toggle');
			await settle(page, '#g-tree-menu');
			const [a, b, menu, toggle] = await Promise.all(['#g-a-link', '#g-b-link', '#g-tree-menu', '#g-tree-toggle'].map((s) => rect(page, s)));
			expect(Math.abs(a.top - b.top)).toBeLessThan(2);
			expect(b.left).toBeGreaterThanOrEqual(a.right - 1);
			expect(menu.left).toBeGreaterThanOrEqual(0);
			expect(menu.right).toBeLessThanOrEqual(1280.5);
			expect(menu.top).toBeGreaterThanOrEqual(toggle.bottom - 1);
		});

		test('its columns stack when the viewport is too narrow for them', async ({ page }) => {
			// A popover sits in the top layer, so only the viewport can narrow it.
			await page.setViewportSize({ width: 320, height: 720 });
			await openGrouped(page, 320);
			const [a, b, menu] = await Promise.all(['#g-a-link', '#g-b-link', '#g-tree-menu'].map((s) => rect(page, s)));
			expect(b.top).toBeGreaterThan(a.bottom);
			expect(menu.right).toBeLessThanOrEqual(320.5);
			expect(menu.left).toBeGreaterThanOrEqual(0);
		});

		test('hover opens the top panel only, and the sections stay in place', async ({ page }) => {
			await open(page);
			await page.evaluate(() => {
				const tree = document.querySelector('#g-tree');
				tree.setAttribute('data-trigger', 'hover');
				tree.style.setProperty('--yeti-dropdown-open-delay', '0ms');
			});
			await page.hover('#g-tree-toggle');
			await becomes(page, 'g-tree-menu', true);
			await settle(page, '#g-tree-menu');
			await page.hover('#g-a-link');
			await page.evaluate(() => new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 0)));
			expect(await isOpen(page, 'g-a-menu')).toBe(false);
			await expect(page.locator('#g-a-1')).toBeVisible();
		});

		test('Tab walks each column in reading order and skips the hidden toggles', async ({ page, browserName }) => {
			await openGrouped(page);
			await page.focus('#g-tree-toggle');
			const order = [];
			for (let i = 0; i < 6; i++) {
				await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
				order.push(await page.evaluate(() => document.activeElement.id));
			}
			expect(order).toEqual(['g-a-link', 'g-a-1', 'g-a-2', 'g-b-link', 'g-b-1', 'g-b-2']);
		});

		test('the current page keeps its look and an ancestor heading takes the ancestor color', async ({ page }) => {
			await open(page);
			await page.evaluate(() => document.querySelector('#g-b-1').setAttribute('aria-current', 'page'));
			await page.click('#g-tree-toggle');
			await settle(page, '#g-tree-menu');
			const current = await style(page, '#g-b-1', 'color');
			expect(await style(page, '#g-b-link', 'color')).toBe(current);
			expect(await style(page, '#g-a-link', 'color')).not.toBe(current);
			expect(Number(await style(page, '#g-b-1', 'font-weight'))).toBeGreaterThanOrEqual(Number(await style(page, '#g-a-1', 'font-weight')));
		});
	});

	test.describe('a .button in a panel', () => {
		const looks = ['background-color', 'color', 'border-top-left-radius', 'padding-inline-start', 'padding-inline-end', 'font-weight'];
		const read = (page, selector) => page.evaluate(([s, props]) => {
			const cs = getComputedStyle(document.querySelector(s));
			return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
		}, [selector, looks]);
		const openCta = async (page) => {
			await open(page);
			await page.click('#cta-trigger');
			await settle(page, '#cta-menu');
			await settle(page, '#cta-link');
			await settle(page, '#cta-button');
		};

		test('a .button link keeps the look it has outside a panel', async ({ page }) => {
			await openCta(page);
			expect(await read(page, '#cta-link')).toEqual(await read(page, '#ref-button-link'));
		});

		test('a .button button keeps the look it has outside a panel', async ({ page }) => {
			await openCta(page);
			expect(await read(page, '#cta-button')).toEqual(await read(page, '#ref-button'));
		});

		test('under the pointer it takes the button\'s hover fill, not the row hover', async ({ page }) => {
			await open(page);
			await page.addStyleTag({ content: '#cta-menu { --yeti-dropdown-hover: rgb(4, 5, 6); }' });
			await page.hover('#ref-button');
			await settle(page, '#ref-button');
			const hovered = await style(page, '#ref-button', 'background-color');
			await page.mouse.move(5, 5);
			await page.click('#cta-trigger');
			await settle(page, '#cta-menu');
			await page.hover('#cta-button');
			await settle(page, '#cta-button');
			const fill = await style(page, '#cta-button', 'background-color');
			expect(fill).toBe(hovered);
			expect(fill).not.toBe('rgb(4, 5, 6)');
		});

		test('a plain link beside it is still a menu row', async ({ page }) => {
			await openCta(page);
			const row = ['padding-inline-start', 'padding-inline-end', 'border-top-left-radius', 'min-block-size'];
			for (const p of row) expect(await style(page, '#cta-plain', p), p).toBe(await style(page, '#menu-one a', p));
			const [plain, panel] = await Promise.all([rect(page, '#cta-plain'), rect(page, '#cta-menu')]);
			const pad = await token(page, '--yeti-dropdown-padding');
			expect(Math.abs(plain.width - (panel.width - 2 * pad))).toBeLessThan(1);
		});
	});

	test.describe('the screen edge', () => {
		const supported = (page) => page.evaluate(() => CSS.supports('anchor-name: --a') && CSS.supports('anchor-scope: --a') && CSS.supports('position-area', 'block-end') && CSS.supports('position-try-fallbacks', 'flip-inline'));
		const openWide = async (page, { dir = 'ltr', at = 'calc(100vw - 12rem)', narrow = false, side } = {}) => {
			await page.setViewportSize({ width: 1280, height: 720 });
			await open(page, 1280);
			test.skip(!(await supported(page)), 'anchor positioning or position-try is missing, so the user agent centres the panel');
			await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
			await page.addStyleTag({ content: `#wide { margin-inline-start: ${at}; }` });
			if (narrow) await page.evaluate(() => document.querySelector('#wide').style.removeProperty('--yeti-dropdown-min'));
			if (side) await page.evaluate((v) => document.querySelector('#wide').setAttribute('data-side', v), side);
			await page.click('#wide-trigger');
			await settle(page, '#wide-menu');
			return { md: await token(page, '--yeti-space-md'), end: await page.evaluate(() => document.documentElement.clientWidth) };
		};

		test('a wide panel that moves in to fit keeps a margin from the end edge', async ({ page }) => {
			const { md, end } = await openWide(page);
			const menu = await rect(page, '#wide-menu');
			expect(md).toBeGreaterThan(0);
			expect(end - menu.right).toBeGreaterThanOrEqual(md - 0.5);
			expect(menu.left).toBeGreaterThanOrEqual(0);
		});

		test('in a right-to-left page it keeps the margin from the left edge', async ({ page }) => {
			const { md, end } = await openWide(page, { dir: 'rtl' });
			const menu = await rect(page, '#wide-menu');
			expect(menu.left).toBeGreaterThanOrEqual(md - 0.5);
			expect(menu.right).toBeLessThanOrEqual(end + 0.5);
		});

		test('with data-side="end" near the start of the page it keeps the margin from the start edge', async ({ page }) => {
			const { md, end } = await openWide(page, { at: '2rem', side: 'end' });
			const menu = await rect(page, '#wide-menu');
			// Moved in toward the start, its side, and set against that margin.
			expect(Math.abs(menu.left - md)).toBeLessThan(1);
			expect(menu.right).toBeLessThanOrEqual(end + 0.5);
		});

		test('a grouped dropdown inside another panel keeps the margin fallback, and a plain flyout keeps its flip', async ({ page }) => {
			await open(page);
			test.skip(!(await supported(page)), 'anchor positioning or position-try is missing, so the user agent centres the panel');
			await page.evaluate(() => document.querySelector('#sub').setAttribute('data-grouped', ''));
			await openTree(page);
			expect(await style(page, '#sub-menu', 'position-try-fallbacks')).toBe('--yeti-dropdown-edge');
			await page.evaluate(() => document.querySelector('#sub').setAttribute('data-side', 'end'));
			expect(await style(page, '#sub-menu', 'position-try-fallbacks')).toBe('--yeti-dropdown-edge-start');
			await page.evaluate(() => document.querySelector('#sub').removeAttribute('data-grouped'));
			expect(await style(page, '#sub-menu', 'position-try-fallbacks')).toBe('flip-inline');
		});

		test('a narrow panel that fits beside the same trigger still lines up with it', async ({ page }) => {
			await openWide(page, { at: 'calc(100vw - 20rem)', narrow: true });
			const [trigger, menu] = await Promise.all([rect(page, '#wide-trigger'), rect(page, '#wide-menu')]);
			expect(Math.abs(menu.left - trigger.left)).toBeLessThan(2);
			expect(menu.top).toBeGreaterThanOrEqual(trigger.bottom - 1);
		});
	});

	test.describe('the room it has', () => {
		// A short screen, so a long panel cannot fit below its trigger.
		const short = async (page) => {
			await page.setViewportSize({ width: 1000, height: 600 });
			await open(page);
		};
		const fill = (page, id, count) => page.evaluate(([i, n]) => {
			const panel = document.getElementById(i);
			const list = panel.matches('ul');
			for (let k = 0; k < n; k += 1) {
				const link = document.createElement('a');
				link.href = '#';
				link.id = `${i}-${k}`;
				link.textContent = `Page ${k + 1}`;
				if (list) {
					const li = document.createElement('li');
					li.append(link);
					panel.append(li);
				} else panel.append(link);
			}
		}, [id, count]);
		const scrolls = (page, id) => page.evaluate((i) => { const el = document.getElementById(i); return el.scrollHeight > el.clientHeight; }, id);
		const inside = (inner, outer) => inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5 && inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5;
		const screen = (page) => page.evaluate(() => ({ top: 0, left: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight }));

		test('a panel taller than the room below its trigger stops at the viewport and scrolls inside itself', async ({ page }) => {
			await short(page);
			await fill(page, 'menu-one', 60);
			await page.click('#trigger-one');
			await settle(page, '#menu-one');
			const [panel, view, trigger] = await Promise.all([rect(page, '#menu-one'), screen(page), rect(page, '#trigger-one')]);
			expect(panel.bottom).toBeLessThanOrEqual(view.bottom + 0.5);
			expect(panel.top).toBeGreaterThanOrEqual(0);
			if (await anchored(page)) expect(panel.top).toBeGreaterThanOrEqual(trigger.bottom - 0.5);
			expect(await scrolls(page, 'menu-one')).toBe(true);
			await page.evaluate(() => document.getElementById('menu-one-59').scrollIntoView({ block: 'nearest' }));
			await expect.poll(async () => {
				const [last, box] = await Promise.all([rect(page, '#menu-one-59'), rect(page, '#menu-one')]);
				return inside(last, box) && inside(last, view);
			}).toBe(true);
			expect(await isOpen(page, 'menu-one')).toBe(true);
		});

		// The Account dropdown, fixed with its trigger 24px above the bottom of
		// the screen, so its panel has almost no room below it.
		const low = (page) => page.addStyleTag({ content: '#first { position: fixed; inset-block-end: 24px; inset-inline-start: 20px; }' });
		const box = (page, id) => page.evaluate((i) => {
			const el = document.getElementById(i);
			const r = el.getBoundingClientRect();
			return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, scroll: el.scrollHeight, client: el.clientHeight };
		}, id);

		test('a short panel low on the screen is as tall as it is at the top, whole and on the screen', async ({ page }) => {
			await short(page);
			await page.click('#trigger-one');
			await settle(page, '#menu-one');
			const high = await box(page, 'menu-one');
			await page.keyboard.press('Escape');
			await low(page);
			expect((await rect(page, '#trigger-one')).bottom).toBeCloseTo(576, 0);
			await page.click('#trigger-one');
			await settle(page, '#menu-one');
			const [panel, view] = await Promise.all([box(page, 'menu-one'), screen(page)]);
			expect(panel.height).toBeCloseTo(high.height, 0);
			expect(panel.scroll).toBe(panel.client);
			expect(high.scroll).toBe(high.client);
			expect(inside(panel, view)).toBe(true);
		});

		test('a long panel low on the screen is at most half the viewport tall, on the screen, and scrolls', async ({ page }) => {
			await short(page);
			await fill(page, 'menu-one', 60);
			await low(page);
			await page.click('#trigger-one');
			await settle(page, '#menu-one');
			const [panel, view] = await Promise.all([box(page, 'menu-one'), screen(page)]);
			expect(panel.height).toBeLessThanOrEqual(view.bottom / 2 + 1);
			expect(inside(panel, view)).toBe(true);
			expect(panel.scroll).toBeGreaterThan(panel.client);
		});

		test('a nested flyout taller than the viewport stays inside it and scrolls', async ({ page }) => {
			await short(page);
			test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
			await fill(page, 'sub-menu', 60);
			await openTree(page);
			const [fly, view] = await Promise.all([rect(page, '#sub-menu'), screen(page)]);
			expect(inside(fly, view)).toBe(true);
			expect(await scrolls(page, 'sub-menu')).toBe(true);
		});

		test('a short flyout from a row low on the screen is whole and on the screen', async ({ page }) => {
			await short(page);
			test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
			await fill(page, 'sub-menu', 5);
			await page.addStyleTag({ content: '#tree { position: fixed; inset-block-start: 380px; inset-inline-start: 20px; }' });
			await openTree(page);
			const [fly, view, row] = await Promise.all([box(page, 'sub-menu'), screen(page), rect(page, '#sub')]);
			// Six rows do not fit between the row's top and the bottom of the screen.
			expect(fly.height).toBeGreaterThan(view.bottom - row.top);
			expect(fly.scroll).toBe(fly.client);
			expect(inside(fly, view)).toBe(true);
		});

		test('a grouped panel taller than the room keeps its columns and scrolls', async ({ page }) => {
			await short(page);
			await fill(page, 'g-a-menu', 60);
			await page.click('#g-tree-toggle');
			await settle(page, '#g-tree-menu');
			const [menu, view, a, b] = await Promise.all([rect(page, '#g-tree-menu'), screen(page), rect(page, '#g-a-link'), rect(page, '#g-b-link')]);
			expect(menu.bottom).toBeLessThanOrEqual(view.bottom + 0.5);
			expect(await scrolls(page, 'g-tree-menu')).toBe(true);
			expect(Math.abs(a.top - b.top)).toBeLessThan(2);
		});

		test('the focus ring of the first and last row is drawn whole inside a panel that scrolls', async ({ page, browserName }) => {
			await short(page);
			await fill(page, 'menu-one', 60);
			await page.focus('#trigger-one');
			await page.keyboard.press('Enter');
			await settle(page, '#menu-one');
			const ring = (id) => page.evaluate((i) => {
				const el = document.getElementById(i);
				el.focus({ focusVisible: true });
				el.scrollIntoView({ block: 'nearest' });
				const cs = getComputedStyle(el);
				const grow = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
				const r = el.getBoundingClientRect();
				const panel = el.closest('[popover]');
				const p = panel.getBoundingClientRect();
				// The scroll box is the panel's padding box.
				const box = { top: p.top + panel.clientTop, left: p.left + panel.clientLeft, right: p.left + panel.clientLeft + panel.clientWidth, bottom: p.top + panel.clientTop + panel.clientHeight };
				return { visible: el.matches(':focus-visible'), width: parseFloat(cs.outlineWidth), ring: { top: r.top - grow, right: r.right + grow, bottom: r.bottom + grow, left: r.left - grow }, box };
			}, id);
			await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
			for (const id of ['item-one', 'menu-one-59']) {
				await page.evaluate(() => document.getElementById('menu-one').scrollTop = 0);
				const r = await ring(id);
				expect(r.visible, id).toBe(true);
				expect(r.width).toBeGreaterThan(0);
				expect(inside(r.ring, r.box), id).toBe(true);
			}
		});

		test('a hover panel that scrolls stays open while the pointer scrolls it', async ({ page }) => {
			await short(page);
			await fill(page, 'menu-three', 60);
			await page.hover('#trigger-three');
			await becomes(page, 'menu-three', true);
			await settle(page, '#menu-three');
			await page.hover('#item-three');
			await page.mouse.wheel(0, 400);
			await expect.poll(() => page.evaluate(() => document.getElementById('menu-three').scrollTop)).toBeGreaterThan(0);
			await page.waitForTimeout(600);
			expect(await isOpen(page, 'menu-three')).toBe(true);
		});
	});

	test('has no accessibility violations, shut and open', async ({ page }) => {
		await open(page);
		expect(await axe(page)).toEqual([]);
		await page.click('#trigger-one');
		await settle(page, '#menu-one');
		expect(await axe(page)).toEqual([]);
		await page.keyboard.press('Escape');
		await page.click('#g-tree-toggle');
		await settle(page, '#g-tree-menu');
		expect(await axe(page)).toEqual([]);
	});
	test.describe('the current page', () => {
		const mark = (page) => page.evaluate(() => document.querySelector('#leaf').setAttribute('aria-current', 'page'));

		test('each parent above the current page takes its color at a lighter weight', async ({ page }) => {
			await open(page);
			await mark(page);
			const leaf = await style(page, '#leaf', 'color');
			expect(await style(page, '#sub-link', 'color')).toBe(leaf);
			expect(await style(page, '#sub-toggle', 'color')).toBe(leaf);
			expect(await style(page, '#tree-link', 'color')).toBe(leaf);
			expect(Number(await style(page, '#sub-link', 'font-weight'))).toBeLessThan(Number(await style(page, '#leaf', 'font-weight')));
			expect(Number(await style(page, '#tree-link', 'font-weight'))).toBeLessThan(Number(await style(page, '#leaf', 'font-weight')));
		});

		test('a dropdown beside the current page is not marked', async ({ page }) => {
			await open(page);
			await mark(page);
			const leaf = await style(page, '#leaf', 'color');
			expect(await style(page, '#lab-trigger', 'color')).not.toBe(leaf);
			expect(await style(page, '#tree-plain', 'color')).not.toBe(leaf);
		});

		test('with no current page, nothing is marked', async ({ page }) => {
			await open(page);
			expect(await style(page, '#sub-link', 'color')).toBe(await style(page, '#tree-plain', 'color'));
		});

		test('a button trigger keeps its own text color over a panel that holds the current page', async ({ page }) => {
			await open(page);
			// A solid button, the default, whose text is the color on its own fill.
			await page.evaluate(() => document.querySelector('#trigger-one').removeAttribute('data-emphasis'));
			await settle(page, '#trigger-one');
			const before = await style(page, '#trigger-one', 'color');
			await page.evaluate(() => document.querySelector('#item-one').setAttribute('aria-current', 'page'));
			// A button transitions its color, so read it once that has finished.
			await settle(page, '#trigger-one');
			expect(await style(page, '#trigger-one', 'color')).toBe(before);
		});

		test('--yeti-dropdown-current colors the current page and each parent that holds it', async ({ page }) => {
			await open(page);
			await mark(page);
			await page.addStyleTag({ content: '#tree { --yeti-dropdown-current: rgb(9, 8, 7); }' });
			for (const id of ['#leaf', '#sub-link', '#sub-toggle', '#tree-link']) expect(await style(page, id, 'color'), id).toBe('rgb(9, 8, 7)');
			expect(await style(page, '#tree-plain', 'color')).not.toBe('rgb(9, 8, 7)');
		});

		test('any aria-current value marks the link itself', async ({ page }) => {
			await open(page);
			await page.evaluate(() => document.querySelector('#leaf').setAttribute('aria-current', 'true'));
			expect(await style(page, '#leaf', 'color')).not.toBe(await style(page, '#tree-plain', 'color'));
			expect(Number(await style(page, '#leaf', 'font-weight'))).toBeGreaterThan(Number(await style(page, '#tree-plain', 'font-weight')));
		});
	});
});
