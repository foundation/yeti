import { test, expect } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { rect } from './lib/layout.js';

const px = (page, selector, prop) => page.evaluate(([s, p]) => parseFloat(getComputedStyle(document.querySelector(s))[p]), [selector, prop]);
const style = (page, selector, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [selector, prop]);
const token = (page, name) => page.evaluate((n) => { const el = document.createElement('div'); el.style.width = `var(${n})`; document.body.append(el); const w = parseFloat(getComputedStyle(el).width); el.remove(); return w; }, name);

test.describe('base typography and prose', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 900 });
		const response = await page.goto('/test/browser/fixtures/base.html');
		expect(response.status()).toBe(200);
	});

	test('headings map to the scale and body reads the base', async ({ page }) => {
		const md = await token(page, '--yeti-text-md');
		expect(await px(page, 'body', 'fontSize')).toBeCloseTo(md, 1);
		expect(await px(page, '#h1', 'fontSize')).toBeCloseTo(await token(page, '--yeti-text-3xl'), 1);
		expect(await px(page, '#h2', 'fontSize')).toBeCloseTo(await token(page, '--yeti-text-2xl'), 1);
		expect(await style(page, '#h1', 'fontWeight')).toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--yeti-weight-bold').trim()));
	});

	test('headings read their own face and weight tokens, which default to the text', async ({ page }) => {
		expect(await style(page, '#h1', 'fontFamily')).toBe(await style(page, 'p', 'fontFamily'));
		await page.addStyleTag({ content: ':root { --yeti-font-heading: serif; --yeti-weight-heading: 500; }' });
		expect(await style(page, '#h1', 'fontFamily')).toBe('serif');
		expect(await style(page, '#h2', 'fontFamily')).toBe('serif');
		expect(await style(page, '#h1', 'fontWeight')).toBe('500');
		// The text and strong text keep theirs.
		expect(await style(page, 'p', 'fontFamily')).not.toBe('serif');
		expect(await style(page, '#strong', 'fontWeight')).toBe('700');
	});

	test('small lettering reads its own width axis', async ({ page }) => {
		expect(await style(page, '#caption', 'font-stretch')).toBe('100%');
		await page.addStyleTag({ content: ':root { --yeti-stretch-small: 75%; }' });
		expect(await style(page, '#caption', 'font-stretch')).toBe('75%');
		expect(await style(page, 'p', 'font-stretch')).toBe('100%');
	});

	test('headings read one tracking token', async ({ page }) => {
		expect(await style(page, '#h1', 'letter-spacing')).toBe('normal');
		await page.addStyleTag({ content: ':root { --yeti-tracking-heading: -0.03em; }' });
		const size = await px(page, '#h1', 'fontSize');
		expect(await px(page, '#h1', 'letterSpacing')).toBeCloseTo(-0.03 * size, 1);
		expect(await style(page, 'p', 'letter-spacing')).toBe('normal');
		// letter-spacing inherits as an absolute length, so under a tightened
		// heading a badge sitting in it must not inherit that tightening at
		// its own, smaller size.
		await page.evaluate(() => {
			const h2 = document.createElement('h2');
			h2.id = 'h-track';
			h2.innerHTML = 'Title <span class="badge" id="badge-in-heading">New</span>';
			document.querySelector('main').append(h2);
		});
		expect(await style(page, '#badge-in-heading', 'letter-spacing')).toBe('normal');
		expect(parseFloat(await style(page, '#h-track', 'letter-spacing'))).toBeLessThan(0);
	});

	test('the browser\'s own form colours follow the palette', async ({ page }) => {
		const probe = (v) => page.evaluate((n) => { const el = document.createElement('span'); el.style.color = `var(${n})`; document.body.append(el); const c = getComputedStyle(el).color; el.remove(); return c; }, v);
		expect(await style(page, 'html', 'accent-color')).toBe(await probe('--yeti-color-primary'));
		// The caret is left at auto, so it follows the text it sits in rather
		// than a value resolved once at the root: an input in a data-paint
		// band takes that band's own white text, not the page's dark one, so
		// the caret is never dark on a dark background.
		const darkCaret = await page.evaluate(() => {
			const box = document.createElement('div');
			box.dataset.paint = 'black';
			const input = document.createElement('input');
			input.id = 'dark-input';
			box.append(input);
			document.body.append(box);
			const c = getComputedStyle(input).caretColor;
			box.remove();
			return c;
		});
		expect(darkCaret).toBe(await probe('--yeti-white'));
		await page.addStyleTag({ content: ':root { --yeti-hue-primary: 30; }' });
		expect(await style(page, 'html', 'accent-color')).toBe(await probe('--yeti-color-primary'));
		expect(await style(page, 'html', 'accent-color')).not.toBe('auto');
	});

	test('prose rhythm: default gap, heading hug, and heading lead-in', async ({ page }) => {
		expect(await px(page, '#second', 'marginTop')).toBeCloseTo(await token(page, '--yeti-space-md'), 1);
		expect(await px(page, '#lead', 'marginTop')).toBeCloseTo(await token(page, '--yeti-space-sm'), 1);
		expect(await px(page, '#h2', 'marginTop')).toBeCloseTo(await token(page, '--yeti-space-xl'), 1);
		expect(await px(page, '#after-h2', 'marginTop')).toBeCloseTo(await token(page, '--yeti-space-sm'), 1);
		// A list item takes its own token, not a step off the space scale, whose
		// smallest is already two thirds of a line and spaces items like short
		// paragraphs.
		expect(await px(page, '#li2', 'marginTop')).toBeCloseTo(await token(page, '--yeti-list-gap'), 1);
		expect(await px(page, '#li2', 'marginTop')).toBeLessThan(await token(page, '--yeti-space-xs'));
	});

	test('a list item in a layout list is a row, not a flow container', async ({ page }) => {
		// role="list" is the sign a list is layout; the item's children sit on
		// one row and the flow rule must not push the second one down.
		expect(await px(page, '#row-label', 'marginTop')).toBe(0);
		// A prose item is still a flow container: two paragraphs in one item
		// keep the gap between them.
		expect(await px(page, '#nested', 'marginTop')).toBeCloseTo(await token(page, '--yeti-space-md'), 1);
	});

	test('measure caps line length', async ({ page }) => {
		const width = await page.evaluate(() => document.getElementById('second').getBoundingClientRect().width);
		const measure = await page.evaluate(() => {
			const el = document.createElement('div');
			el.style.width = 'var(--yeti-measure)';
			document.getElementById('second').after(el);
			const w = el.getBoundingClientRect().width;
			el.remove();
			return w;
		});
		expect(width).toBeLessThanOrEqual(measure + 1);
		expect(width).toBeGreaterThan(measure * 0.9);
	});

	test('links are underlined and keyboard focus shows a ring', async ({ page }) => {
		expect(await style(page, '#link', 'textDecorationLine')).toContain('underline');
		await page.keyboard.press('Tab');
		const focused = await page.evaluate(() => document.activeElement.id);
		expect(['link', 'name']).toContain(focused);
		expect(await style(page, `#${focused}`, 'outlineStyle')).toBe('solid');
		expect(await px(page, `#${focused}`, 'outlineWidth')).toBe(2);
	});

	test('has no accessibility violations', async ({ page }) => {
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	});

	test('links read the link tokens', async ({ page }) => {
		const probe = (name) => page.evaluate((n) => {
			const el = document.createElement('span');
			el.style.color = `var(${n})`;
			document.body.append(el);
			const v = getComputedStyle(el).color;
			el.remove();
			return v;
		}, name);
		expect(await style(page, 'a', 'color')).toBe(await probe('--yeti-color-primary'));
		// A section that sets its own primary colors its own links, and only those.
		expect(await style(page, '#sect-link', 'color')).toBe('rgb(0, 128, 0)');
		expect(await style(page, '#link', 'color')).not.toBe('rgb(0, 128, 0)');
		await page.addStyleTag({ content: ':root { --yeti-link-color: rgb(1, 2, 3); --yeti-link-color-hover: rgb(4, 5, 6); }' });
		expect(await style(page, 'a', 'color')).toBe('rgb(1, 2, 3)');
		await page.hover('a');
		await expect.poll(() => style(page, 'a', 'color')).toBe('rgb(4, 5, 6)');
	});

	test('the width axis reads two tokens and is normal by default', async ({ page }) => {
		expect(await style(page, 'body', 'font-stretch')).toBe('100%');
		expect(await style(page, 'h1', 'font-stretch')).toBe('100%');
		await page.addStyleTag({ content: ':root { --yeti-stretch-text: 87.5%; --yeti-stretch-heading: 112.5%; }' });
		expect(await style(page, 'p', 'font-stretch')).toBe('87.5%');
		expect(await style(page, 'h1', 'font-stretch')).toBe('112.5%');
	});

	test('the quotation bar is 4px in the strong border color, and a theme element rule changes it', async ({ page }) => {
		expect(await px(page, '#quote', 'border-left-width')).toBe(4);
		const strong = await page.evaluate(() => {
			const probe = document.body.appendChild(document.createElement('span'));
			probe.style.color = 'var(--yeti-color-border-strong)';
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		});
		expect(await style(page, '#quote', 'border-left-color')).toBe(strong);
		// A section that sets its own strong border colors its own quotation bar.
		expect(await style(page, '#sect-quote', 'border-left-color')).toBe('rgb(0, 128, 0)');
		await page.addStyleTag({ content: '@layer yeti.theme { blockquote { border-inline-start-width: 1px; } }' });
		expect(await px(page, '#quote', 'border-left-width')).toBe(1);
	});
});

