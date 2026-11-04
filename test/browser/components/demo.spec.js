import { test, expect } from 'playwright/test';
import { stage, rect, style, px, token, axe, painted, withoutModule } from '../lib/layout.js';

const open = async (page, width = 1000) => {
	const response = await page.goto('/test/browser/fixtures/components/demo.html');
	expect(response.status()).toBe(200);
	await stage(page, width);
	await painted(page);
};
// Drag the grip the module puts on the box's end edge. The fixture stacks
// several boxes, so a lower one's grip can sit below the viewport; scrolling
// it into view first keeps the drag on-screen.
const gripOf = (selector) => `${selector} ~ [role="separator"]`;
const dragGrip = async (page, selector, dx) => {
	const grip = gripOf(selector);
	await page.locator(grip).scrollIntoViewIfNeeded();
	const r = await rect(page, grip);
	const x = r.left + r.width / 2;
	const y = r.top + r.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx, y, { steps: 10 });
	await page.mouse.up();
};
// The box is box-sizing: content-box, so its rect is bigger than the width
// and height tokens by the border and (on direct markup) the inset padding;
// this reads the content box those tokens actually name.
const content = async (page, sel) => {
	const r = await rect(page, sel);
	// The inset is not symmetric: a direct box has none at the top, where the bar is.
	const [b, pi, pt, pb] = await Promise.all([px(page, sel, 'border-left-width'), px(page, sel, 'padding-left'), px(page, sel, 'padding-top'), px(page, sel, 'padding-bottom')]);
	return { width: r.width - 2 * (b + pi), height: r.height - 2 * b - pt - pb };
};

// WebKit on Linux, which is what CI runs, does not resize a box from a
// synthetic pointer on the browser's own corner: the drag lands and nothing
// moves. Only the height drag uses that corner now, and it is skipped there.
const dragless = ({ browserName }) => browserName === 'webkit' && process.platform === 'linux';

