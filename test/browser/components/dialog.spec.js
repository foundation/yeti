import { test, expect } from 'playwright/test';
import { stage, rect, style, axe, withoutModule, token } from '../lib/layout.js';

const open = async (page, width = 1000) => {
	const response = await page.goto('/test/browser/fixtures/components/dialog.html');
	expect(response.status()).toBe(200);
	await stage(page, width);
};
const isOpen = (page) => page.evaluate(() => document.getElementById('confirm').open);
const isModal = (page) => page.evaluate(() => document.getElementById('confirm').matches(':modal'));
// The dialog arrives with a fade and a rise, so wait for that to finish
// before reading colour: a scan mid-transition sees a translucent box.
const settle = (page, selector) => page.evaluate((s) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	.then(() => Promise.all(document.querySelector(s).getAnimations().map((a) => a.finished.catch(() => {})))), selector);

test.describe('dialog', () => {
	test('commandfor opens it modally and Escape closes it', async ({ page }) => {
		await open(page);
		expect(await isOpen(page)).toBe(false);
		await page.click('#opener');
		expect(await isOpen(page)).toBe(true);
		expect(await isModal(page)).toBe(true);
		await page.keyboard.press('Escape');
		expect(await isOpen(page)).toBe(false);
	});

	test('a click on the backdrop closes it, and one inside does not', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await page.click('#confirm-title');
		expect(await isOpen(page)).toBe(true);
		await page.mouse.click(5, 5);
		expect(await isOpen(page)).toBe(false);
	});

	test('a drag that starts inside and ends on the backdrop does not close it', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await settle(page, '#confirm');
		// A click whose press and release land on different elements is delivered
		// to their common ancestor with the release's coordinates, so selecting
		// text and overshooting the edge looked exactly like a backdrop click and
		// threw the dialog and its form away. Both ends have to be outside.
		const title = await rect(page, '#confirm-title');
		await page.mouse.move(title.left + 10, title.top + 10);
		await page.mouse.down();
		await page.mouse.move(5, 5, { steps: 5 });
		await page.mouse.up();
		expect(await isOpen(page)).toBe(true);
		// And a press that genuinely begins on the backdrop still closes it.
		await page.mouse.click(5, 5);
		expect(await isOpen(page)).toBe(false);
	});

	test('a form button closes it and focus returns to the opener', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await page.click('#cancel');
		expect(await isOpen(page)).toBe(false);
		expect(await page.evaluate(() => document.activeElement.id)).toBe('opener');
	});

	test('the backdrop is painted', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await settle(page, '#confirm');
		const backdrop = await page.evaluate(() => getComputedStyle(document.getElementById('confirm'), '::backdrop').backgroundColor);
		expect(backdrop).not.toBe('rgba(0, 0, 0, 0)');
	});

	test('the contents are spaced and the footer buttons share a line', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await settle(page, '#confirm');
		const [title, body, cancel, go] = await Promise.all([rect(page, '#confirm-title'), rect(page, '#confirm p'), rect(page, '#cancel'), rect(page, '#confirm-go')]);
		expect(body.top).toBeGreaterThan(title.bottom);
		expect(Math.abs(cancel.top - go.top)).toBeLessThan(2);
	});

	test('the page behind a modal is inert', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await settle(page, '#confirm');
		await page.evaluate(() => document.getElementById('after').focus());
		expect(await page.evaluate(() => document.activeElement.id)).not.toBe('after');
	});

	test('without the module it still opens; only the backdrop click is lost', async ({ page }) => {
		await withoutModule(page, 'dialog');
		await open(page);
		await page.click('#opener');
		expect(await isOpen(page)).toBe(true);
		expect(await isModal(page)).toBe(true);
		await page.mouse.click(5, 5);
		expect(await isOpen(page)).toBe(true);
		await page.keyboard.press('Escape');
		expect(await isOpen(page)).toBe(false);
	});

	test('has no accessibility violations, shut and open', async ({ page }) => {
		await open(page);
		expect(await axe(page)).toEqual([]);
		await page.click('#opener');
		await settle(page, '#confirm');
		expect(await axe(page)).toEqual([]);
	});

	// Only discriminates in WebKit: Chromium and Firefox restore dialog focus
	// natively, which masks the bug this guards against.
	test('a dialog opened from inside another returns focus to its own trigger', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await settle(page, '#confirm');
		await page.click('#nested-open');
		await settle(page, '#nested');
		expect(await page.evaluate(() => document.getElementById('nested').open)).toBe(true);
		await page.click('#nested-cancel');
		expect(await page.evaluate(() => document.activeElement.id)).toBe('nested-open');
		expect(await isOpen(page)).toBe(true);
		await page.keyboard.press('Escape');
		expect(await page.evaluate(() => document.activeElement.id)).toBe('opener');
	});

	// The listeners are installed from script, but the input that triggers them
	// is a real click and a real Escape. A scripted .click() keeps the evaluate
	// frame on the stack, which holds the microtask checkpoint back until after
	// the browser's show-modal default action has run; a trusted click drains
	// microtasks first, so only a real one shows whether the module waited long
	// enough to see the dialog open.
	test('opening and closing dispatch yeti:open and yeti:close on the dialog', async ({ page }) => {
		await open(page);
		await page.evaluate(() => {
			window.caught = { open: 0, close: 0, opened: null, closed: null };
			document.addEventListener('yeti:open', (event) => {
				window.caught.open += 1;
				window.caught.opened = { target: event.target.id, wasOpen: event.target.open, bubbles: event.bubbles, composed: event.composed };
			});
			document.addEventListener('yeti:close', (event) => {
				window.caught.close += 1;
				window.caught.closed = { target: event.target.id, wasOpen: event.target.open, bubbles: event.bubbles, composed: event.composed };
			});
		});
		await page.click('#opener');
		await settle(page, '#confirm');
		// Polled rather than read once: both announcements arrive a task after
		// the input, and the close event a dialog fires is itself queued.
		await expect.poll(() => page.evaluate(() => window.caught.open)).toBe(1);
		expect(await page.evaluate(() => window.caught.opened)).toEqual({ target: 'confirm', wasOpen: true, bubbles: true, composed: true });
		await page.keyboard.press('Escape');
		await expect.poll(() => page.evaluate(() => window.caught.close)).toBe(1);
		expect(await page.evaluate(() => window.caught.closed)).toEqual({ target: 'confirm', wasOpen: false, bubbles: true, composed: true });
	});

	test('data-max caps the width from the width scale', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await settle(page, '#confirm');
		await page.click('#nested-open');
		await settle(page, '#nested');
		const [outer, nested] = await Promise.all([rect(page, '#confirm'), rect(page, '#nested')]);
		expect(nested.width).toBeLessThan(outer.width);
		expect(nested.width).toBeCloseTo(await token(page, '--yeti-width-sm'), 0);
	});

	test('a plain dialog is still centered, with its own corner, beside the drawer rules', async ({ page }) => {
		await open(page);
		await page.click('#opener');
		await settle(page, '#confirm');
		const box = await rect(page, '#confirm');
		const view = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }));
		expect(box.left).toBeGreaterThan(0);
		expect(box.left).toBeCloseTo(view.width - box.right, 0);
		expect(box.top).toBeCloseTo(view.height - box.bottom, 0);
		expect(box.width).toBeLessThanOrEqual(await token(page, '--yeti-width-md') + 0.5);
		expect(parseFloat(await style(page, '#confirm', 'border-top-left-radius'))).toBeCloseTo(await token(page, '--yeti-dialog-radius'), 0);
		expect(await style(page, '#confirm', 'display')).toBe('block');
	});
});