test.describe('base controls and media', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 900 });
		await page.goto('/test/browser/fixtures/base.html');
	});

	test('text inputs fill the row and share the border token; buttons are raised', async ({ page }) => {
		const form = await page.evaluate(() => document.getElementById('form').getBoundingClientRect().width);
		expect(await page.evaluate(() => document.getElementById('name').getBoundingClientRect().width)).toBeCloseTo(form, 0);
		expect(await style(page, '#name', 'borderTopStyle')).toBe('solid');
		expect(await px(page, '#name', 'borderTopWidth')).toBe(await token(page, '--yeti-border-width'));
		expect(await style(page, '#name', 'borderTopColor')).toBe(await style(page, '#submit', 'borderTopColor'));
		expect(await style(page, '#submit', 'backgroundColor')).not.toBe(await style(page, '#name', 'backgroundColor'));
		expect(await style(page, '#disabled', 'opacity')).toBe('0.6');
		expect(await style(page, '#submit', 'cursor')).toBe('default');
	});

	test('tables have header emphasis, padding, and row rules', async ({ page }) => {
		expect(await style(page, '#th', 'fontWeight')).toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--yeti-weight-bold').trim()));
		expect(await px(page, '#td', 'paddingTop')).toBeCloseTo(await token(page, '--yeti-space-sm'), 1);
		expect(await style(page, '#td', 'borderBottomStyle')).toBe('solid');
	});

	test('code uses the mono stack on a raised surface and pre scrolls', async ({ page }) => {
		expect(await style(page, '#code', 'fontFamily')).not.toBe(await style(page, 'body', 'fontFamily'));
		expect(await style(page, '#code', 'backgroundColor')).toBe(await style(page, '#pre', 'backgroundColor'));
		expect(await style(page, '#pre', 'overflowX')).toBe('auto');
		expect(await style(page, '#hr', 'borderTopStyle')).toBe('solid');
		expect(await px(page, '#quote', 'borderLeftWidth')).toBe(4);
		expect(await style(page, '#caption', 'color')).toBe(await style(page, 'caption', 'color'));
	});
});

