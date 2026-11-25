import { test, expect } from 'playwright/test';
import { stage, rect, rects, style, axe, painted, withoutModule, token, same } from '../lib/layout.js';

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

	test.describe('data-justify', () => {
		const justify = (page, value) => page.evaluate((v) => document.querySelector('#nav').setAttribute('data-justify', v), value);
		const gap = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#nav')).columnGap));

		test('by default the links sit beside the brand', async ({ page }) => {
			await open(page, 1000);
			const [brand, menu] = await Promise.all(['#brand', '#menu'].map((s) => rect(page, s)));
			expect(menu.left - brand.right).toBeCloseTo(await gap(page), 0);
		});
		test('end puts the links at the end of the bar, with the actions straight after them', async ({ page }) => {
			await open(page, 1000);
			await justify(page, 'end');
			const [brand, menu, actions] = await Promise.all(['#brand', '#menu', '#actions'].map((s) => rect(page, s)));
			expect(actions.left - menu.right).toBeCloseTo(await gap(page), 0);
			expect(menu.left - brand.right).toBeGreaterThan(100);
		});
		test('end with no actions puts the links against the bar\'s end', async ({ page }) => {
			await open(page, 1000);
			await justify(page, 'end');
			await page.evaluate(() => document.querySelector('#actions').remove());
			const [nav, menu] = await Promise.all(['#nav', '#menu'].map((s) => rect(page, s)));
			const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#nav')).paddingRight));
			expect(nav.right - pad - menu.right).toBeLessThan(1);
		});
		test('center puts the links in the middle of the room between the brand and the actions', async ({ page }) => {
			await open(page, 1000);
			await justify(page, 'center');
			const [brand, menu, actions] = await Promise.all(['#brand', '#menu', '#actions'].map((s) => rect(page, s)));
			expect(Math.abs((menu.left - brand.right) - (actions.left - menu.right))).toBeLessThan(1);
			expect(menu.left - brand.right).toBeGreaterThan(50);
		});
		for (const value of ['end', 'center']) {
			test(`below the threshold the toggle sits at the end with ${value}`, async ({ page }) => {
				await open(page, 400);
				await justify(page, value);
				const [brand, toggle, actions] = await Promise.all(['#brand', '#toggle', '#actions'].map((s) => rect(page, s)));
				expect(actions.left - toggle.right).toBeCloseTo(await gap(page), 0);
				expect(toggle.left - brand.right).toBeGreaterThan(20);
			});
		}
		test('the open panel is not moved by it', async ({ page }) => {
			await open(page, 400);
			await page.click('#toggle'); await settle(page, '#menu');
			const before = await rect(page, '#menu');
			await page.keyboard.press('Escape');
			await justify(page, 'end');
			await page.click('#toggle'); await settle(page, '#menu');
			const after = await rect(page, '#menu');
			expect(after.left).toBeCloseTo(before.left, 0);
			expect(after.width).toBeCloseTo(before.width, 0);
		});
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

	test('a split parent\'s link and toggle meet with square corners, so a fill reads as one piece', async ({ page }) => {
		await open(page, 1000);
		const radius = (sel, corner) => style(page, sel, `border-${corner}-radius`).then(parseFloat);
		expect(await radius('#nt-about-link', 'start-end')).toBe(0);
		expect(await radius('#nt-about-link', 'end-end')).toBe(0);
		expect(await radius('#nt-about-toggle', 'start-start')).toBe(0);
		expect(await radius('#nt-about-toggle', 'end-start')).toBe(0);
		// The outer corners, and a trigger that is not split, keep the nav's radius.
		expect(await radius('#nt-about-link', 'start-start')).toBeGreaterThan(0);
		expect(await radius('#nt-about-toggle', 'end-end')).toBeGreaterThan(0);
		expect(await radius('#nt-lab-trigger', 'start-end')).toBeGreaterThan(0);
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

	test('a group shown in place in the open panel is as tall as its pages, and the panel scrolls instead', async ({ page }) => {
		await page.setViewportSize({ width: 400, height: 600 });
		await open(page, 400);
		await page.evaluate(() => {
			const group = document.getElementById('nt-about-menu');
			for (let i = 0; i < 60; i += 1) group.insertAdjacentHTML('beforeend', `<li><a href="#">Page ${i + 1}</a></li>`);
		});
		await page.click('#nt-toggle');
		await settle(page, '#nt-menu');
		const group = await page.evaluate(() => {
			const el = document.getElementById('nt-about-menu');
			const content = [...el.children].reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
			return { height: el.getBoundingClientRect().height, content, scroll: el.scrollHeight, client: el.clientHeight };
		});
		expect(group.height).toBeGreaterThan(600);
		expect(group.height).toBeCloseTo(group.content, 0);
		expect(group.scroll).toBe(group.client);
		expect(await page.evaluate(() => { const el = document.getElementById('nt-menu'); return el.scrollHeight > el.clientHeight; })).toBe(true);
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

	test.describe('a .button in the open panel', () => {
		const looks = ['background-color', 'color', 'border-top-left-radius', 'padding-inline-start', 'padding-inline-end', 'font-weight'];
		const read = (page, selector) => page.evaluate(([s, props]) => {
			const el = document.querySelector(s);
			const cs = getComputedStyle(el);
			return { ...Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])), width: Math.round(el.getBoundingClientRect().width) };
		}, [selector, looks]);
		// Below the threshold, with the dropdown's panel shown: in place when
		// the module folds it, docked under its trigger when there is no module.
		const showGroup = async (page, before = () => {}, load = true) => {
			if (load) await open(page, 400);
			await page.evaluate(before);
			await page.click('#toggle');
			await settle(page, '#menu');
			if (await page.getAttribute('#nav-li-trigger', 'aria-expanded') !== 'true') await page.click('#nav-li-trigger');
			await settle(page, '#nav-li-menu');
			await settle(page, '#nav-li-cta');
		};

		test('inside a dropdown\'s group, with the module, it keeps its own look', async ({ page }) => {
			await showGroup(page);
			expect(await page.getAttribute('#nav-li-trigger', 'aria-expanded')).toBe('true');
			expect(await read(page, '#nav-li-cta')).toEqual(await read(page, '#nav-ref-cta'));
		});

		test('inside a dropdown\'s group, with the module, it takes its own hover fill', async ({ page }) => {
			// The reference first: the open panel covers it.
			await open(page, 400);
			await page.hover('#nav-ref-cta');
			await settle(page, '#nav-ref-cta');
			const hovered = await style(page, '#nav-ref-cta', 'background-color');
			await page.mouse.move(5, 5);
			await showGroup(page, () => {}, false);
			await page.hover('#nav-li-cta');
			await settle(page, '#nav-li-cta');
			expect(await style(page, '#nav-li-cta', 'background-color')).toBe(hovered);
		});

		test('inside a dropdown\'s group, with the module, a current .button keeps its own color and weight', async ({ page }) => {
			await showGroup(page, () => { for (const id of ['nav-li-cta', 'nav-ref-cta']) document.getElementById(id).setAttribute('aria-current', 'page'); });
			const pick = ({ color, 'font-weight': weight }) => ({ color, weight });
			expect(pick(await read(page, '#nav-li-cta'))).toEqual(pick(await read(page, '#nav-ref-cta')));
		});

		test('inside a dropdown\'s panel, without the module, it keeps its own look', async ({ page }) => {
			await withoutModule(page, 'nav');
			await showGroup(page);
			expect(await isOpen(page, 'nav-li-menu')).toBe(true);
			expect(await read(page, '#nav-li-cta')).toEqual(await read(page, '#nav-ref-cta'));
		});

		test('straight in the list, a .button fills its row like the links beside it', async ({ page }) => {
			await open(page, 400);
			await page.evaluate(() => document.querySelector('#menu').insertAdjacentHTML('beforeend', '<li><a class="button" href="#" id="list-cta">Sign up</a></li>'));
			await page.click('#toggle');
			await settle(page, '#menu');
			const [link, cta] = await Promise.all([rect(page, '#plain'), rect(page, '#list-cta')]);
			expect(Math.abs(cta.width - link.width)).toBeLessThan(1);
		});
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

	test.describe('data-panel="bar"', () => {
		const openBar = async (page, width = 400) => {
			const response = await page.goto('/test/browser/fixtures/components/nav-bar.html');
			expect(response.status()).toBe(200);
			await stage(page, width);
			await painted(page);
		};
		// A phone: the viewport as narrow as the stage, so a panel near the
		// screen's edge has to find room.
		const phone = async (page) => {
			await page.setViewportSize({ width: 390, height: 700 });
			await openBar(page, 390);
		};
		// The viewport's own box, less any scroll bar, which is what a fixed box
		// with zero insets fills.
		const viewport = (page) => page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }));
		const items = '#bar-menu > li:not([data-close])';
		// A link's label is a bare text node, so its box is read through a range.
		// Its lines are counted by their tops: a cut-off line reports two boxes on
		// one line, the text and the ellipsis.
		const label = (page, selector) => page.evaluate((s) => {
			const text = [...document.querySelector(s).childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()).at(-1);
			const range = document.createRange();
			range.selectNodeContents(text);
			const r = range.getBoundingClientRect();
			return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, lines: new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size };
		}, selector);
		const middle = (r) => (r.left + r.right) / 2;
		const level = (r) => (r.top + r.bottom) / 2;
		const supported = (page) => page.evaluate(() => CSS.supports('anchor-name: --a') && CSS.supports('anchor-scope: --a') && CSS.supports('position-area', 'block-end'));

		test('below the threshold the list is fixed across the bottom of the viewport, and stays there when the page scrolls', async ({ page }) => {
			await openBar(page);
			const view = await viewport(page);
			const across = async () => {
				const menu = await rect(page, '#bar-menu');
				expect(menu.left).toBeCloseTo(0, 0);
				expect(menu.width).toBeCloseTo(view.width, 0);
				expect(menu.bottom).toBeCloseTo(view.height, 0);
			};
			await across();
			await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			expect((await rect(page, '#bar-nav')).bottom).toBeLessThan(0);
			await across();
			// It is drawn over the page, positioned content included.
			expect(await page.evaluate(() => {
				const menu = document.querySelector('#bar-menu');
				const r = menu.getBoundingClientRect();
				return menu.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
			})).toBe(true);
		});

		test('the toggle and the close item have no box, and a nav with no toggle in its markup is the same bar', async ({ page }) => {
			await openBar(page);
			for (const s of ['#bar-toggle', '#bar-close']) expect(await page.evaluate((q) => document.querySelector(q).getClientRects().length, s)).toBe(0);
			const withToggle = await rect(page, '#bar-menu');
			await page.evaluate(() => { document.querySelector('#bar-nav').hidden = true; document.querySelector('#bare-nav').hidden = false; });
			const without = await rect(page, '#bare-menu');
			for (const k of ['left', 'top', 'width', 'height']) expect(without[k]).toBeCloseTo(withToggle[k], 1);
		});

		test('five items share the row equally, on one line', async ({ page }) => {
			await openBar(page);
			const boxes = await rects(page, items);
			expect(boxes).toHaveLength(5);
			for (const b of boxes) {
				expect(Math.abs(b.width - boxes[0].width)).toBeLessThanOrEqual(0.5);
				expect(b.top).toBeCloseTo(boxes[0].top, 1);
			}
		});

		test('a link is its icon above its label, both centred; a link with no icon is its label, centred', async ({ page }) => {
			await openBar(page);
			const [link, icon, text] = await Promise.all([rect(page, '#bar-search'), rect(page, '#bar-search-icon'), label(page, '#bar-search')]);
			expect(icon.height).toBeGreaterThan(0);
			expect(icon.height).toBeLessThan(link.height / 2);
			expect(icon.bottom).toBeLessThanOrEqual(text.top + 0.5);
			expect(Math.abs(middle(icon) - middle(link))).toBeLessThan(1);
			expect(Math.abs(middle(text) - middle(link))).toBeLessThan(1);
			const [inbox, inboxText] = await Promise.all([rect(page, '#bar-inbox'), label(page, '#bar-inbox')]);
			expect(Math.abs(middle(inboxText) - middle(inbox))).toBeLessThan(1);
			expect(Math.abs(level(inboxText) - level(inbox))).toBeLessThan(2);
		});

		test('a long label stays on one line and is cut off, and the row keeps its height', async ({ page }) => {
			await openBar(page);
			const before = await rect(page, '#bar-menu');
			await page.evaluate(() => { document.querySelector('#bar-search').lastChild.textContent = 'Search every page, post and person on the whole site'; });
			const text = await label(page, '#bar-search');
			expect(text.lines).toBe(1);
			expect(await page.evaluate(() => { const a = document.querySelector('#bar-search'); return a.scrollWidth > a.clientWidth; })).toBe(true);
			expect((await rect(page, '#bar-menu')).height).toBeCloseTo(before.height, 1);
			// Nor does the row scroll sideways.
			expect(await page.evaluate(() => { const m = document.querySelector('#bar-menu'); return m.scrollWidth <= m.clientWidth; })).toBe(true);
		});

		test('the current page\'s link takes the top bar\'s current color, with no underline or fill', async ({ page }) => {
			await openBar(page, 400);
			const below = await style(page, '#bar-home', 'color');
			expect(below).not.toBe(await style(page, '#bar-search', 'color'));
			expect(await style(page, '#bar-home', 'text-decoration-line')).toBe('none');
			expect(await style(page, '#bar-home', 'background-color')).toBe('rgba(0, 0, 0, 0)');
			await stage(page, 1000);
			expect(await style(page, '#bar-home', 'color')).toBe(below);
		});

		const dropdowns = [
			['a label-only dropdown', '#bar-more-trigger', '#bar-more-menu', null],
			['a split parent', '#bar-account-toggle', '#bar-account-menu', null],
			// The dropdown class on a wrapper inside the li, the nav's other shape.
			['a dropdown in a wrapper', '#bar-more-trigger', '#bar-more-menu', () => {
				const li = document.querySelector('#bar-more');
				const wrap = document.createElement('div');
				wrap.className = 'dropdown';
				wrap.append(...li.children);
				li.classList.remove('dropdown');
				li.append(wrap);
			}],
		];
		for (const [name, trigger, panel, setup] of dropdowns) {
			test(`${name} opens its panel upward, above the bar and inside the viewport`, async ({ page }) => {
				await phone(page);
				test.skip(!(await supported(page)), 'anchor positioning is missing, so the user agent centres the panel');
				if (setup) await page.evaluate(setup);
				await page.click(trigger);
				await settle(page, panel);
				const [bar, box, view] = await Promise.all([rect(page, '#bar-menu'), rect(page, panel), viewport(page)]);
				expect(box.height).toBeGreaterThan(0);
				expect(box.bottom).toBeLessThanOrEqual(bar.top + 0.5);
				expect(box.top).toBeGreaterThanOrEqual(0);
				expect(box.left).toBeGreaterThanOrEqual(0);
				expect(box.right).toBeLessThanOrEqual(view.width);
			});
		}

		test('a panel above the bar taller than the room stops short of the top of the screen and scrolls', async ({ page }) => {
			await phone(page);
			test.skip(!(await supported(page)), 'anchor positioning is missing, so the user agent centres the panel');
			await page.evaluate(() => {
				const panel = document.getElementById('bar-more-menu');
				for (let i = 0; i < 60; i += 1) panel.insertAdjacentHTML('beforeend', `<li><a href="#">Page ${i + 1}</a></li>`);
			});
			await page.click('#bar-more-trigger');
			await settle(page, '#bar-more-menu');
			const [bar, box] = await Promise.all([rect(page, '#bar-menu'), rect(page, '#bar-more-menu')]);
			expect(box.top).toBeGreaterThanOrEqual(0);
			expect(box.bottom).toBeLessThanOrEqual(bar.top + 0.5);
			expect(await page.evaluate(() => { const el = document.getElementById('bar-more-menu'); return el.scrollHeight > el.clientHeight; })).toBe(true);
		});

		test('at or above the threshold it is the same bar as a default nav, with nothing fixed', async ({ page }) => {
			await openBar(page, 1000);
			for (const p of ['position', 'display', 'flex-direction', 'z-index']) expect(await style(page, '#bar-menu', p)).toBe(await style(page, '#ref-menu', p));
			const [barNav, refNav] = await Promise.all([rect(page, '#bar-nav'), rect(page, '#ref-nav')]);
			same(await rect(page, '#bar-menu'), await rect(page, '#ref-menu'), barNav, refNav);
			// Every item, link and icon that has a box; hidden ones have none to compare.
			const parts = (menu) => page.evaluate((m) => [...document.querySelectorAll(`${m} > li, ${m} > li > *, ${m} > li > * > svg`)].filter((el) => el.getClientRects().length).map((el) => {
				const r = el.getBoundingClientRect();
				return { width: r.width, height: r.height, left: r.left, top: r.top };
			}), menu);
			const [barParts, refParts] = await Promise.all([parts('#bar-menu'), parts('#ref-menu')]);
			expect(barParts.length).toBeGreaterThan(5);
			expect(barParts).toHaveLength(refParts.length);
			barParts.forEach((b, i) => same(b, refParts[i], barNav, refNav));
			const fixed = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'fixed' && el.getClientRects().length).map((el) => el.id || el.tagName));
			expect(fixed).toEqual([]);
		});

		test('the bottom padding adds the safe area to the bar\'s own padding', async ({ page }) => {
			await openBar(page);
			expect(await style(page, '#bar-menu', 'padding-bottom')).toBe(await style(page, '#bar-menu', 'padding-top'));
			expect(parseFloat(await style(page, '#bar-menu', 'padding-top'))).toBeGreaterThan(0);
			// The inset cannot be emulated, so the source is what shows it is there.
			const rules = await page.evaluate(() => {
				const walk = (list) => [...list].flatMap((r) => [r, ...(r.styleSheet ? walk(r.styleSheet.cssRules) : r.cssRules ? walk(r.cssRules) : [])]);
				return walk([...document.styleSheets].flatMap((s) => [...s.cssRules]))
					.filter((r) => r.selectorText?.includes('[data-panel="bar"]') && /padding-block-end:[^;]*env\(safe-area-inset-bottom\)/.test(r.style.cssText))
					.length;
			});
			expect(rules).toBeGreaterThan(0);
		});

		test('in forced colors the top edge stays, as the nav\'s own bottom edge does', async ({ page }) => {
			await page.emulateMedia({ forcedColors: 'active' });
			await openBar(page);
			expect(await style(page, '#bar-menu', 'border-top-width')).toBe(await style(page, '#bar-nav', 'border-bottom-width'));
			expect(await style(page, '#bar-menu', 'border-top-style')).toBe('solid');
			expect(await style(page, '#bar-menu', 'border-top-color')).toBe(await style(page, '#bar-nav', 'border-bottom-color'));
		});

		test('in a right-to-left page the row runs from the right', async ({ page }) => {
			await openBar(page);
			await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
			const [menu, boxes] = await Promise.all([rect(page, '#bar-menu'), rects(page, items)]);
			const pad = parseFloat(await style(page, '#bar-menu', 'padding-left'));
			expect(boxes[0].right).toBeCloseTo(menu.right - pad, 0);
			expect(boxes[1].right).toBeLessThan(boxes[0].left + 1);
		});

		test('data-justify leaves no gap where the toggle was: the actions keep the end of the top bar', async ({ page }) => {
			for (const value of ['end', 'center']) {
				await openBar(page);
				await page.evaluate((v) => document.querySelector('#bar-nav').setAttribute('data-justify', v), value);
				const [nav, actions] = await Promise.all([rect(page, '#bar-nav'), rect(page, '#bar-actions')]);
				const pad = parseFloat(await style(page, '#bar-nav', 'padding-right'));
				expect(nav.right - pad - actions.right).toBeLessThan(1);
			}
		});

		test('with the page rule from the docs, the last line of a long page scrolls clear of the bar', async ({ page }) => {
			await openBar(page);
			await page.addStyleTag({ content: 'body { padding-block-end: calc(2 * var(--yeti-leading-sm) * var(--yeti-text-sm) + 2 * var(--yeti-space-xs) + var(--yeti-border-width) + env(safe-area-inset-bottom)); }' });
			await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			const [bar, last] = await Promise.all([rect(page, '#bar-menu'), rect(page, '#last')]);
			expect(last.bottom).toBeLessThanOrEqual(bar.top + 0.5);
			// The rule is the bar's own height, worked out from the same tokens.
			expect(parseFloat(await style(page, 'body', 'padding-bottom'))).toBeCloseTo(bar.height, 0);
		});

		test('has no accessibility violations, below and above the threshold', async ({ page }) => {
			await openBar(page);
			expect(await axe(page)).toEqual([]);
			await stage(page, 1000);
			expect(await axe(page)).toEqual([]);
		});
	});

	test.describe('More', () => {
		const openMore = async (page, width = 1000) => {
			const response = await page.goto('/test/browser/fixtures/components/nav-more.html');
			expect(response.status()).toBe(200);
			await stage(page, width);
			await painted(page);
		};
		const ids = ['m-home', 'm-guides', 'm-docs', 'm-blog', 'm-about', 'm-pricing', 'm-help', 'm-news'];
		const bottom = ['b-1', 'b-2', 'b-3', 'b-4', 'b-5', 'b-6', 'b-7', 'b-8'];
		// Where each item is: in the bar, in order, or in More's panel, in order.
		// An item is named by its own id or, in the bottom bar, its link's.
		const where = (page, list = 'more-menu', more = 'm-more') => page.evaluate(([l, m]) => {
			const name = (li) => li.id || li.querySelector('[id]').id;
			const item = document.getElementById(m);
			return {
				bar: [...document.getElementById(l).children].filter((li) => li !== item && !li.matches('[data-close]')).map(name),
				more: [...item.querySelector(':scope > [popover]').children].map(name),
				hidden: item.hidden,
				box: item.getClientRects().length > 0,
			};
		}, [list, more]);
		const wide = { bar: ids, more: [], hidden: true, box: false };
		// The links have room to come back, or not, once the nav has its new size.
		const settles = async (page, check) => { await expect.poll(() => where(page)).toEqual(expect.objectContaining(check)); };
		const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

		test('a wide nav keeps every link in the bar, and More has no box', async ({ page }) => {
			await openMore(page, 1000);
			expect(await where(page)).toEqual(wide);
		});

		test('narrowed above the threshold, the links that do not fit move into More, in order, and the bar is one line inside the nav', async ({ page }) => {
			await openMore(page, 1000);
			await stage(page, 700);
			await settles(page, { hidden: false, box: true });
			const { bar, more } = await where(page);
			expect(bar.length).toBeGreaterThan(0);
			expect(more.length).toBeGreaterThan(0);
			expect([...bar, ...more]).toEqual(ids);
			expect(await page.evaluate(() => { const nav = document.getElementById('more-nav'); return nav.scrollWidth <= nav.clientWidth; })).toBe(true);
			const [nav, boxes] = await Promise.all([rect(page, '#more-nav'), rects(page, '#more-menu > li:not([hidden])')]);
			expect(boxes).toHaveLength(bar.length + 1);
			for (const box of boxes) {
				expect(Math.abs(box.top - boxes[0].top)).toBeLessThan(1);
				expect(Math.abs(box.height - boxes[0].height)).toBeLessThan(1);
				expect(box.left).toBeGreaterThanOrEqual(nav.left - 0.5);
				expect(box.right).toBeLessThanOrEqual(nav.right + 0.5);
			}
			expect((await rect(page, '#more-actions')).right).toBeLessThanOrEqual(nav.right + 0.5);
		});

		test('widened again, every link is back in the bar in order and More is hidden and empty', async ({ page }) => {
			await openMore(page, 700);
			await settles(page, { hidden: false });
			await stage(page, 1000);
			await settles(page, wide);
		});

		test('narrowing or widening in steps ends where one step does, and a resize that changes nothing moves nothing', async ({ page }) => {
			await openMore(page, 1000);
			await stage(page, 640);
			await settles(page, { hidden: false });
			const once = await where(page);
			await stage(page, 1000);
			await settles(page, wide);
			for (const width of [950, 900, 850, 800, 750, 700, 640]) {
				await stage(page, width);
				await frames(page);
			}
			await settles(page, once);
			for (const width of [700, 750, 800, 850, 900, 950, 1000]) {
				await stage(page, width);
				await frames(page);
			}
			await settles(page, wide);
			await stage(page, 640);
			await settles(page, once);
			// The free room left in the bar is more than a pixel, so a pixel less
			// still fits the same links.
			const free = await page.evaluate(() => {
				const more = document.getElementById('m-more').getBoundingClientRect();
				const actions = document.getElementById('more-actions').getBoundingClientRect();
				return actions.left - more.right - parseFloat(getComputedStyle(document.getElementById('more-nav')).columnGap);
			});
			expect(free).toBeGreaterThan(1);
			await page.evaluate(() => {
				window.moves = 0;
				const observer = new MutationObserver((records) => { window.moves += records.length; });
				observer.observe(document.getElementById('more-menu'), { childList: true });
				observer.observe(document.getElementById('m-more-menu'), { childList: true });
			});
			await stage(page, 639);
			await expect.poll(() => page.evaluate(() => document.getElementById('more-nav').getBoundingClientRect().width)).toBeLessThan(640);
			await frames(page);
			expect(await page.evaluate(() => window.moves)).toBe(0);
			expect(await where(page)).toEqual(once);
		});

		test('a moved link is a row of More\'s panel, and a moved dropdown flies out beside its row', async ({ page }) => {
			await openMore(page, 700);
			await settles(page, { hidden: false });
			expect((await where(page)).more).toEqual(expect.arrayContaining(['m-about', 'm-pricing', 'm-help']));
			const row = ['padding-inline-start', 'padding-inline-end', 'min-block-size', 'inline-size', 'border-top-left-radius'];
			const read = (selector) => page.evaluate(([s, props]) => {
				const cs = getComputedStyle(document.querySelector(s));
				return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
			}, [selector, row]);
			await page.click('#m-guides-trigger');
			await settle(page, '#m-guides-menu');
			const ordinary = await read('#m-guides-first');
			await page.keyboard.press('Escape');
			await page.click('#m-more-trigger');
			await settle(page, '#m-more-menu');
			expect(await read('#m-pricing-link')).toEqual(ordinary);
			test.skip(!(await anchored(page)), 'anchor positioning is missing, so the user agent centres the panel');
			for (const [toggle, menu, item] of [['#m-about-toggle', '#m-about-menu', '#m-about'], ['#m-help-trigger', '#m-help-menu', '#m-help']]) {
				await page.click(toggle);
				await settle(page, menu);
				expect(await isOpen(page, 'm-more-menu')).toBe(true);
				const [panel, fly, own] = await Promise.all([rect(page, '#m-more-menu'), rect(page, menu), rect(page, item)]);
				expect(fly.left >= panel.right - 1 || fly.right <= panel.left + 1, menu).toBe(true);
				expect(Math.abs(fly.top - own.top)).toBeLessThan(8);
				// The row is the panel's width, less its padding, whichever shape the item has.
				expect(Math.abs(own.width - (await rect(page, '#m-pricing')).width)).toBeLessThan(1);
			}
		});

		test('with the current page\'s link in More, the More button takes the color of a dropdown that holds the current page', async ({ page }) => {
			await openMore(page, 700);
			await settles(page, { hidden: false });
			const plain = await style(page, '#m-more-trigger', 'color');
			await page.evaluate(() => document.getElementById('m-guides-first').setAttribute('aria-current', 'page'));
			const holding = await style(page, '#m-guides-trigger', 'color');
			expect(holding).not.toBe(plain);
			await page.evaluate(() => {
				document.getElementById('m-guides-first').removeAttribute('aria-current');
				document.getElementById('m-news-link').setAttribute('aria-current', 'page');
			});
			expect(await style(page, '#m-more-trigger', 'color')).toBe(holding);
		});

		test('focus on a link that moves into More goes to the More button, and on one that comes back stays on it; never on the page', async ({ page }) => {
			await openMore(page, 1000);
			await page.focus('#m-news-link');
			// From here on, every frame is checked.
			await page.evaluate(() => {
				window.fell = 0;
				const watch = () => { if (document.activeElement === document.body) window.fell += 1; requestAnimationFrame(watch); };
				requestAnimationFrame(watch);
			});
			await stage(page, 700);
			await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('m-more-trigger');
			await settles(page, { hidden: false });
			// Open More, and focus the moved link inside it; widening brings it back.
			await page.keyboard.press('Enter');
			await settle(page, '#m-more-menu');
			await page.focus('#m-news-link');
			await stage(page, 1000);
			await settles(page, wide);
			expect(await page.evaluate(() => document.activeElement.id)).toBe('m-news-link');
			expect(await isOpen(page, 'm-more-menu')).toBe(false);
			expect(await page.evaluate(() => window.fell)).toBe(0);
		});

		test('below the threshold every link is back in the list behind the toggle, and above it again the bar is as it was', async ({ page }) => {
			await openMore(page, 700);
			await settles(page, { hidden: false });
			const above = await where(page);
			await stage(page, 400);
			await settles(page, { bar: ids, more: [], hidden: true });
			await page.click('#more-toggle');
			await settle(page, '#more-menu');
			expect(await isOpen(page, 'more-menu')).toBe(true);
			expect(await style(page, '#more-menu', 'position')).toBe('fixed');
			expect((await rect(page, '#more-menu')).width).toBeCloseTo(page.viewportSize().width, 0);
			expect((await where(page)).box).toBe(false);
			for (const id of ids) expect(await page.evaluate((i) => document.getElementById(i).getClientRects().length > 0, id), id).toBe(true);
			await page.keyboard.press('Escape');
			await stage(page, 700);
			await settles(page, above);
		});

		test('in a bottom bar with eight links, four and More share the row, and More opens above the bar; with five, all five show', async ({ page }) => {
			await page.setViewportSize({ width: 400, height: 700 });
			await openMore(page, 400);
			await page.evaluate(() => { document.getElementById('bar-nav').hidden = false; });
			await expect.poll(() => where(page, 'bar-menu', 'b-more')).toEqual({ bar: bottom.slice(0, 4), more: bottom.slice(4), hidden: false, box: true });
			const boxes = await rects(page, '#bar-menu > li:not([hidden])');
			expect(boxes).toHaveLength(5);
			for (const b of boxes) {
				expect(Math.abs(b.width - boxes[0].width)).toBeLessThanOrEqual(0.5);
				expect(b.top).toBeCloseTo(boxes[0].top, 1);
			}
			await page.click('#b-more-trigger');
			await settle(page, '#b-more-menu');
			if (await anchored(page)) expect((await rect(page, '#b-more-menu')).bottom).toBeLessThanOrEqual((await rect(page, '#bar-menu')).top + 0.5);
			await openMore(page, 400);
			await page.evaluate(() => {
				for (const id of ['b-6', 'b-7', 'b-8']) document.getElementById(id).parentElement.remove();
				document.getElementById('bar-nav').hidden = false;
			});
			await expect.poll(() => where(page, 'bar-menu', 'b-more')).toEqual({ bar: bottom.slice(0, 5), more: [], hidden: true, box: false });
			expect(await rects(page, '#bar-menu > li:not([hidden])')).toHaveLength(5);
		});

		test('without the module More has no box at any width, and every link stays in the list', async ({ page }) => {
			await withoutModule(page, 'nav');
			await openMore(page, 1000);
			for (const width of [1000, 700, 400]) {
				await stage(page, width);
				await frames(page);
				expect(await where(page), String(width)).toEqual(wide);
			}
		});

		test('a nav with no More item is untouched at every width, and the page logs no error', async ({ page }) => {
			const errors = [];
			page.on('pageerror', (error) => errors.push(String(error)));
			page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
			await openMore(page, 1000);
			await page.evaluate(() => {
				window.touched = 0;
				new MutationObserver((records) => { window.touched += records.length; }).observe(document.getElementById('plain-nav'), { subtree: true, childList: true, attributes: true });
				// A browser reports some errors only as an event on the window.
				window.errors = [];
				window.addEventListener('error', (event) => window.errors.push(event.message));
				// Labels of several words wrap while the bar is squeezed, so the
				// nav is taller until the links move: that must not be an error.
				document.getElementById('m-pricing-link').textContent = 'Plans and pricing';
				document.getElementById('more-brand').textContent = 'The Copper Pan Company';
			});
			for (const width of [700, 400, 1000, 640]) {
				await stage(page, width);
				await frames(page);
			}
			await settles(page, { hidden: false });
			expect(await page.evaluate(() => window.touched)).toBe(0);
			expect(errors).toEqual([]);
			expect(await page.evaluate(() => window.errors)).toEqual([]);
		});

		test('a group that has been to More and back still folds in the open panel', async ({ page }) => {
			await openMore(page, 700);
			await settles(page, { hidden: false });
			expect((await where(page)).more).toContain('m-about');
			await stage(page, 400);
			await settles(page, { bar: ids });
			await page.click('#more-toggle');
			await settle(page, '#more-menu');
			expect(await page.getAttribute('#m-about-toggle', 'aria-expanded')).toBe('false');
			await expect(page.locator('#m-history')).toBeHidden();
			await page.click('#m-about-toggle');
			expect(await page.getAttribute('#m-about-toggle', 'aria-expanded')).toBe('true');
			await expect(page.locator('#m-history')).toBeVisible();
			await page.click('#m-about-toggle');
			expect(await page.getAttribute('#m-about-toggle', 'aria-expanded')).toBe('false');
			await expect(page.locator('#m-history')).toBeHidden();
		});

		// Watches every frame from now on for focus that has fallen to the page.
		const watchFocus = (page) => page.evaluate(() => {
			window.fell = 0;
			const watch = () => { if (document.activeElement === document.body) window.fell += 1; requestAnimationFrame(watch); };
			requestAnimationFrame(watch);
		});
		const focused = (page) => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);

		test('focus on the More button goes to the last link in the bar when More is hidden again, with its panel closed or open', async ({ page }) => {
			for (const opened of [false, true]) {
				await openMore(page, 700);
				await settles(page, { hidden: false });
				if (opened) {
					await page.click('#m-more-trigger');
					await settle(page, '#m-more-menu');
				}
				await page.focus('#m-more-trigger');
				await watchFocus(page);
				await stage(page, 1000);
				await settles(page, wide);
				await expect.poll(() => focused(page), String(opened)).toBe('m-news-link');
				await frames(page);
				expect(await focused(page), String(opened)).toBe('m-news-link');
				expect(await page.evaluate(() => window.fell), String(opened)).toBe(0);
			}
		});

		test('a brand that grows after load moves links into More, and one that shrinks again lets them back', async ({ page }) => {
			await openMore(page, 700);
			await settles(page, { hidden: false });
			const before = await where(page);
			// A logo that arrives late: the brand is 150px wider, and the nav is not.
			await page.evaluate(() => { document.getElementById('more-brand').style.paddingInlineEnd = '150px'; });
			await expect.poll(async () => {
				const now = await where(page);
				const fits = await page.evaluate(() => {
					const nav = document.getElementById('more-nav');
					const edge = nav.getBoundingClientRect().right + 0.5;
					return nav.scrollWidth <= nav.clientWidth && document.getElementById('more-actions').getBoundingClientRect().right <= edge;
				});
				return fits && now.more.length > before.more.length && [...now.bar, ...now.more].join() === ids.join();
			}).toBe(true);
			await page.evaluate(() => { document.getElementById('more-brand').style.paddingInlineEnd = ''; });
			await settles(page, before);
		});

		test('a font that arrives narrower than its fallback lets back a link that now fits', async ({ page }) => {
			// The page's fonts are ready only when the test says so.
			await page.addInitScript(() => {
				let release;
				const ready = new Promise((resolve) => { release = resolve; });
				window.releaseFonts = () => release(document.fonts);
				Object.defineProperty(document.fonts, 'ready', { get: () => ready });
			});
			await openMore(page, 920);
			await settles(page, { hidden: false });
			const before = await where(page);
			// The moved links' labels shrink while they are in More, as they would
			// when the real font is narrower than the fallback.
			await page.evaluate((moved) => {
				for (const id of moved) document.querySelector(`#${id} > a, #${id} > button, #${id} button`).firstChild.textContent = 'x';
			}, before.more);
			await frames(page);
			expect(await where(page)).toEqual(before);
			await page.evaluate(() => window.releaseFonts());
			await expect.poll(async () => (await where(page)).more.length).toBeLessThan(before.more.length);
			const after = await where(page);
			expect([...after.bar, ...after.more]).toEqual(ids);
		});

		test('closing the nav\'s panel after it was widened past the threshold while open decides the bar for its new width', async ({ page }) => {
			await openMore(page, 400);
			// The nav is the same size with its panel open or closed, so only the
			// panel's closing can tell the module to decide again.
			await page.addStyleTag({ content: '#more-nav { min-block-size: 8rem; } #more-brand, #more-actions { flex: none; } #more-menu :is(a, button) { white-space: nowrap; }' });
			await settles(page, { bar: ids, hidden: true });
			await page.click('#more-toggle');
			await settle(page, '#more-menu');
			await stage(page, 700);
			await frames(page);
			// Nothing moves while the panel is open.
			expect((await where(page)).more).toEqual([]);
			await page.evaluate(() => document.getElementById('more-menu').hidePopover());
			await settles(page, { hidden: false, box: true });
			expect((await where(page)).more.length).toBeGreaterThan(0);
		});

		// An icon's box, its link's, and where the link's label starts.
		const icon = (page, id) => page.evaluate((i) => {
			const link = document.getElementById(i);
			// The space token where the link is, since it may scale with the text.
			const probe = document.createElement('span');
			probe.style.cssText = 'position:absolute;inline-size:var(--yeti-space-xs)';
			link.append(probe);
			const space = probe.getBoundingClientRect().width;
			probe.remove();
			const svg = link.querySelector(':scope > svg').getBoundingClientRect();
			const range = document.createRange();
			range.selectNodeContents(link.lastChild);
			const label = range.getBoundingClientRect();
			const box = link.getBoundingClientRect();
			return { svg: { left: svg.left, right: svg.right, top: svg.top, bottom: svg.bottom, width: svg.width, height: svg.height }, label: { left: label.left, top: label.top }, link: { left: box.left, right: box.right }, em: parseFloat(getComputedStyle(link).fontSize), space };
		}, id);

		test('an icon in a link is above its label in the bottom bar, and beside it, before it and 1em square, in the top bar and in More\'s panel', async ({ page }) => {
			await page.setViewportSize({ width: 400, height: 700 });
			await openMore(page, 400);
			await page.evaluate(() => { document.getElementById('bar-nav').hidden = false; });
			await expect.poll(() => where(page, 'bar-menu', 'b-more')).toEqual(expect.objectContaining({ hidden: false, more: bottom.slice(4) }));
			// In the bottom bar: one line tall, centred above the label.
			const inBar = await icon(page, 'b-1');
			expect(inBar.svg.height).toBeGreaterThan(0);
			expect(inBar.svg.bottom).toBeLessThanOrEqual(inBar.label.top + 0.5);
			expect((inBar.svg.left + inBar.svg.right) / 2).toBeCloseTo((inBar.link.left + inBar.link.right) / 2, 0);
			// Moved into More: a row, with the icon before the label.
			await page.click('#b-more-trigger');
			await settle(page, '#b-more-menu');
			for (const id of ['b-5', 'b-8']) {
				const row = await icon(page, id);
				expect(row.svg.width, id).toBeCloseTo(row.em, 0);
				expect(row.svg.height, id).toBeCloseTo(row.em, 0);
				expect(row.label.left - row.svg.right, id).toBeCloseTo(row.space, 0);
			}
			await page.keyboard.press('Escape');
			// Above the threshold: the top bar, the icon before the label.
			await page.setViewportSize({ width: 1000, height: 700 });
			await stage(page, 1000);
			await expect.poll(() => style(page, '#bar-menu', 'position')).toBe('static');
			const top = await icon(page, 'b-1');
			expect(top.svg.width).toBeCloseTo(top.em, 0);
			expect(top.svg.height).toBeCloseTo(top.em, 0);
			expect(top.label.left - top.svg.right).toBeCloseTo(top.space, 0);
			expect(Math.abs(top.svg.top - top.label.top)).toBeLessThan(top.em);
		});

		test('has no accessibility violations, wide, with More shown and open, and behind the toggle', async ({ page }) => {
			await openMore(page, 1000);
			expect(await axe(page)).toEqual([]);
			await stage(page, 700);
			await settles(page, { hidden: false });
			expect(await axe(page)).toEqual([]);
			await page.click('#m-more-trigger');
			await settle(page, '#m-more-menu');
			expect(await axe(page)).toEqual([]);
			await page.keyboard.press('Escape');
			await stage(page, 400);
			await settles(page, { hidden: true });
			await page.click('#more-toggle');
			await settle(page, '#more-menu');
			expect(await axe(page)).toEqual([]);
		});
	});
});
