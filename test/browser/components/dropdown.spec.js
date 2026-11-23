import { test, expect } from 'playwright/test';
import { stage, rect, style, axe, withoutModule } from '../lib/layout.js';

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
	});
});