test.describe('base disclosures', () => {
	// ::after and ::details-content are read through getPropertyValue, which
	// takes the hyphenated property name, unlike the style() helper above.
	const after = (page, id, prop) => page.evaluate(([i, p]) => getComputedStyle(document.getElementById(i), '::after').getPropertyValue(p), [id, prop]);
	const content = (page, id, prop) => page.evaluate(([i, p]) => getComputedStyle(document.getElementById(i), '::details-content').getPropertyValue(p), [id, prop]);

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 900 });
		await page.goto('/test/browser/fixtures/base.html');
	});

	test('a summary is strong, padded, pressable, and has lost the browser marker', async ({ page }) => {
		expect(await style(page, '#summary', 'fontWeight')).toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--yeti-weight-strong').trim()));
		expect(await px(page, '#summary', 'paddingTop')).toBeCloseTo(await token(page, '--yeti-space-sm'), 1);
		expect(await style(page, '#summary', 'cursor')).toBe('pointer');
		expect(await style(page, '#summary', 'listStyleType')).toBe('none');
		expect(await style(page, '#summary', 'display')).toBe('flex');
	});

	test('the chevron turns when the panel opens', async ({ page }) => {
		expect(await after(page, 'summary', 'content')).not.toBe('none');
		expect(await after(page, 'summary', 'rotate')).not.toBe(await after(page, 'summary-open', 'rotate'));
		expect(parseFloat(await after(page, 'summary', 'transition-duration'))).toBeGreaterThan(0.01);
	});

	test('the chevron points down in a right-to-left page too', async ({ page }) => {
		// The corner is drawn by the bottom and right borders and then turned.
		// Logical borders would move to the left side here, and the same turn
		// would point the corner sideways.
		await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
		const [bottom, right, top, left] = await Promise.all(['bottom', 'right', 'top', 'left'].map((side) => after(page, 'summary', `border-${side}-width`)));
		expect(parseFloat(bottom)).toBeGreaterThan(0);
		expect(parseFloat(right)).toBeGreaterThan(0);
		expect(parseFloat(top)).toBe(0);
		expect(parseFloat(left)).toBe(0);
	});

	test('the panel is a grid row that grows from nothing', async ({ page }) => {
		// The row is what the transition runs on, so it is the row that has to
		// differ between the two states; a panel that only faded arrived at full
		// height at once and read as a flash.
		expect(await style(page, '#details', 'display')).toBe('grid');
		const [shut, opened] = await Promise.all([style(page, '#details', 'gridTemplateRows'), style(page, '#details-open', 'gridTemplateRows')]);
		expect(parseFloat(shut.split(' ')[1])).toBe(0);
		expect(parseFloat(opened.split(' ')[1])).toBeGreaterThan(0);
		expect(await style(page, '#details', 'transitionProperty')).toBe('grid-template-rows');
		expect(parseFloat(await style(page, '#details', 'transitionDuration'))).toBeGreaterThan(0.01);
		expect(await content(page, 'details', 'overflow-y')).toBe('hidden');
	});

	test('under reduced motion the panel opens at once', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/test/browser/fixtures/base.html');
		expect(await style(page, '#details', 'transitionProperty')).toBe('grid-template-rows');
		expect(parseFloat(await style(page, '#details', 'transitionDuration'))).toBeLessThanOrEqual(0.01);
	});
});