// The drawer's place is the screen's, not the stage's, so these size the
// viewport before the page loads.
const openAt = async (page, width = 1000, dir = 'ltr') => {
	await page.setViewportSize({ width, height: 720 });
	const response = await page.goto('/test/browser/fixtures/components/dialog.html');
	expect(response.status()).toBe(200);
	if (dir === 'rtl') await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
};
const show = async (page, id) => {
	await page.click(`#${id}-open`);
	await settle(page, `#${id}`);
	return rect(page, `#${id}`);
};
const viewport = (page) => page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }));
const openState = (page, id) => page.evaluate((i) => document.getElementById(i).open, id);

test.describe('dialog drawer', () => {
	// Runs in all three engines.
	test('a side drawer is full height at the start edge, or at the end with data-placement="end"', async ({ page }) => {
		await openAt(page, 1000);
		const view = await viewport(page);
		const start = await show(page, 'drawer-start');
		expect(start.left).toBeCloseTo(0, 0);
		expect(start.top).toBeCloseTo(0, 0);
		expect(start.height).toBeCloseTo(view.height, 0);
		expect(start.width).toBeCloseTo(await token(page, '--yeti-width-sm'), 0);
		await page.keyboard.press('Escape');
		await settle(page, '#drawer-start');
		const end = await show(page, 'drawer-end');
		expect(end.right).toBeCloseTo(view.width, 0);
		expect(end.height).toBeCloseTo(view.height, 0);
		expect(end.width).toBeCloseTo(await token(page, '--yeti-width-sm'), 0);
	});

	// Runs in all three engines.
	test('right to left, the start and end drawers swap physical sides', async ({ page }) => {
		await openAt(page, 1000, 'rtl');
		const view = await viewport(page);
		const start = await show(page, 'drawer-start');
		expect(start.right).toBeCloseTo(view.width, 0);
		await page.keyboard.press('Escape');
		await settle(page, '#drawer-start');
		const end = await show(page, 'drawer-end');
		expect(end.left).toBeCloseTo(0, 0);
	});

	// Runs in all three engines.
	test('a top drawer and a bottom drawer span the width at their own edge', async ({ page }) => {
		await openAt(page, 1000);
		const view = await viewport(page);
		const top = await show(page, 'drawer-top');
		expect(top.top).toBeCloseTo(0, 0);
		expect(top.left).toBeCloseTo(0, 0);
		expect(top.width).toBeCloseTo(view.width, 0);
		expect(top.height).toBeLessThan(view.height);
		await page.keyboard.press('Escape');
		await settle(page, '#drawer-top');
		const bottom = await show(page, 'drawer-bottom');
		expect(bottom.bottom).toBeCloseTo(view.height, 0);
		expect(bottom.left).toBeCloseTo(0, 0);
		expect(bottom.width).toBeCloseTo(view.width, 0);
	});

	test('data-max sets a side drawer\'s width, and a narrow screen keeps a strip of backdrop', async ({ page }) => {
		await openAt(page, 1000);
		const narrow = await show(page, 'drawer-xs');
		expect(narrow.width).toBeCloseTo(await token(page, '--yeti-width-xs'), 0);
		await openAt(page, 390);
		const view = await viewport(page);
		const phone = await show(page, 'drawer-start');
		expect(phone.width).toBeLessThan(view.width);
		expect(phone.width).toBeLessThanOrEqual(view.width - await token(page, '--yeti-space-xl') + 0.5);
	});

	test('a long bottom drawer stops short of the top and scrolls as one piece', async ({ page }) => {
		await openAt(page, 1000);
		const view = await viewport(page);
		const box = await show(page, 'drawer-bottom');
		expect(box.height).toBeLessThanOrEqual(view.height - await token(page, '--yeti-space-xl') + 0.5);
		expect(await page.evaluate(() => { const d = document.getElementById('drawer-bottom'); return d.scrollHeight > d.clientHeight; })).toBe(true);
	});

	test('a short side drawer keeps its footer at the bottom, inside its padding', async ({ page }) => {
		await openAt(page, 1000);
		const view = await viewport(page);
		const box = await show(page, 'drawer-start');
		const footer = await rect(page, '#drawer-start-footer');
		const padding = await token(page, '--yeti-dialog-padding');
		expect(box.bottom).toBeCloseTo(view.height, 0);
		expect(footer.bottom).toBeCloseTo(box.bottom - padding, 0);
	});

	test('a drawer is modal; Escape and the backdrop close it, and focus returns to its opener', async ({ page }) => {
		await openAt(page, 1000);
		await show(page, 'drawer-start');
		expect(await page.evaluate(() => document.getElementById('drawer-start').matches(':modal'))).toBe(true);
		await page.keyboard.press('Escape');
		expect(await openState(page, 'drawer-start')).toBe(false);
		expect(await page.evaluate(() => document.activeElement.id)).toBe('drawer-start-open');
		await settle(page, '#drawer-start');
		await show(page, 'drawer-start');
		const view = await viewport(page);
		await page.mouse.click(view.width - 5, 5);
		expect(await openState(page, 'drawer-start')).toBe(false);
		expect(await page.evaluate(() => document.activeElement.id)).toBe('drawer-start-open');
	});

	test('it rests in place without fading, and once closed it is gone', async ({ page }) => {
		await openAt(page, 1000);
		await show(page, 'drawer-start');
		expect(await style(page, '#drawer-start', 'opacity')).toBe('1');
		expect(['none', '0px', '0px 0px']).toContain(await style(page, '#drawer-start', 'translate'));
		await page.keyboard.press('Escape');
		await settle(page, '#drawer-start');
		expect(await style(page, '#drawer-start', 'display')).toBe('none');
	});

	test('has no accessibility violations, open with a close button', async ({ page }) => {
		await openAt(page, 1000);
		await show(page, 'drawer-start');
		expect(await axe(page)).toEqual([]);
	});
});

