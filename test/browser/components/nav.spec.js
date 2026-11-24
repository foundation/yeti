import { test, expect } from 'playwright/test';
import { stage, rect, style, axe, painted, withoutModule, token } from '../lib/layout.js';

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
// WebKit does not tab to links with plain Tab; Alt+Tab is its link-reaching key.
const tab = (page, browserName) => page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
const anchored = (page) => page.evaluate(() => CSS.supports('anchor-name: --a') && CSS.supports('anchor-scope: --a'));
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
// The variant's own color for a private variant property, resolved inside an element.
const variant = (page, inside, name) => page.evaluate(([s, n]) => {
	const probe = document.createElement('span');
	probe.style.color = `var(${n})`;
	document.querySelector(s).append(probe);
	const value = getComputedStyle(probe).color;
	probe.remove();
	return value;
}, [inside, name]);

test.describe('nav', () => {
	test('a label trigger in the bar draws a chevron with a space before it', async ({ page }) => {
		await open(page);
		const after = await page.evaluate(() => {
			const cs = getComputedStyle(document.querySelector('#nav-li-trigger'), '::after');
			return { content: cs.content, margin: parseFloat(cs.marginInlineStart) };
		});
		expect(after.content).not.toBe('none');
		expect(Math.abs(after.margin - await token(page, '--yeti-space-xs'))).toBeLessThan(1);
		expect((await rect(page, '#nav-li-trigger')).height).toBe((await rect(page, '#plain')).height);
	});

	test('in the bar, a dropdown panel takes the dropdown tokens, not the nav link color', async ({ page }) => {
		await open(page, 1000);
		await page.addStyleTag({ content: '#nav { --yeti-nav-link: rgb(250, 250, 250); --yeti-dropdown-text: rgb(1, 2, 3); --yeti-dropdown-hover: rgb(4, 5, 6); }' });
		await page.click('#nav-more-trigger');
		await settle(page, '#nav-more');
		const item = page.locator('#nav-more a').first();
		expect(await item.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(1, 2, 3)');
		await item.hover();
		expect(await item.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(4, 5, 6)');
		expect(await style(page, '#nav-more-trigger', 'color')).toBe('rgb(250, 250, 250)');
	});

	test('the bar reads --yeti-nav-hover and --yeti-nav-current', async ({ page }) => {
		await open(page, 1000);
		await page.addStyleTag({ content: '#nav { --yeti-nav-hover: rgb(7, 8, 9); --yeti-nav-current: rgb(10, 11, 12); }' });
		expect(await style(page, '#current', 'color')).toBe('rgb(10, 11, 12)');
		await page.hover('#plain');
		expect(await style(page, '#plain', 'background-color')).toBe('rgb(7, 8, 9)');
	});

	test('--yeti-nav-current-surface fills the current page in the bar, and the parent that holds it', async ({ page }) => {
		await open(page, 1000);
		// Off by default, so the pointer still shows on the current link.
		expect(await style(page, '#current', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		await page.addStyleTag({ content: '#nav, #nt { --yeti-nav-current-surface: rgb(13, 14, 15); --yeti-nav-hover: rgb(7, 8, 9); }' });
		expect(await style(page, '#current', 'background-color')).toBe('rgb(13, 14, 15)');
		expect(await style(page, '#plain', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		expect(await style(page, '#nt-about-link', 'background-color')).toBe('rgb(13, 14, 15)');
		expect(await style(page, '#nt-about-toggle', 'background-color')).toBe('rgb(13, 14, 15)');
		expect(await style(page, '#nt-home', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		expect(await style(page, '#nt-lab-trigger', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		await page.hover('#current');
		expect(await style(page, '#current', 'background-color')).toBe('rgb(7, 8, 9)');
	});

	test('the open panel does not take the bar\'s current fill', async ({ page }) => {
		await open(page, 400);
		await page.addStyleTag({ content: '#nav { --yeti-nav-current-surface: rgb(13, 14, 15); }' });
		await page.click('#toggle');
		await settle(page, '#menu');
		expect(await style(page, '#current', 'background-color')).toBe('rgba(0, 0, 0, 0)');
	});

	test('the open panel keeps the variant\'s tints, not the bar\'s hover and current tokens', async ({ page }) => {
		await open(page, 1000);
		await page.addStyleTag({ content: '#nav { --yeti-nav-hover: rgb(7, 8, 9); --yeti-nav-current: rgb(10, 11, 12); }' });
		expect(await style(page, '#current', 'color')).toBe('rgb(10, 11, 12)');
		await page.hover('#plain');
		expect(await style(page, '#plain', 'background-color')).toBe('rgb(7, 8, 9)');
		await page.mouse.move(5, 5);
		await stage(page, 400);
		await page.click('#toggle');
		await settle(page, '#menu');
		expect(await style(page, '#current', 'color')).toBe(await variant(page, '#nav', '--_yeti-variant-text'));
		await page.hover('#plain');
		expect(await style(page, '#plain', 'background-color')).toBe(await variant(page, '#nav', '--_yeti-variant-subtle'));
	});

	test('a label trigger inside a dropdown panel in the nav fills its row and keeps its chevron at the row end', async ({ page }) => {
		await open(page, 1000);
		await page.evaluate(() => {
			const row = document.createElement('div');
			row.className = 'dropdown';
			row.id = 'deep-row';
			row.innerHTML = '<button type="button" id="deep-trigger">Deep</button>';
			document.querySelector('#nav-li-menu').append(row);
		});
		await page.click('#nav-li-trigger');
		await settle(page, '#nav-li-menu');
		const [trigger, row] = await Promise.all([rect(page, '#deep-trigger'), rect(page, '#deep-row')]);
		expect(Math.abs(trigger.right - row.right)).toBeLessThanOrEqual(2);
		expect(Math.abs(trigger.width - row.width)).toBeLessThanOrEqual(2);
		expect(await chevronRoom(page, '#deep-trigger')).toBeLessThan(2);
	});

	test('in the bar, a dropdown whose class is on the li is styled like a link', async ({ page }) => {
		await open(page, 1000);
		await page.addStyleTag({ content: '#nav { --yeti-nav-link: rgb(250, 250, 250); --yeti-nav-hover: rgb(7, 8, 9); --yeti-dropdown-text: rgb(1, 2, 3); }' });
		expect(await style(page, '#nav-li-trigger', 'color')).toBe('rgb(250, 250, 250)');
		expect((await rect(page, '#nav-li-trigger')).height).toBe((await rect(page, '#plain')).height);
		await page.hover('#nav-li-trigger');
		expect(await style(page, '#nav-li-trigger', 'background-color')).toBe('rgb(7, 8, 9)');
		await page.click('#nav-li-trigger');
		await settle(page, '#nav-li-menu');
		expect(await style(page, '#nav-li-first', 'color')).toBe('rgb(1, 2, 3)');
	});

	test('a painted panel sets its own text, and the links and the close button follow it', async ({ page }) => {
		await open(page, 300);
		await page.addStyleTag({ content: '#nav { --yeti-nav-panel: rgb(30, 40, 50); --yeti-nav-panel-text: rgb(250, 240, 230); --yeti-nav-link: rgb(1, 2, 3); }' });
		await page.evaluate(() => document.querySelector('#menu').insertAdjacentHTML('afterbegin', '<li data-close><button type="button" id="close" popovertarget="menu" popovertargetaction="hide" aria-label="Close">x</button></li>'));
		await page.click('#toggle');
		await settle(page, '#menu');
		expect(await style(page, '#menu', 'color')).toBe('rgb(250, 240, 230)');
		expect(await style(page, '#plain', 'color')).toBe('rgb(250, 240, 230)');
		expect(await style(page, '#close', 'color')).toBe('rgb(250, 240, 230)');
	});

	test('text set on the bar does not reach the open panel', async ({ page }) => {
		await open(page, 300);
		const panelText = await page.evaluate(() => { const p = document.createElement('p'); p.style.color = 'var(--yeti-color-text)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
		await page.addStyleTag({ content: '#nav { --yeti-color-text: rgb(250, 240, 230); }' });
		expect(await style(page, '#nav', 'color')).toBe('rgb(250, 240, 230)');
		await page.click('#toggle');
		await settle(page, '#menu');
		expect(await style(page, '#menu', 'color')).toBe(panelText);
	});

	test('a sticky bar sits flush with the top edge, whatever the token says for everything else', async ({ page }) => {
		await open(page, 1000);
		await page.evaluate(() => document.querySelector('#nav').setAttribute('data-sticky', ''));
		expect(await style(page, '#nav', 'top')).toBe('0px');
		// A bar told otherwise still takes the value, for a site that floats it.
		await page.addStyleTag({ content: '#nav { inset-block-start: 16px; }' });
		expect(await style(page, '#nav', 'top')).toBe('16px');
	});

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
		await withoutModule(page, 'nav');
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
		await withoutModule(page, 'nav');
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
		await withoutModule(page, 'nav');
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
		await withoutModule(page, 'nav');
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
	test('in the bar a split parent is its link and a compact toggle on one row', async ({ page }) => {
		await open(page, 1000);
		const [link, toggle, home] = await Promise.all(['#nt-about-link', '#nt-about-toggle', '#nt-home'].map((s) => rect(page, s)));
		expect(Math.abs(link.top - toggle.top)).toBeLessThan(2);
		expect(toggle.left).toBeGreaterThanOrEqual(link.right - 1);
		expect(toggle.left - link.right).toBeLessThan(2);
		expect(Math.abs(toggle.height - home.height)).toBeLessThan(2);
		expect(toggle.width).toBeLessThan(link.width);
		expect(toggle.width).toBeLessThanOrEqual(home.height + 1);
	});

	test('each ancestor of the current page is marked, more quietly than the page itself', async ({ page }) => {
		await open(page, 1000);
		await page.addStyleTag({ content: '#nt { --yeti-nav-current: rgb(10, 11, 12); }' });
		expect(await style(page, '#nt-about-link', 'color')).toBe('rgb(10, 11, 12)');
		expect(await style(page, '#nt-about-toggle', 'color')).toBe('rgb(10, 11, 12)');
		expect(Number(await style(page, '#nt-about-link', 'font-weight'))).toBeLessThan(600);
		expect(await style(page, '#nt-home', 'color')).not.toBe('rgb(10, 11, 12)');
		expect(await style(page, '#nt-lab-trigger', 'color')).not.toBe('rgb(10, 11, 12)');
	});

	test('inside the panels, the parents of the current page are marked and their siblings are not', async ({ page }) => {
		await open(page, 1000);
		await page.click('#nt-about-toggle');
		await settle(page, '#nt-about-menu');
		await page.click('#nt-team-toggle');
		await settle(page, '#nt-team-menu');
		const leaf = await style(page, '#nt-leaf', 'color');
		expect(await style(page, '#nt-team-link', 'color')).toBe(leaf);
		expect(await style(page, '#nt-team-toggle', 'color')).toBe(leaf);
		expect(Number(await style(page, '#nt-team-link', 'font-weight'))).toBeLessThan(Number(await style(page, '#nt-leaf', 'font-weight')));
		expect(await style(page, '#nt-history', 'color')).not.toBe(leaf);
	});

	test('with no current page, nothing is marked', async ({ page }) => {
		await open(page, 1000);
		await page.evaluate(() => document.querySelector('#nt-leaf').removeAttribute('aria-current'));
		expect(await style(page, '#nt-about-link', 'color')).toBe(await style(page, '#nt-home', 'color'));
	});

	test('a parent whose own link is the current page is styled as the current page, in the bar, in its panel and in place', async ({ page }) => {
		await open(page, 1000);
		const move = (id) => page.evaluate((i) => {
			document.querySelector('#nt [aria-current]').removeAttribute('aria-current');
			document.getElementById(i).setAttribute('aria-current', 'page');
		}, id);
		const weight = async (s) => Number(await style(page, s, 'font-weight'));
		await move('nt-about-link');
		expect(await weight('#nt-about-link')).toBeGreaterThan(await weight('#nt-home'));
		expect(await style(page, '#nt-about-link', 'color')).not.toBe(await style(page, '#nt-home', 'color'));
		await move('nt-team-link');
		await page.click('#nt-about-toggle');
		await settle(page, '#nt-about-menu');
		expect(await weight('#nt-team-link')).toBeGreaterThan(await weight('#nt-history'));
		expect(await style(page, '#nt-team-link', 'color')).not.toBe(await style(page, '#nt-history', 'color'));
		await page.keyboard.press('Escape');
		await stage(page, 400);
		await page.click('#nt-toggle');
		await settle(page, '#nt-menu');
		expect(await weight('#nt-team-link')).toBeGreaterThan(await weight('#nt-history'));
		expect(await style(page, '#nt-team-link', 'color')).not.toBe(await style(page, '#nt-history', 'color'));
	});
	for (const shape of ['sheet', 'drawer', 'screen']) {
		test(`in the open ${shape} every level is shown in place, indented, with no toggle`, async ({ page }) => {
			await withoutModule(page, 'nav');
			await open(page, 400);
			await page.evaluate((v) => document.querySelector('#nt').setAttribute('data-panel', v), shape);
			await page.click('#nt-toggle');
			await settle(page, '#nt-menu');
			const [panel, about, history, leaf, lab] = await Promise.all(['#nt-menu', '#nt-about-link', '#nt-history', '#nt-leaf', '#nt-lab-trigger'].map((s) => rect(page, s)));
			expect(history.top).toBeGreaterThanOrEqual(about.bottom - 1);
			expect(leaf.top).toBeGreaterThanOrEqual(history.bottom - 1);
			expect(lab.top).toBeGreaterThanOrEqual(leaf.bottom - 1);
			if (shape !== 'screen') {
				expect(history.left).toBeGreaterThan(about.left);
				expect(leaf.left).toBeGreaterThan(history.left);
			}
			expect(leaf.right).toBeLessThanOrEqual(panel.right);
			await expect(page.locator('#nt-about-toggle')).toBeHidden();
			await expect(page.locator('#nt-team-toggle')).toBeHidden();
			expect(await isOpen(page, 'nt-about-menu')).toBe(false);
			expect(await isOpen(page, 'nt-team-menu')).toBe(false);
		});
	}

	test('a grouped dropdown in the open panel is the same in-place list as any other', async ({ page }) => {
		await withoutModule(page, 'nav');
		await open(page, 400);
		await page.evaluate(() => document.querySelector('#nt-about').setAttribute('data-grouped', ''));
		await page.click('#nt-toggle');
		await settle(page, '#nt-menu');
		const [about, history, team, leaf] = await Promise.all(['#nt-about-link', '#nt-history', '#nt-team-link', '#nt-leaf'].map((s) => rect(page, s)));
		expect(history.top).toBeGreaterThanOrEqual(about.bottom - 1);
		expect(history.left).toBeGreaterThan(about.left);
		expect(leaf.top).toBeGreaterThanOrEqual(team.bottom - 1);
		expect(leaf.left).toBeGreaterThan(team.left);
		expect(await isOpen(page, 'nt-about-menu')).toBe(false);
	});

	test('a grouped label-only dropdown in the open panel still docks as a full-width block', async ({ page }) => {
		await withoutModule(page, 'nav');
		await open(page, 400);
		await page.evaluate(() => document.querySelector('#nt-lab').setAttribute('data-grouped', ''));
		await page.click('#nt-toggle');
		await settle(page, '#nt-menu');
		await page.click('#nt-lab-trigger');
		await settle(page, '#nt-lab-menu');
		expect(await isOpen(page, 'nt-lab-menu')).toBe(true);
		const [panel, menu] = await Promise.all(['#nt-menu', '#nt-lab-menu'].map((s) => rect(page, s)));
		expect(Math.abs(menu.width - panel.width)).toBeLessThan(2);
		expect(await style(page, '#nt-lab-menu', 'flex-direction')).toBe('column');
	});

	test('a label-only dropdown in the panel still opens as a docked block without the module', async ({ page }) => {
		await withoutModule(page, 'nav');
		await open(page, 400);
		await page.click('#nt-toggle'); await settle(page, '#nt-menu');
		await page.click('#nt-lab-trigger'); await settle(page, '#nt-lab-menu');
		expect(await isOpen(page, 'nt-lab-menu')).toBe(true);
		expect(await isOpen(page, 'nt-menu')).toBe(true);
	});

	test('links shown in place in the panel read the panel text and the variant tints, not the bar or dropdown tokens', async ({ page }) => {
		await withoutModule(page, 'nav');
		await open(page, 400);
		await page.addStyleTag({ content: '#nt { --yeti-nav-panel-text: rgb(1, 2, 3); --yeti-nav-hover: rgb(4, 5, 6); --yeti-nav-current: rgb(7, 8, 9); --yeti-dropdown-text: rgb(200, 0, 0); --yeti-dropdown-hover: rgb(0, 200, 0); --yeti-dropdown-current: rgb(0, 0, 200); }' });
		await page.click('#nt-toggle');
		await settle(page, '#nt-menu');
		const current = await variant(page, '#nt', '--_yeti-variant-text');
		for (const color of ['rgb(7, 8, 9)', 'rgb(200, 0, 0)', 'rgb(0, 0, 200)']) expect(current).not.toBe(color);
		expect(await style(page, '#nt-history', 'color')).toBe('rgb(1, 2, 3)');
		expect(await style(page, '#nt-leaf', 'color')).toBe(current);
		expect(Number(await style(page, '#nt-leaf', 'font-weight'))).toBeGreaterThanOrEqual(600);
		expect(await style(page, '#nt-team-link', 'color')).toBe(current);
		expect(Number(await style(page, '#nt-team-link', 'font-weight'))).toBeLessThan(600);
		expect(await style(page, '#nt-lab-trigger', 'color')).toBe('rgb(1, 2, 3)');
		// The hover is the variant's tint, the same as a top-level link's in the panel.
		await page.hover('#nt-home');
		const tint = await style(page, '#nt-home', 'background-color');
		for (const color of ['rgb(4, 5, 6)', 'rgb(0, 200, 0)', 'rgba(0, 0, 0, 0)']) expect(tint).not.toBe(color);
		await page.hover('#nt-history');
		expect(await style(page, '#nt-history', 'background-color')).toBe(tint);
		await page.hover('#nt-leaf');
		expect(await style(page, '#nt-leaf', 'background-color')).toBe(tint);
		// The same size and radius as a link at the top of the panel.
		const [home, history] = await Promise.all(['#nt-home', '#nt-history'].map((s) => rect(page, s)));
		expect(Math.abs(home.height - history.height)).toBeLessThan(2);
		expect(await style(page, '#nt-history', 'border-top-left-radius')).toBe(await style(page, '#nt-home', 'border-top-left-radius'));
	});

	test('Tab walks the links in visual order, skipping the hidden toggles', async ({ page, browserName }) => {
		await withoutModule(page, 'nav');
		await open(page, 400);
		await page.click('#nt-toggle');
		await settle(page, '#nt-menu');
		await page.focus('#nt-home');
		const order = ['nt-home'];
		for (let i = 0; i < 5; i++) {
			await tab(page, browserName);
			order.push(await page.evaluate(() => document.activeElement.id));
		}
		expect(order).toEqual(['nt-home', 'nt-about-link', 'nt-history', 'nt-team-link', 'nt-leaf', 'nt-lab-trigger']);
	});
	test('in a screen panel every level is centred on one axis and steps down in size', async ({ page }) => {
		await withoutModule(page, 'nav');
		await open(page, 400);
		await page.evaluate(() => document.querySelector('#nt').setAttribute('data-panel', 'screen'));
		await page.click('#nt-toggle');
		await settle(page, '#nt-menu');
		const ids = ['#nt-home', '#nt-about-link', '#nt-history', '#nt-team-link', '#nt-leaf', '#nt-lab-trigger'];
		const rects = await Promise.all(ids.map((s) => rect(page, s)));
		const mid = (r) => (r.left + r.right) / 2;
		for (const r of rects) expect(Math.abs(mid(r) - mid(rects[0]))).toBeLessThan(2);
		for (let i = 1; i < rects.length; i++) expect(rects[i].top).toBeGreaterThanOrEqual(rects[i - 1].bottom - 1);
		const size = async (s) => parseFloat(await style(page, s, 'font-size'));
		expect(await size('#nt-history')).toBeLessThan(await size('#nt-about-link'));
		expect(await size('#nt-leaf')).toBeLessThan(await size('#nt-history'));
	});

	test('in the bar a split dropdown still opens as a floating card under its parent', async ({ page }) => {
		await open(page, 1000);
		await expect(page.locator('#nt-about-menu')).toBeHidden();
		await page.click('#nt-about-toggle');
		await settle(page, '#nt-about-menu');
		expect(await isOpen(page, 'nt-about-menu')).toBe(true);
		const [link, menu] = await Promise.all(['#nt-about-link', '#nt-about-menu'].map((s) => rect(page, s)));
		expect(menu.top).toBeGreaterThanOrEqual(link.bottom - 1);
		// The first level opens under its item, the link, not under the small toggle.
		if (await anchored(page)) expect(Math.abs(menu.left - link.left)).toBeLessThanOrEqual(2);
		expect(await style(page, '#nt-about-menu', 'position')).not.toBe('static');
	});

	test.describe('with the module', () => {
		const openPanel = async (page) => { await open(page, 400); await page.click('#nt-toggle'); await settle(page, '#nt-menu'); };
		const expanded = (page, id) => page.getAttribute(`#${id}`, 'aria-expanded');

		test('the panel opens on the current branch, and other groups start collapsed', async ({ page }) => {
			await openPanel(page);
			expect(await expanded(page, 'nt-about-toggle')).toBe('true');
			expect(await expanded(page, 'nt-team-toggle')).toBe('true');
			expect(await expanded(page, 'nt-lab-trigger')).toBe('false');
			await expect(page.locator('#nt-leaf')).toBeVisible();
			await expect(page.locator('#nt-lab-leaf')).toBeHidden();
		});
		test('a toggle opens and closes its group in place, without opening a popover', async ({ page }) => {
			await openPanel(page);
			const before = await rect(page, '#nt-lab-trigger');
			await page.click('#nt-about-toggle');
			await settle(page, '#nt-about-menu');
			await expect(page.locator('#nt-history')).toBeHidden();
			expect(await isOpen(page, 'nt-about-menu')).toBe(false);
			expect((await rect(page, '#nt-lab-trigger')).top).toBeLessThan(before.top);
			await page.click('#nt-lab-trigger');
			await settle(page, '#nt-lab-menu');
			await expect(page.locator('#nt-lab-leaf')).toBeVisible();
			expect(await isOpen(page, 'nt-lab-menu')).toBe(false);
		});
		test('in the panel a toggle sits at the end of its link\'s row', async ({ page }) => {
			await openPanel(page);
			const [link, toggle, panel] = await Promise.all(['#nt-about-link', '#nt-about-toggle', '#nt-menu'].map((s) => rect(page, s)));
			expect(Math.abs((link.top + link.bottom) / 2 - (toggle.top + toggle.bottom) / 2)).toBeLessThan(2);
			expect(toggle.left).toBeGreaterThanOrEqual(link.right - 1);
			expect(toggle.right).toBeLessThanOrEqual(panel.right);
			expect(Math.abs(toggle.width - toggle.height)).toBeLessThan(2);
		});
		test('in a screen panel a toggle follows its centred link and the pair is centred', async ({ page }) => {
			await open(page, 400);
			await page.evaluate(() => document.querySelector('#nt').setAttribute('data-panel', 'screen'));
			await page.click('#nt-toggle'); await settle(page, '#nt-menu');
			const [link, toggle, home] = await Promise.all(['#nt-about-link', '#nt-about-toggle', '#nt-home'].map((s) => rect(page, s)));
			expect(Math.abs((link.top + link.bottom) / 2 - (toggle.top + toggle.bottom) / 2)).toBeLessThan(2);
			expect(toggle.left).toBeGreaterThanOrEqual(link.right - 1);
			expect(toggle.left - link.right).toBeLessThan(2);
			const mid = (r) => (r.left + r.right) / 2;
			expect(Math.abs((link.left + toggle.right) / 2 - mid(home))).toBeLessThan(2);
			await page.click('#nt-lab-trigger');
			await expect(page.locator('#nt-lab-leaf')).toBeVisible();
			expect(Math.abs(mid(await rect(page, '#nt-lab-trigger')) - mid(home))).toBeLessThan(2);
		});
		test('each toggle reports its state to assistive technology', async ({ page }) => {
			await openPanel(page);
			await expect(page.getByRole('button', { name: 'About pages', expanded: true })).toHaveCount(1);
			await page.click('#nt-about-toggle');
			await expect(page.getByRole('button', { name: 'About pages', expanded: false })).toHaveCount(1);
		});
		test('Tab never lands inside a collapsed group', async ({ page, browserName }) => {
			await openPanel(page);
			await page.click('#nt-about-toggle');
			await expect(page.locator('#nt-leaf')).toBeHidden();
			await page.focus('#nt-about-toggle');
			await tab(page, browserName);
			expect(await page.evaluate(() => document.activeElement.id)).toBe('nt-lab-trigger');
		});
		test('what was opened is remembered until the page is left', async ({ page }) => {
			await openPanel(page);
			await page.click('#nt-lab-trigger');
			await page.keyboard.press('Escape');
			expect(await expanded(page, 'nt-lab-trigger')).toBe(null);
			await page.click('#nt-toggle'); await settle(page, '#nt-menu');
			expect(await expanded(page, 'nt-lab-trigger')).toBe('true');
		});
		test('after the panel closes and the window widens, a toggle in the bar opens its popover', async ({ page }) => {
			await openPanel(page);
			await page.keyboard.press('Escape');
			await stage(page, 1000);
			expect(await expanded(page, 'nt-about-toggle')).toBe(null);
			await page.click('#nt-about-toggle');
			expect(await isOpen(page, 'nt-about-menu')).toBe(true);
		});
		test('after the window widens while the panel is open, Escape leaves no aria-expanded and a bar toggle opens its popover', async ({ page }) => {
			await openPanel(page);
			await page.click('#nt-lab-trigger');
			expect(await expanded(page, 'nt-lab-trigger')).toBe('true');
			expect(await expanded(page, 'nt-about-toggle')).toBe('true');
			await stage(page, 1000);
			expect(await isOpen(page, 'nt-menu')).toBe(true);
			await page.keyboard.press('Escape');
			expect(await isOpen(page, 'nt-menu')).toBe(false);
			expect(await page.locator('#nt [aria-expanded]').count()).toBe(0);
			await page.click('#nt-about-toggle');
			expect(await isOpen(page, 'nt-about-menu')).toBe(true);
		});
		test('with the current page at the top level every group starts collapsed and no parent is marked', async ({ page }) => {
			await open(page, 400);
			await page.evaluate(() => {
				document.querySelector('#nt-leaf').removeAttribute('aria-current');
				document.querySelector('#nt-home').setAttribute('aria-current', 'page');
			});
			await page.click('#nt-toggle'); await settle(page, '#nt-menu');
			for (const id of ['nt-about-toggle', 'nt-team-toggle', 'nt-lab-trigger']) expect(await expanded(page, id), id).toBe('false');
			const plain = await style(page, '#nt-lab-trigger', 'color');
			expect(await style(page, '#nt-about-link', 'color')).toBe(plain);
			expect(await style(page, '#nt-about-toggle', 'color')).toBe(plain);
			expect(await style(page, '#nt-team-link', 'color')).toBe(await style(page, '#nt-history', 'color'));
			expect(await style(page, '#nt-home', 'color')).not.toBe(plain);
		});
		test('a label trigger that is a group toggle puts its chevron at the row end, like the other toggles', async ({ page }) => {
			await openPanel(page);
			const [trigger, row, toggle] = await Promise.all(['#nt-lab-trigger', '#nt-lab', '#nt-about-toggle'].map((s) => rect(page, s)));
			expect(Math.abs(trigger.right - row.right)).toBeLessThanOrEqual(2);
			expect(Math.abs(toggle.right - row.right)).toBeLessThanOrEqual(2);
			expect(await chevronRoom(page, '#nt-lab-trigger')).toBeLessThan(2);
		});
		test('a group toggle is centred on its link, not hung from the top of the row', async ({ page }) => {
			await openPanel(page);
			const [link, toggle] = await Promise.all(['#nt-about-link', '#nt-about-toggle'].map((s) => rect(page, s)));
			expect(Math.abs((link.top + link.bottom) / 2 - (toggle.top + toggle.bottom) / 2)).toBeLessThanOrEqual(0.5);
		});
		// The close button sits over the end of the first row. A link keeps its
		// label at the start, so the two share the row; a group's toggle and a
		// label's chevron are at the end, exactly under it.
		const withClose = (page, first) => page.evaluate((id) => {
			const li = document.createElement('li');
			li.setAttribute('data-close', '');
			li.id = 'nt-close';
			li.innerHTML = '<button type="button" popovertarget="nt-menu" popovertargetaction="hide" aria-label="Close">×</button>';
			document.querySelector('#nt-menu').prepend(li);
			li.after(document.getElementById(id));
		}, first);
		for (const [first, control] of [['nt-about', '#nt-about-toggle'], ['nt-lab', '#nt-lab-trigger']]) {
			test(`the close button and a first item that is a group do not overlap (${first})`, async ({ page }) => {
				await open(page, 400);
				await withClose(page, first);
				await page.click('#nt-toggle'); await settle(page, '#nt-menu');
				const [close, group] = await Promise.all(['#nt-close button', control].map((s) => rect(page, s)));
				expect(group.top).toBeGreaterThanOrEqual(close.bottom - 0.5);
				const before = await expanded(page, control.slice(1));
				await page.click(control);
				expect(await expanded(page, control.slice(1))).not.toBe(before);
				await page.click('#nt-close button');
				expect(await isOpen(page, 'nt-menu')).toBe(false);
			});
		}
		test('a first item that is a plain link still shares its row with the close button', async ({ page }) => {
			await open(page, 400);
			await withClose(page, 'nt-home');
			await page.click('#nt-toggle'); await settle(page, '#nt-menu');
			const [close, home] = await Promise.all(['#nt-close button', '#nt-home'].map((s) => rect(page, s)));
			expect(home.top).toBeLessThan(close.bottom);
		});
		test('a label long enough to wrap still keeps a space before its chevron', async ({ page }) => {
			await openPanel(page);
			await page.evaluate(() => { document.querySelector('#nt-lab-trigger').textContent = 'Everything else we could not find a better heading for anywhere on this site'; });
			// Lines set against the end of the label's box, so the label's end is
			// the box's end and a short last word cannot pass for the space.
			await page.addStyleTag({ content: '#nt-lab-trigger { text-align: end; }' });
			// The chevron sits at the end of the content box at its full width,
			// so the space is what is left between the label's end and its start.
			const { gap, chevron, lines } = await page.evaluate(() => {
				const el = document.querySelector('#nt-lab-trigger');
				const cs = getComputedStyle(el);
				const after = getComputedStyle(el, '::after');
				const range = document.createRange();
				range.selectNodeContents(el);
				const label = range.getBoundingClientRect();
				const width = parseFloat(after.width) + (after.boxSizing === 'border-box' ? 0 : parseFloat(after.borderRightWidth));
				const start = el.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) - width;
				return { gap: start - label.right, chevron: parseFloat(after.width), lines: range.getClientRects().length };
			});
			expect(lines).toBeGreaterThan(1);
			expect(gap).toBeGreaterThanOrEqual((await token(page, '--yeti-space-xs')) - 0.5);
			// It is not squeezed to make room, either.
			expect(chevron).toBeCloseTo(0.5 * parseFloat(await style(page, '#nt-lab-trigger', 'font-size')), 0);
		});
		test('with no current page every group starts collapsed', async ({ page }) => {
			await open(page, 400);
			await page.evaluate(() => document.querySelector('#nt-leaf').removeAttribute('aria-current'));
			await page.click('#nt-toggle'); await settle(page, '#nt-menu');
			expect(await expanded(page, 'nt-about-toggle')).toBe('false');
		});
		test('a nav added after load gets the same behaviour', async ({ page }) => {
			await open(page, 400);
			await page.evaluate(() => { const c = document.querySelector('#nt').cloneNode(true); c.querySelectorAll('[id]').forEach((e) => { e.id = `c-${e.id}`; }); c.querySelectorAll('[popovertarget]').forEach((e) => e.setAttribute('popovertarget', `c-${e.getAttribute('popovertarget')}`)); c.id = 'c-nt'; document.querySelector('#stage').append(c); });
			await page.click('#c-nt-toggle'); await settle(page, '#c-nt-menu');
			expect(await expanded(page, 'c-nt-about-toggle')).toBe('true');
		});
		test('a nav whose list is in the bar carries no aria-expanded', async ({ page }) => {
			await openPanel(page);
			expect(await page.locator('#nt [aria-expanded]').count()).toBeGreaterThan(0);
			await page.keyboard.press('Escape');
			await stage(page, 1000);
			expect(await page.locator('#nt [aria-expanded]').count()).toBe(0);
		});
		test('an open group draws its links\' focus rings whole', async ({ page, browserName }) => {
			await openPanel(page);
			await page.focus('#nt-about-toggle');
			const seen = [];
			for (let i = 0; i < 4; i++) {
				await tab(page, browserName);
				const ring = await page.evaluate(() => {
					const el = document.activeElement;
					const cs = getComputedStyle(el);
					const grow = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
					const r = el.getBoundingClientRect();
					let clip = el.parentElement;
					while (clip && clip.id !== 'nt-menu' && ['overflow-x', 'overflow-y'].every((p) => getComputedStyle(clip)[p] === 'visible')) clip = clip.parentElement;
					const c = clip.getBoundingClientRect();
					return { id: el.id, visible: el.matches(':focus-visible'), width: parseFloat(cs.outlineWidth), box: [r.top - grow, r.right + grow, r.bottom + grow, r.left - grow], clip: [c.top, c.right, c.bottom, c.left] };
				});
				seen.push(ring.id);
				if (ring.id !== 'nt-history' && ring.id !== 'nt-leaf') continue;
				expect(ring.visible).toBe(true);
				expect(ring.width).toBeGreaterThan(0);
				expect(ring.box[0]).toBeGreaterThanOrEqual(ring.clip[0] - 0.5);
				expect(ring.box[1]).toBeLessThanOrEqual(ring.clip[1] + 0.5);
				expect(ring.box[2]).toBeLessThanOrEqual(ring.clip[2] + 0.5);
				expect(ring.box[3]).toBeGreaterThanOrEqual(ring.clip[3] - 0.5);
			}
			expect(seen).toEqual(['nt-history', 'nt-team-link', 'nt-team-toggle', 'nt-leaf']);
		});
		test('a button the author put in the panel keeps its own click and state', async ({ page }) => {
			await open(page, 400);
			await page.evaluate(() => {
				const li = document.createElement('li');
				li.innerHTML = '<button type="button" aria-expanded="false" popovertarget="own-pop" id="own">Search</button><div popover id="own-pop">Hi</div>';
				document.querySelector('#nt-menu').append(li);
				window.addEventListener('click', (e) => { if (e.target.id === 'own') document.querySelector('#own').dataset.prevented = String(e.defaultPrevented); });
			});
			await page.click('#nt-toggle'); await settle(page, '#nt-menu');
			await page.click('#own');
			expect(await page.getAttribute('#own', 'data-prevented')).toBe('false');
			expect(await expanded(page, 'own')).toBe('false');
		});
		test('the keyboard folds and unfolds a group with Enter and Space', async ({ page }) => {
			await openPanel(page);
			await page.focus('#nt-about-toggle');
			await page.keyboard.press('Enter');
			expect(await expanded(page, 'nt-about-toggle')).toBe('false');
			await expect(page.locator('#nt-history')).toBeHidden();
			await page.keyboard.press('Space');
			expect(await expanded(page, 'nt-about-toggle')).toBe('true');
			await expect(page.locator('#nt-history')).toBeVisible();
			await expect.poll(() => style(page, '#nt-about-menu', 'overflow')).toBe('visible');
		});
	});
});