test.describe('base definition lists', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 900 });
		await page.goto('/test/browser/fixtures/base.html');
	});

	test('a term is strong, its definition is indented, and pairs are spaced', async ({ page }) => {
		expect(await style(page, '#dt1', 'fontWeight')).toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--yeti-weight-strong').trim()));
		expect(await px(page, '#dd1', 'marginLeft')).toBeCloseTo(await token(page, '--yeti-space-md'), 1);
		// The space belongs between pairs, not between every line: a term and
		// its definition are one thing, so only the second term is pushed down.
		expect(await px(page, '#dt1', 'marginTop')).toBe(0);
		expect(await px(page, '#dd1', 'marginTop')).toBe(0);
		expect(await px(page, '#dt2', 'marginTop')).toBeCloseTo(await token(page, '--yeti-space-sm'), 1);
	});

	test('a dl that wraps each pair in a div is spaced the same way', async ({ page }) => {
		expect(await px(page, '#pair2', 'marginTop')).toBeCloseTo(await token(page, '--yeti-space-sm'), 1);
	});
});

test.describe('base quotation attribution', () => {
	const before = (page, id, prop) => page.evaluate(([i, p]) => getComputedStyle(document.getElementById(i), '::before').getPropertyValue(p), [id, prop]);

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 900 });
		await page.goto('/test/browser/fixtures/base.html');
	});

	test('a caption after a quotation leads with a dash that is seen and not read', async ({ page }) => {
		const content = await before(page, 'cite', 'content');
		expect(content).toContain('—');
		// The alternative text is empty, as the breadcrumbs separator's is, so a
		// screen reader hears the name and no stray punctuation.
		expect(content.replace(/\s/g, '')).toMatch(/""$/);
		expect(await style(page, '#cite', 'color')).toBe(await style(page, '#caption', 'color'));
		expect(await px(page, '#cite', 'fontSize')).toBeCloseTo(await token(page, '--yeti-text-sm'), 1);
	});

	test('a caption under a picture is still a caption', async ({ page }) => {
		expect(await before(page, 'caption', 'content')).toBe('none');
	});
});