test.describe('dialog close button', () => {
	// Runs in all three engines.
	test('command="close" closes a centered dialog and a drawer, with no module', async ({ page }) => {
		await withoutModule(page, 'dialog');
		await openAt(page, 1000);
		await show(page, 'closable');
		await page.click('#closable-close');
		expect(await openState(page, 'closable')).toBe(false);
		await settle(page, '#closable');
		await show(page, 'drawer-start');
		await page.click('#drawer-start-close');
		expect(await openState(page, 'drawer-start')).toBe(false);
	});

	for (const dir of ['ltr', 'rtl']) {
		test(`a control-sized square in the top end corner (${dir})`, async ({ page }) => {
			await openAt(page, 1000, dir);
			const box = await show(page, 'closable');
			const button = await rect(page, '#closable-close');
			const size = await token(page, '--yeti-control-size');
			const padding = await token(page, '--yeti-dialog-padding');
			expect(button.width).toBeCloseTo(size, 0);
			expect(button.height).toBeCloseTo(size, 0);
			expect(button.top - box.top).toBeGreaterThanOrEqual(0);
			expect(button.top - box.top).toBeLessThan(padding);
			const gap = dir === 'ltr' ? box.right - button.right : button.left - box.left;
			expect(gap).toBeGreaterThanOrEqual(0);
			expect(gap).toBeLessThan(padding);
		});
	}

	test('a wrapping heading does not run under the close button', async ({ page }) => {
		await openAt(page, 1000);
		await show(page, 'closable');
		const button = await rect(page, '#closable-close');
		const lines = await page.evaluate(() => {
			const range = document.createRange();
			range.selectNodeContents(document.getElementById('closable-title'));
			return [...range.getClientRects()].map((r) => ({ top: r.top, right: r.right, bottom: r.bottom, left: r.left }));
		});
		expect(new Set(lines.map((l) => Math.round(l.top))).size).toBeGreaterThan(1);
		// A heading balances its lines, so its words rarely reach the end of
		// the line; the box they are laid out in is what has to keep clear.
		const content = await page.evaluate(() => {
			const heading = document.getElementById('closable-title');
			const r = heading.getBoundingClientRect();
			const cs = getComputedStyle(heading);
			return { top: r.top + parseFloat(cs.paddingTop), right: r.right - parseFloat(cs.paddingRight), bottom: r.bottom - parseFloat(cs.paddingBottom), left: r.left + parseFloat(cs.paddingLeft) };
		});
		for (const box of [...lines, content]) {
			const overlaps = box.left < button.right && box.right > button.left && box.top < button.bottom && box.bottom > button.top;
			expect(overlaps).toBe(false);
		}
	});
});