test.describe('demo', () => {
	test('the preview is a size container the reader can drag narrower', async ({ page }) => {
		await open(page);
		expect(await style(page, '#framed-preview', 'container-type')).toBe('inline-size');
		const before = await rect(page, '#framed-preview');
		await dragGrip(page, '#framed-preview', -300);
		const after = await rect(page, '#framed-preview');
		expect(after.width).toBeLessThan(before.width - 250);
	});

	test('the frame fills the box and follows it', async ({ page }) => {
		await open(page);
		await dragGrip(page, '#framed-preview', -300);
		const [box, frame, boxRect] = await Promise.all([content(page, '#framed-preview'), rect(page, '#frame'), rect(page, '#framed-preview')]);
		expect(frame.width).toBeCloseTo(box.width, 0);
		// The bar takes the first row, so the frame is the content box less the
		// bar's height, and its bottom edge is the box's bottom edge.
		expect(frame.height).toBeLessThan(box.height);
		expect(frame.height).toBeGreaterThan(box.height - 80);
		expect(frame.bottom).toBeCloseTo(boxRect.bottom - (boxRect.height - box.height) / 2, 0);
		expect(await style(page, '#frame', 'border-top-width')).toBe('0px');
	});

	test('the bar names the example from the marker and stays put when the content scrolls', async ({ page }) => {
		await open(page);
		const bar = (id) => page.evaluate((i) => {
			const cs = getComputedStyle(document.getElementById(i), '::before');
			return { content: cs.content.replace(/"/g, ''), position: cs.position };
		}, id);
		expect(await bar('framed-preview')).toEqual({ content: 'Card', position: 'sticky' });
		expect((await bar('direct-preview')).content).toBe('Direct card');
	});

	test('data-resize="both" lets the reader drag the box taller, but not shorter than the sm height', async ({ page, browserName }) => {
		test.skip(dragless({ browserName }), 'Linux WebKit ignores a drag on the resize grip');
		await open(page);
		expect(await style(page, '#tall-preview', 'resize')).toBe('vertical');
		// The xl box is taller than the default viewport, and Firefox loses a drag
		// that leaves the viewport, so make room for the box and the drag below it.
		await page.setViewportSize({ width: 1280, height: 1100 });
		await page.evaluate(() => document.getElementById('tall-preview').scrollIntoView({ block: 'start' }));
		const before = await content(page, '#tall-preview');
		const grip = await rect(page, '#tall-preview');
		await page.mouse.move(grip.right - 4, grip.bottom - 4);
		await page.mouse.down();
		await page.mouse.move(grip.right - 4, grip.bottom + 150, { steps: 10 });
		await page.mouse.up();
		expect((await content(page, '#tall-preview')).height).toBeGreaterThan(before.height + 100);
		await page.evaluate(() => { document.getElementById('tall-preview').style.blockSize = '40px'; });
		expect((await content(page, '#tall-preview')).height).toBeCloseTo(await token(page, '--yeti-height-sm'), 0);
	});

	test('a direct card changes shape as the box is dragged below md', async ({ page }) => {
		await open(page);
		// At lg the card is a row: the picture is a fraction of its width.
		const wide = await Promise.all([rect(page, '#direct-card'), rect(page, '#direct-img')]);
		expect(wide[1].width).toBeLessThan(wide[0].width * 0.6);
		const boxBefore = await rect(page, '#direct-preview');
		await dragGrip(page, '#direct-preview', -(boxBefore.width - 300));
		await painted(page);
		// Below md the card stacks: the picture spans the card's width.
		const narrow = await Promise.all([rect(page, '#direct-card'), rect(page, '#direct-img')]);
		expect(narrow[1].width).toBeGreaterThan(narrow[0].width * 0.9);
	});

	test('data-width sets the starting width; without it the box is full width', async ({ page }) => {
		await open(page);
		expect((await content(page, '#narrow-preview')).width).toBeCloseTo(await token(page, '--yeti-width-sm'), 0);
		expect((await content(page, '#direct-preview')).width).toBeCloseTo(await token(page, '--yeti-width-lg'), 0);
		const [stageBox, framed, border] = await Promise.all([rect(page, '#stage'), content(page, '#framed-preview'), px(page, '#framed-preview', 'border-left-width')]);
		expect(framed.width).toBeCloseTo(stageBox.width - 2 * border, 0);
	});

	test('the box never overhangs a container narrower than xs', async ({ page }) => {
		await open(page);
		await stage(page, 200);
		// #framed-preview has no padding, only the border term of --_yeti-demo-max;
		// #direct-preview is direct markup, so it also carries the inset term.
		const [stageBox, framed, direct] = await Promise.all([rect(page, '#stage'), rect(page, '#framed-preview'), rect(page, '#direct-preview')]);
		expect(framed.width).toBeLessThanOrEqual(stageBox.width);
		expect(direct.width).toBeLessThanOrEqual(stageBox.width);
	});

	test('data-height picks the box height and md is the default', async ({ page }) => {
		await open(page);
		for (const [id, name] of [['#narrow-preview', 'sm'], ['#framed-preview', 'md'], ['#mid-preview', 'lg'], ['#tall-preview', 'xl']]) {
			expect((await content(page, id)).height, id).toBeCloseTo(await token(page, `--yeti-height-${name}`), 0);
		}
	});

	test('a demo inside an element with data-width keeps its own width', async ({ page }) => {
		await open(page);
		// Every [data-width] sets the shared private token and custom properties
		// inherit, so without a reset the box would take the ancestor's 16rem.
		const [box, ancestor] = await Promise.all([rect(page, '#inherited-preview'), rect(page, '#narrow-ancestor')]);
		expect(box.width).toBeCloseTo(ancestor.width, 0);
		expect(box.width).toBeGreaterThan(await token(page, '--yeti-width-xs') + 100);
	});

	test('the code is a details that opens', async ({ page }) => {
		await open(page);
		expect(await page.evaluate(() => document.getElementById('framed-code').open)).toBe(false);
		expect((await page.textContent('#framed-code summary')).trim()).toBe('View Code');
		await page.click('#framed-code summary');
		expect(await page.evaluate(() => document.getElementById('framed-code').open)).toBe(true);
		expect((await rect(page, '#framed-code pre')).height).toBeGreaterThan(0);
	});

	test('the module fills an empty frame from the code under the box, linking the page\'s own stylesheet', async ({ page }) => {
		await open(page);
		await page.waitForFunction(() => document.getElementById('scripted-frame').hasAttribute('srcdoc'));
		const srcdoc = await page.getAttribute('#scripted-frame', 'srcdoc');
		expect(srcdoc).toContain('<link rel="stylesheet" href="http://localhost:4173/src/yeti.css">');
		expect(srcdoc).toContain('<base href="http://localhost:4173/src/">');
		expect(srcdoc).toContain('<script type="module" src="http://localhost:4173/src/yeti.js"></script>');
		expect(srcdoc).toContain('<article class="card"><h2>From the pre</h2>');
		// The framed document really holds the example and the stylesheet link.
		await page.waitForFunction(() => document.getElementById('scripted-frame').contentDocument?.querySelector('.card'));
		const rendered = await page.evaluate(() => {
			const doc = document.getElementById('scripted-frame').contentDocument;
			return { card: !!doc.querySelector('.card'), styled: !!doc.querySelector('link[href$="yeti.css"]') };
		});
		expect(rendered).toEqual({ card: true, styled: true });
	});

	test('the module makes the frame for an empty box, titled from the marker, honouring data-stylesheet', async ({ page }) => {
		await open(page);
		await page.waitForFunction(() => document.querySelector('#created-box > iframe[srcdoc]'));
		expect(await page.getAttribute('#created-box > iframe', 'title')).toBe('Created, live');
		expect(await page.getAttribute('#created-box > iframe', 'srcdoc')).toContain('<link rel="stylesheet" href="/src/yeti.css">');
	});

	test('the module leaves a filled frame and direct markup alone', async ({ page }) => {
		await open(page);
		await page.waitForFunction(() => document.getElementById('scripted-frame').hasAttribute('srcdoc'));
		expect(await page.getAttribute('#frame', 'srcdoc')).toContain('Inside an iframe.');
		expect(await page.evaluate(() => document.querySelector('#direct-preview > iframe'))).toBeNull();
	});

	test('without the module the code still shows and the box stays empty', async ({ page }) => {
		await withoutModule(page, 'demo');
		await open(page);
		expect(await page.getAttribute('#scripted-frame', 'srcdoc')).toBeNull();
		// No grip either: the browser's own corner resizes the width.
		expect(await page.locator('.demo [role="separator"]').count()).toBe(0);
		expect(await style(page, '#direct-preview', 'resize')).toBe('horizontal');
		expect(await style(page, '#tall-preview', 'resize')).toBe('both');
		expect(await page.evaluate(() => document.getElementById('created-box').childElementCount)).toBe(0);
		await page.click('#scripted summary');
		expect((await rect(page, '#scripted-code')).height).toBeGreaterThan(0);
	});

	test('has no accessibility violations, code closed and open', async ({ page }) => {
		await open(page);
		expect(await axe(page)).toEqual([]);
		await page.click('#framed-code summary');
		expect(await axe(page)).toEqual([]);
	});

	// The label is a pseudo-element, so its content is read from there.
	const label = (page, id) => page.evaluate(
		(i) => getComputedStyle(document.getElementById(i), '::after').content.replace(/"/g, ''),
		id,
	);

	test('the label names the width stop the box is at and follows a drag', async ({ page }) => {
		await open(page, 1400);
		// The stage is wider than the default 1280px viewport, so the grip on
		// the box's end edge would sit off-screen and undraggable; widen the
		// viewport to fit the whole box before reading and dragging it.
		await page.setViewportSize({ width: 1500, height: 900 });
		// Full width at 1400px is past 2xl (80rem = 1280px).
		expect(await label(page, 'framed-preview')).toBe('2xl');
		const r = await rect(page, '#framed-preview');
		await dragGrip(page, '#framed-preview', -(r.width - 400));
		await painted(page);
		// 400px is 25rem: at or above sm (24rem), below md (32rem).
		expect(await label(page, 'framed-preview')).toBe('sm');
	});

	test('the label flips exactly at the width defaults, not near them', async ({ page }) => {
		await open(page);
		// Set the box to one pixel either side of md (32rem = 512px) and read.
		const at = async (px) => {
			await page.evaluate((w) => { document.getElementById('framed-preview').style.inlineSize = `${w}px`; }, px);
			await painted(page);
			return label(page, 'framed-preview');
		};
		expect(await at(511)).toBe('sm');
		expect(await at(512)).toBe('md');
		expect(await at(767)).toBe('md');
		expect(await at(768)).toBe('lg');
	});

	test('a box narrower than sm reads xs, and data-width="sm" reads sm at rest', async ({ page }) => {
		await open(page);
		expect(await label(page, 'narrow-preview')).toBe('sm');
		await page.evaluate(() => { document.getElementById('narrow-preview').style.inlineSize = '300px'; });
		await painted(page);
		expect(await label(page, 'narrow-preview')).toBe('xs');
	});

	// The grip. Its logic (drag clamping, stepping, stop names) is unit-tested
	// in test/tools/demo.test.js; these check the wiring's end states.
	const width = async (page, sel) => (await content(page, sel)).width;
	const attrs = (page, sel) => page.evaluate((s) => {
		const el = document.querySelector(s);
		return Object.fromEntries(['aria-orientation', 'aria-label', 'tabindex', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'].map((a) => [a, el.getAttribute(a)]));
	}, sel);

	test('every box gets one grip, a separator named from the marker and valued in pixels', async ({ page }) => {
		await open(page);
		const counts = await page.evaluate(() => [...document.querySelectorAll('.demo')].map((f) => f.querySelectorAll(':scope > [role="separator"]').length));
		expect(counts.every((n) => n === 1)).toBe(true);
		// The module writes the values from a ResizeObserver, which runs at the
		// next rendering step, so they are polled until they land, the end state.
		const lg = await token(page, '--yeti-width-lg');
		await expect.poll(async () => Number((await attrs(page, gripOf('#direct-preview')))['aria-valuenow'])).toBeCloseTo(lg, 0);
		const a = await attrs(page, gripOf('#direct-preview'));
		expect(a['aria-orientation']).toBe('vertical');
		expect(a['aria-label']).toBe('Resize Direct card');
		expect(a.tabindex).toBe('0');
		expect(Number(a['aria-valuemin'])).toBeCloseTo(await token(page, '--yeti-width-xs'), 0);
		expect(Number(a['aria-valuemax'])).toBeGreaterThan(lg);
		expect(a['aria-valuetext']).toBe(`lg, ${Math.round(lg)} pixels`);
	});

	test('the grip sits on the box\'s end edge, centred on its height', async ({ page }) => {
		await open(page);
		// The module places the grip from a ResizeObserver, which runs at the
		// next rendering step, and open() narrows the stage just before this
		// reads; so the reading is polled until it lands, the end state.
		for (const id of ['#direct-preview', '#framed-preview', '#mid-preview']) {
			const offset = async () => {
				const [box, grip] = await Promise.all([rect(page, id), rect(page, gripOf(id))]);
				return [Math.abs(Math.round(grip.left + grip.width / 2 - box.right)), Math.abs(Math.round(grip.top + grip.height / 2 - (box.top + box.height / 2)))];
			};
			await expect.poll(offset, { message: id }).toEqual([0, 0]);
		}
	});

	test('a page may put its own things between the box and the grip, as the docs site does', async ({ page }) => {
		await open(page);
		// The docs site inserts its attribute controls right after the box,
		// once the grip is already there.
		await page.evaluate(() => {
			const strip = document.createElement('div');
			strip.id = 'strip';
			strip.style.blockSize = '3rem';
			document.querySelector('#direct-preview').after(strip);
		});
		const offset = async () => {
			const [box, grip] = await Promise.all([rect(page, '#direct-preview'), rect(page, gripOf('#direct-preview'))]);
			return [Math.abs(Math.round(grip.left + grip.width / 2 - box.right)), Math.abs(Math.round(grip.top + grip.height / 2 - (box.top + box.height / 2))), grip.width > 0];
		};
		await expect.poll(offset).toEqual([0, 0, true]);
		// The strip stays in the flow, under the box.
		const [box, strip] = await Promise.all([rect(page, '#direct-preview'), rect(page, '#strip')]);
		expect(strip.top).toBeGreaterThanOrEqual(box.bottom - 1);
	});

	test('a box with the grip leaves the width to it', async ({ page }) => {
		await open(page);
		expect(await style(page, '#direct-preview', 'resize')).toBe('none');
		expect(await style(page, '#tall-preview', 'resize')).toBe('vertical');
	});

	test('dragging the grip moves the box\'s edge by the travel, and the label and value follow', async ({ page }) => {
		await open(page);
		const before = await width(page, '#direct-preview');
		await dragGrip(page, '#direct-preview', -300);
		const after = await width(page, '#direct-preview');
		expect(Math.abs(after - (before - 300))).toBeLessThanOrEqual(1);
		// 768 - 300 = 468px, which is at or above sm (384) and below md (512).
		expect(await label(page, 'direct-preview')).toBe('sm');
		expect((await attrs(page, gripOf('#direct-preview')))['aria-valuetext']).toBe(`sm, ${Math.round(after)} pixels`);
		// The grip went with the edge.
		const [box, grip] = await Promise.all([rect(page, '#direct-preview'), rect(page, gripOf('#direct-preview'))]);
		expect(grip.left + grip.width / 2).toBeCloseTo(box.right, 0);
	});

	test('dragging the grip of a framed box works, and the wheel scrolls the frame after', async ({ page }) => {
		await open(page);
		await page.evaluate(() => { document.querySelector('#frame').srcdoc = `<body style="margin:0">${'<p>line</p>'.repeat(200)}`; });
		await page.waitForFunction(() => document.querySelector('#frame').contentDocument?.body?.childElementCount > 100);
		const before = await width(page, '#framed-preview');
		// The drag passes over the frame, which must not take it.
		await dragGrip(page, '#framed-preview', -200);
		expect(Math.abs(await width(page, '#framed-preview') - (before - 200))).toBeLessThanOrEqual(1);
		// Chromium sent the wheel to the page, not the frame, after a drag
		// that turned the frame's pointer-events off and on again.
		const box = await rect(page, '#framed-preview');
		await page.mouse.move(box.left + 100, box.top + box.height / 2);
		await page.mouse.wheel(0, 300);
		await expect.poll(() => page.evaluate(() => document.querySelector('#frame').contentWindow.scrollY)).toBeGreaterThan(0);
	});

	test('arrow keys step between width stops; Home and End reach the min and the max', async ({ page }) => {
		await open(page);
		const md = await token(page, '--yeti-width-md');
		await page.evaluate((w) => { document.getElementById('framed-preview').style.inlineSize = `${w}px`; }, md);
		const grip = gripOf('#framed-preview');
		await page.focus(grip);
		await page.keyboard.press('ArrowRight');
		expect(await width(page, '#framed-preview')).toBeCloseTo(await token(page, '--yeti-width-lg'), 0);
		expect((await attrs(page, grip))['aria-valuetext']).toMatch(/^lg, /);
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		expect(await width(page, '#framed-preview')).toBeCloseTo(await token(page, '--yeti-width-sm'), 0);
		await page.keyboard.press('Home');
		expect(await width(page, '#framed-preview')).toBeCloseTo(await token(page, '--yeti-width-xs'), 0);
		await page.keyboard.press('End');
		const [stageBox, border] = await Promise.all([rect(page, '#stage'), px(page, '#framed-preview', 'border-left-width')]);
		expect(await width(page, '#framed-preview')).toBeCloseTo(stageBox.width - 2 * border, 0);
		expect(Number((await attrs(page, grip))['aria-valuenow'])).toBe(Math.round(stageBox.width - 2 * border));
	});

	// The one test that matters most in WebKit: Safari draws no resize corner
	// on the box at all, which is why the grip exists. In the all-engines run
	// this proves the grip is there and moves the box there too.
	test('the grip has a size and a key moves the box, in every engine', async ({ page }) => {
		await open(page);
		const grip = gripOf('#direct-preview');
		const r = await rect(page, grip);
		expect(r.width).toBeGreaterThan(0);
		expect(r.height).toBeGreaterThan(0);
		const before = await width(page, '#direct-preview');
		await page.focus(grip);
		await page.keyboard.press('ArrowLeft');
		expect(await width(page, '#direct-preview')).toBeCloseTo(await token(page, '--yeti-width-md'), 0);
		expect(await width(page, '#direct-preview')).toBeLessThan(before);
	});
});