test.describe('base skip link', () => {
	// Resolves a colour token the way token() resolves a length: through a probe
	// element, because the declared value is a light-dark() pair and only a used
	// value can be compared with what the link computed.
	const colour = (page, name) => page.evaluate((n) => {
		const probe = document.createElement('div');
		probe.style.backgroundColor = `var(${n})`;
		document.body.append(probe);
		const value = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return value;
	}, name);

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 900 });
		const response = await page.goto('/test/browser/fixtures/base-skip.html');
		expect(response.status()).toBe(200);
	});

	test('it is out of sight but not out of the page', async ({ page }) => {
		expect(await page.evaluate(() => document.getElementById('skip').getBoundingClientRect().width)).toBeLessThanOrEqual(1);
		expect(await style(page, '#skip', 'position')).toBe('absolute');
		expect(await style(page, '#skip', 'clipPath')).toBe('inset(50%)');
		// Clipped, not hidden: display: none and visibility: hidden would both
		// take the link out of the accessibility tree and out of Tab order,
		// which is the one thing a skip link cannot afford.
		expect(await page.locator('#skip').isVisible()).toBe(true);
	});

	test('the first Tab pins it to the top start corner with the focus ring', async ({ page, browserName }) => {
		// WebKit leaves links out of Tab order unless full keyboard access is
		// on; Alt+Tab is how nav.spec.js and dropdown.spec.js reach a link there.
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
		expect(await page.evaluate(() => document.activeElement.id)).toBe('skip');
		const gap = await token(page, '--yeti-space-sm');
		const box = await page.evaluate(() => { const r = document.getElementById('skip').getBoundingClientRect(); return { top: r.top, left: r.left, width: r.width }; });
		expect(box.top).toBeCloseTo(gap, 0);
		expect(box.left).toBeCloseTo(gap, 0);
		expect(box.width).toBeGreaterThan(40);
		expect(await style(page, '#skip', 'position')).toBe('fixed');
		expect(await style(page, '#skip', 'backgroundColor')).toBe(await colour(page, '--yeti-color-surface-raised'));
		expect(await style(page, '#skip', 'outlineStyle')).toBe('solid');
		expect(await px(page, '#skip', 'outlineWidth')).toBe(2);
		// Above the sticky bars at 2 and the affixed controls at 1.
		expect(await style(page, '#skip', 'zIndex')).toBe('3');
	});

	test('a link that is not the body\'s first child is an ordinary link', async ({ page }) => {
		expect(await style(page, '#second', 'position')).toBe('static');
		expect(await page.evaluate(() => document.getElementById('second').getBoundingClientRect().width)).toBeGreaterThan(1);
	});

	test('the element after it starts at the top of the page', async ({ page }) => {
		// The link is absolutely positioned and takes no room, but it is still
		// the preceding sibling the prose rhythm counts, so without a rule
		// there would be a whole gap above the first visible element.
		const [body, header] = await Promise.all([rect(page, 'body'), rect(page, 'header')]);
		expect(header.top).toBeCloseTo(body.top, 0);
		expect(await px(page, 'header', 'margin-top')).toBe(0);
	});

	test('has no accessibility violations', async ({ page }) => {
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	});
});

test.describe('base scroll padding', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 700 });
		const response = await page.goto('/test/browser/fixtures/base-jump.html');
		expect(response.status()).toBe(200);
	});

	test('a fragment jump stops the heading a sticky offset below the top', async ({ page }) => {
		const offset = await token(page, '--yeti-sticky-offset');
		await page.evaluate(() => { location.hash = '#two'; });
		// A scroll landing is measured in device pixels: at a ratio of 2 (the WebKit project) half a CSS pixel is one step, so within a pixel is the test.
		await expect.poll(async () => Math.abs((await rect(page, '#two')).top - offset), { timeout: 2000 }).toBeLessThanOrEqual(1);
	});

	test('the offset is the bar\'s height when a page sets it, so the heading lands under the bar\'s edge', async ({ page }) => {
		await page.addStyleTag({ content: 'html { --yeti-sticky-offset: 48px; }' });
		await page.evaluate(() => { location.hash = '#three'; });
		// A scroll landing is measured in device pixels: at a ratio of 2 (the WebKit project) half a CSS pixel is one step, so within a pixel is the test.
		await expect.poll(async () => Math.abs((await rect(page, '#three')).top - (await rect(page, '#bar')).bottom), { timeout: 2000 }).toBeLessThanOrEqual(1);
		// Falsification: the bar is really pinned at the top while the page is scrolled this far.
		expect((await rect(page, '#bar')).top).toBeCloseTo(0, 0);
	});

	test('--yeti-scroll-padding sets the stop on its own, leaving sticky things where they were', async ({ page }) => {
		await page.addStyleTag({ content: 'html { --yeti-scroll-padding: 80px; }' });
		await page.evaluate(() => { location.hash = '#two'; });
		// A scroll landing is measured in device pixels: at a ratio of 2 (the WebKit project) half a CSS pixel is one step, so within a pixel is the test.
		await expect.poll(async () => Math.abs((await rect(page, '#two')).top - 80), { timeout: 2000 }).toBeLessThanOrEqual(1);
		// The bar reads the sticky offset, not this token: it stays on the edge.
		expect((await rect(page, '#bar')).top).toBeCloseTo(0, 0);
	});
});
