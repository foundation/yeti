import { test, expect } from 'playwright/test';
import { stage, rect, style, axe, painted } from '../lib/layout.js';

const open = async (page, width = 1000) => {
	const response = await page.goto('/test/browser/fixtures/components/nav.html');
	expect(response.status()).toBe(200);
	await stage(page, width);
	await painted(page);
};
const isOpen = (page, id) => page.evaluate((i) => document.getElementById(i).matches(':popover-open'), id);
// The panel enters with a transition, so geometry is read once it has settled.
// Two frames: input is processed, then rAF callbacks run, so after two the
// style recalculation that creates the transition has certainly happened and
// getAnimations() reports it. Waiting on an empty list resolves at once.
const settle = (page, selector) => page.evaluate((s) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	.then(() => Promise.all(document.querySelector(s).getAnimations().map((a) => a.finished.catch(() => {})))), selector);
const anchored = (page) => page.evaluate(() => CSS.supports('anchor-name: --a') && CSS.supports('anchor-scope: --a'));

test.describe('nav', () => {
	test('a forced scheme carries the bar and the open panel with it', async ({ page }) => {
		await open(page, 300);
		await page.addStyleTag({ content: '#nav { color-scheme: dark; --yeti-nav-surface: rgb(60, 30, 20); }' });
		const dark = (token, property) => page.evaluate(([t, p]) => {
			const probe = document.createElement('div');
			probe.style.colorScheme = 'dark';
			probe.style[p] = `var(${t})`;
			document.body.append(probe);
			const got = getComputedStyle(probe)[p];
			probe.remove();
			return got;
		}, [token, property]);
		const text = await dark('--yeti-color-text', 'color');
		expect(await style(page, '#nav', 'background-color')).toBe('rgb(60, 30, 20)');
		expect(await style(page, '#nav', 'color')).toBe(text);
		expect(await style(page, '#toggle', 'color')).toBe(text);
		await page.click('#toggle');
		await settle(page, '#menu');
		expect(await style(page, '#menu', 'background-color')).toBe(await dark('--yeti-color-surface-raised', 'backgroundColor'));
		expect(await style(page, '#plain', 'color')).toBe(text);
		expect(await style(page, '#current', 'color')).toBe(await dark('--yeti-color-primary-text', 'color'));
		await page.hover('#plain');
		await expect.poll(() => style(page, '#plain', 'background-color')).toBe(await dark('--yeti-color-primary-subtle', 'backgroundColor'));
	});

	test('a long brand wraps in a narrow bar instead of overflowing it', async ({ page }) => {
		await open(page, 320);
		await page.evaluate(() => { document.querySelector('#brand').textContent = 'Maas Glass Hall of Northern Crafts'; });
		const overflow = await page.evaluate(() => { const n = document.querySelector('#nav'); return n.scrollWidth - n.clientWidth; });
		expect(overflow).toBeLessThanOrEqual(0);
		const lines = await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#brand')); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; });
		expect(lines).toBeGreaterThan(1);
	});

	test('a logo sits beside the name at the bar\'s control height, and the bar stays that tall', async ({ page }) => {
		await open(page, 1000);
		const before = await rect(page, '#nav');
		await page.evaluate(() => {
			document.querySelector('#brand').innerHTML = '<svg id="logo" aria-hidden="true" viewBox="0 0 20 10"><rect width="20" height="10"/></svg>Yeti';
		});
		const control = await page.evaluate(() => {
			const probe = document.createElement('div');
			probe.style.blockSize = 'var(--yeti-control-size)';
			document.body.append(probe);
			const h = probe.getBoundingClientRect().height;
			probe.remove();
			return h;
		});
		const logo = await rect(page, '#logo');
		const after = await rect(page, '#nav');
		expect(logo.height).toBeCloseTo(control, 1);
		expect(logo.width).toBeCloseTo(control * 2, 1); // its own aspect ratio
		expect(after.height).toBeCloseTo(before.height, 1);
		const words = await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#brand').lastChild); const b = r.getBoundingClientRect(); return { left: b.left, top: b.top, bottom: b.bottom }; });
		expect(words.left).toBeGreaterThan(logo.right); // a gap, not touching
		expect((words.top + words.bottom) / 2).toBeCloseTo((logo.top + logo.bottom) / 2, 0);
	});

	test('a logo keeps its size and a long name wraps beside it in a narrow bar', async ({ page }) => {
		await open(page, 320);
		await page.evaluate(() => {
			document.querySelector('#brand').innerHTML = '<svg id="logo" aria-hidden="true" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>Maas Glass Hall of Northern Crafts';
		});
		const logo = await rect(page, '#logo');
		expect(logo.width).toBeCloseTo(logo.height, 1);
		const overflow = await page.evaluate(() => { const n = document.querySelector('#nav'); return n.scrollWidth - n.clientWidth; });
		expect(overflow).toBeLessThanOrEqual(0);
	});

	test('an img logo follows the same size, and the token moves it', async ({ page }) => {
		await open(page, 1000);
		await page.evaluate(() => {
			const nav = document.querySelector('#nav');
			nav.style.setProperty('--yeti-nav-logo-size', '20px');
			document.querySelector('#brand').innerHTML = '<img id="logo" alt="" width="40" height="40" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">';
		});
		const logo = await rect(page, '#logo');
		expect(logo.height).toBeCloseTo(20, 1);
		expect(logo.width).toBeCloseTo(20, 1);
	});

	test('at or above the threshold the links sit in the bar and the toggle is gone', async ({ page }) => {
		await open(page, 1000);
		expect(await style(page, '#toggle', 'display')).toBe('none');
		expect(await style(page, '#menu', 'position')).toBe('static');
		expect(await page.getAttribute('#menu', 'popover')).not.toBeNull();
		const [brand, current, plain, actions] = await Promise.all([rect(page, '#brand'), rect(page, '#current'), rect(page, '#plain'), rect(page, '#actions')]);
		const mid = (r) => (r.top + r.bottom) / 2;
		for (const r of [current, plain, actions]) expect(Math.abs(mid(r) - mid(brand))).toBeLessThan(2);
		expect(current.left).toBeGreaterThan(brand.right);
		expect(actions.left).toBeGreaterThan(plain.right);
	});

	test('below the threshold the toggle opens the list as a sheet under the bar; Escape and an outside click close it', async ({ page }) => {
		await open(page, 400);
		expect(await style(page, '#toggle', 'display')).not.toBe('none');
		expect(await style(page, '#menu', 'display')).toBe('none');
		await page.click('#toggle');
		expect(await isOpen(page, 'menu')).toBe(true);
		await settle(page, '#menu');
		const [bar, menu] = await Promise.all([rect(page, '#nav'), rect(page, '#menu')]);
		const viewport = page.viewportSize();
		expect(menu.width).toBeCloseTo(viewport.width, 0);
		if (await anchored(page)) expect(menu.top).toBeCloseTo(bar.bottom, 0);
		else expect(menu.top).toBe(0);
		await page.keyboard.press('Escape');
		expect(await isOpen(page, 'menu')).toBe(false);
		await page.click('#toggle');
		await page.mouse.click(viewport.width / 2, viewport.height - 5);
		expect(await isOpen(page, 'menu')).toBe(false);
	});

	test('a sheet never runs past the bottom of the viewport', async ({ page }) => {
		await page.setViewportSize({ width: 400, height: 220 });
		await open(page, 400);
		await page.click('#toggle');
		await settle(page, '#menu');
		const menu = await rect(page, '#menu');
		expect(menu.bottom).toBeLessThanOrEqual(220 + 1);
		const scrolls = await page.evaluate(() => { const el = document.getElementById('menu'); return el.scrollHeight > el.clientHeight; });
		expect(scrolls || menu.bottom <= 220).toBe(true);
	});

	test('a short sheet hugs its content instead of filling the rest of a tall viewport', async ({ page }) => {
		await open(page, 400);
		await page.click('#toggle');
		await settle(page, '#menu');
		const menu = await rect(page, '#menu');
		const viewport = page.viewportSize();
		expect(menu.height).toBeLessThan(400);
		expect(menu.bottom).toBeLessThan(viewport.height);
	});

	test('Tab from the toggle reaches the first link', async ({ page, browserName }) => {
		await open(page, 400);
		await page.focus('#toggle');
		await page.keyboard.press('Enter');
		expect(await isOpen(page, 'menu')).toBe(true);
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
		expect(await page.evaluate(() => document.activeElement.id)).toBe('current');
	});

	test('the current link takes the variant text colour and strong weight', async ({ page }) => {
		await open(page, 1000);
		expect(await style(page, '#current', 'color')).not.toBe(await style(page, '#plain', 'color'));
		expect(parseInt(await style(page, '#current', 'font-weight'), 10)).toBeGreaterThan(parseInt(await style(page, '#plain', 'font-weight'), 10));
	});

	test('narrowing collapses the bar and widening restores it', async ({ page }) => {
		await open(page, 400);
		await page.click('#toggle');
		await page.keyboard.press('Escape');
		await stage(page, 1000);
		expect(await style(page, '#toggle', 'display')).toBe('none');
		expect(await style(page, '#menu', 'position')).toBe('static');
		await stage(page, 400);
		expect(await style(page, '#toggle', 'display')).not.toBe('none');
		expect(await style(page, '#menu', 'display')).toBe('none');
	});

	test('a panel that is open stays a panel when the nav widens', async ({ page }) => {
		await open(page, 400);
		await page.click('#toggle');
		await settle(page, '#menu');
		await stage(page, 1000);
		expect(await isOpen(page, 'menu')).toBe(true);
		expect(await style(page, '#menu', 'position')).toBe('fixed');
		expect(await style(page, '#menu', 'background-color')).not.toBe('rgba(0, 0, 0, 0)');
		expect(await style(page, '#toggle', 'display')).not.toBe('none');
		await page.keyboard.press('Escape');
		expect(await style(page, '#menu', 'position')).toBe('static');
		expect(await style(page, '#toggle', 'display')).toBe('none');
	});

	test('a nav with in-page links turns on smooth scrolling, and reduced motion turns it off', async ({ page }) => {
		await open(page);
		expect(await style(page, 'html', 'scroll-behavior')).toBe('smooth');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await open(page);
		expect(await style(page, 'html', 'scroll-behavior')).toBe('auto');
		// Placeholders alone do not count.
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await open(page);
		await page.evaluate(() => document.querySelector('a[href="#about"]').setAttribute('href', '#'));
		expect(await style(page, 'html', 'scroll-behavior')).toBe('auto');
		// Falsification: a page with neither a toc nor in-page nav links scrolls as the browser does.
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		expect((await page.goto('/test/browser/fixtures/layouts/stack.html')).status()).toBe(200);
		expect(await style(page, 'html', 'scroll-behavior')).toBe('auto');
	});

	test('the brand and the links read their tokens', async ({ page }) => {
		await open(page);
		expect(await style(page, '#brand', 'font-weight')).toBe('600');
		const navSize = await style(page, '.nav', 'font-size');
		expect(await style(page, '#brand', 'font-size')).toBe(navSize);
		expect(await style(page, '#plain', 'color')).toBe(await style(page, '.nav', 'color'));
		// A nav colored by page CSS passes that color on to its plain links.
		await page.addStyleTag({ content: '#nav { color: rgb(200, 0, 0); }' });
		expect(await style(page, '#plain', 'color')).toBe('rgb(200, 0, 0)');
		await page.addStyleTag({ content: ':root { --yeti-nav-brand-weight: 400; --yeti-nav-brand-size: 24px; --yeti-nav-link: rgb(1, 2, 3); }' });
		expect(await style(page, '#brand', 'font-weight')).toBe('400');
		expect(await style(page, '#brand', 'font-size')).toBe('24px');
		expect(await style(page, '#plain', 'color')).toBe('rgb(1, 2, 3)');
		// The current link keeps its variant tint; the token colors plain links only.
		expect(await style(page, '#current', 'color')).not.toBe('rgb(1, 2, 3)');
	});

	test('a link reads the small lettering width axis, and the brand does not', async ({ page }) => {
		await open(page);
		expect(await style(page, '#plain', 'font-stretch')).toBe('100%');
		await page.addStyleTag({ content: ':root { --yeti-stretch-small: 75%; }' });
		expect(await style(page, '#plain', 'font-stretch')).toBe('75%');
		expect(await style(page, '#brand', 'font-stretch')).toBe('100%');
	});

	test('on a painted bar a dropdown trigger takes the same color as the links and the bar', async ({ page }) => {
		await open(page, 1000);
		const [trigger, link, nav] = await Promise.all([style(page, '#painted-trigger', 'color'), style(page, '#painted-link', 'color'), style(page, '#painted', 'color')]);
		expect(trigger).toBe(link);
		expect(trigger).toBe(nav);
	});

	test('a link color set for the bar does not follow the links into the open panel', async ({ page }) => {
		await open(page, 400);
		await page.addStyleTag({ content: ':root { --yeti-nav-link: rgb(255, 255, 255); }' });
		await page.click('#toggle');
		await settle(page, '#menu');
		const [link, panel] = await Promise.all([style(page, '#plain', 'color'), style(page, '#menu', 'color')]);
		expect(link).toBe(panel);
		expect(link).not.toBe('rgb(255, 255, 255)');
	});

	test('has no accessibility violations, closed and open', async ({ page }) => {
		await open(page, 400);
		expect(await axe(page)).toEqual([]);
		await page.click('#toggle');
		await settle(page, '#menu');
		expect(await axe(page)).toEqual([]);
		await stage(page, 1000);
		expect(await axe(page)).toEqual([]);
	});

	test('a drawer is a column from the start edge with a backdrop, and a backdrop click closes it', async ({ page }) => {
		await open(page, 400);
		await page.click('#drawer-toggle');
		expect(await isOpen(page, 'drawer-menu')).toBe(true);
		await settle(page, '#drawer-menu');
		const menu = await rect(page, '#drawer-menu');
		const viewport = page.viewportSize();
		expect(menu.left).toBe(0);
		expect(menu.width).toBeCloseTo(320, 0);
		expect(menu.height).toBeCloseTo(viewport.height, 0);
		expect(await page.evaluate(() => getComputedStyle(document.getElementById('drawer-menu'), '::backdrop').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
		await page.mouse.click(viewport.width - 10, viewport.height / 2);
		expect(await isOpen(page, 'drawer-menu')).toBe(false);
	});

	test('a screen covers the viewport and its close item hides it', async ({ page }) => {
		await open(page, 400);
		await page.click('#screen-toggle');
		await settle(page, '#screen-menu');
		const menu = await rect(page, '#screen-menu');
		const viewport = page.viewportSize();
		expect(menu.width).toBeCloseTo(viewport.width, 0);
		expect(menu.height).toBeCloseTo(viewport.height, 0);
		const close = await rect(page, '#screen-close');
		expect(close.right).toBeGreaterThan(viewport.width - 60);
		expect(close.top).toBeLessThan(60);
		await page.click('#screen-close button');
		expect(await isOpen(page, 'screen-menu')).toBe(false);
	});

	test('the close item is hidden while the links are in the bar', async ({ page }) => {
		await open(page, 1000);
		expect(await style(page, '#drawer-close', 'display')).toBe('none');
		expect(await style(page, '#screen-close', 'display')).toBe('none');
	});

	test('a dropdown trigger in the list is styled like a link', async ({ page }) => {
		await open(page, 1000);
		const [link, trigger] = await Promise.all([rect(page, '#current'), rect(page, '#nav-more-trigger')]);
		expect(trigger.height).toBeCloseTo(link.height, 0);
	});

	test('a dropdown in the open panel is a full-width block docked under its trigger', async ({ page }) => {
		await open(page, 400);
		await page.click('#toggle');
		await settle(page, '#menu');
		// The wrapper is inline-block in the bar, so without a reset the trigger
		// shrink-wraps and sits narrower than the links it stands among.
		const [link, trigger] = await Promise.all([rect(page, '#plain'), rect(page, '#nav-more-trigger')]);
		expect(trigger.width).toBeCloseTo(link.width, 0);
		await page.click('#nav-more-trigger');
		await settle(page, '#nav-more');
		expect(await isOpen(page, 'menu')).toBe(true);
		const viewport = page.viewportSize();
		const [panel, sub] = await Promise.all([rect(page, '#menu'), rect(page, '#nav-more')]);
		if (await anchored(page)) {
			expect(sub.top).toBeCloseTo(trigger.bottom, 0);
			expect(sub.left).toBeCloseTo(panel.left, 0);
			expect(sub.right).toBeCloseTo(panel.right, 0);
		} else {
			expect(sub.bottom).toBeCloseTo(viewport.height, 0);
			expect(sub.width).toBeCloseTo(viewport.width, 0);
		}
		expect(sub.bottom).toBeLessThanOrEqual(viewport.height + 1);
	});

	test('a submenu taller than the room below its trigger scrolls instead of running off', async ({ page }) => {
		await open(page, 400);
		await page.evaluate(() => {
			const panel = document.getElementById('nav-more');
			for (let i = 0; i < 30; i += 1) {
				const link = document.createElement('a');
				link.href = '#';
				link.textContent = `Item ${i}`;
				panel.append(link);
			}
		});
		await page.click('#toggle');
		await page.click('#nav-more-trigger');
		await settle(page, '#nav-more');
		const sub = await rect(page, '#nav-more');
		expect(sub.bottom).toBeLessThanOrEqual(page.viewportSize().height + 1);
		expect(await page.evaluate(() => { const el = document.getElementById('nav-more'); return el.scrollHeight > el.clientHeight + 1; })).toBe(true);
	});

	test('a submenu inside a drawer stops at the drawer\u2019s edge', async ({ page }) => {
		await open(page, 400);
		await page.click('#drawer-toggle');
		await settle(page, '#drawer-menu');
		await page.click('#drawer-more-trigger');
		await settle(page, '#drawer-more');
		const [panel, sub] = await Promise.all([rect(page, '#drawer-menu'), rect(page, '#drawer-more')]);
		expect(panel.right).toBeLessThan(page.viewportSize().width);
		if (await anchored(page)) {
			expect(sub.left).toBeCloseTo(panel.left, 0);
			expect(sub.right).toBeCloseTo(panel.right, 0);
		} else {
			expect(sub.bottom).toBeCloseTo(page.viewportSize().height, 0);
		}
	});

	test('Escape closes the submenu before the panel', async ({ page }) => {
		await open(page, 400);
		await page.click('#toggle');
		await page.click('#nav-more-trigger');
		await settle(page, '#nav-more');
		expect(await isOpen(page, 'nav-more')).toBe(true);
		await page.keyboard.press('Escape');
		expect(await isOpen(page, 'nav-more')).toBe(false);
		expect(await isOpen(page, 'menu')).toBe(true);
		await page.keyboard.press('Escape');
		expect(await isOpen(page, 'menu')).toBe(false);
	});

	test('a dropdown in the bar keeps its own card', async ({ page }) => {
		await open(page, 1000);
		await page.click('#nav-more-trigger');
		await settle(page, '#nav-more');
		const [bar, sub] = await Promise.all([rect(page, '#nav'), rect(page, '#nav-more')]);
		expect(sub.width).toBeLessThan(bar.width / 2);
		expect(sub.left).toBeGreaterThan(bar.left);
	});

	test('a dropdown inside a nav item opens and is not clipped by the bar', async ({ page }) => {
		await open(page, 1000);
		await page.click('#nav-more-trigger');
		await settle(page, '#nav-more');
		expect(await page.evaluate(() => document.getElementById('nav-more').matches(':popover-open'))).toBe(true);
		const panel = await rect(page, '#nav-more');
		expect(panel.height).toBeGreaterThan(0);
		const painted = await page.evaluate(() => {
			const panel = document.getElementById('nav-more');
			const box = panel.getBoundingClientRect();
			const hit = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(10, box.height / 2));
			return panel === hit || panel.contains(hit);
		});
		expect(painted).toBe(true);
	});
});
