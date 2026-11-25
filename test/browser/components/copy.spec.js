import { test, expect } from 'playwright/test';
import { rect, withoutModule } from '../lib/layout.js';

// The copy button has its own spec and fixture rather than joining
// button.spec.js: that fixture is a page of faces checked for contrast and
// by axe, and these tests need the module loaded, a fake clock paused once
// the page has loaded, and a clipboard they can read back.
//
// Every test but one reads what was written from a recorder put in place of
// navigator.clipboard.writeText, because Firefox and WebKit will not let a
// test read the real clipboard. The one that does read it runs in Chromium,
// where the context can be granted the permission.
const open = async (page, { clock = false } = {}) => {
	// The two seconds the label shows are moved by hand. Installing the fake
	// clock before load makes the module's setTimeout a fake one, but an
	// installed clock still runs in real time; only a paused one stands still,
	// so every jump below is exactly the time the test names.
	if (clock) await page.clock.install();
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const response = await page.goto('/test/browser/fixtures/components/copy.html');
	expect(response.status()).toBe(200);
	if (clock) await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
	await page.evaluate(() => {
		window.__events = [];
		document.addEventListener('yeti:copy', (event) => window.__events.push(event.target.id));
	});
	return errors;
};
// Replaces the clipboard with one whose write records its argument and
// settles at once, resolving or, when asked, rejecting as a denied write does.
const record = (page, { reject = false } = {}) => page.evaluate((fail) => {
	window.__written = [];
	const writeText = (text) => {
		window.__written.push(text);
		return fail ? Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')) : Promise.resolve();
	};
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}, reject);
const written = (page) => page.evaluate(() => window.__written);
const events = (page) => page.evaluate(() => window.__events);
const text = (page, id) => page.evaluate((i) => document.getElementById(i).textContent, id);
// A write that fails rejects in a microtask, so one task later every outcome
// of the click is known. Real timers only: a paused clock would hold it.
const turn = (page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));

test.describe('copy button', () => {
	// Runs in all three engines.
	test('a click copies the text of the element data-copy names', async ({ page }) => {
		await open(page);
		await record(page);
		await page.click('#plain');
		await expect.poll(() => written(page)).toEqual(['npm install @foundation/yeti']);
	});

	test('the real clipboard holds the snippet after a click', async ({ page, browserName }) => {
		test.skip(browserName !== 'chromium', 'only Chromium lets a test read the clipboard');
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		await open(page);
		await page.click('#plain');
		await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('npm install @foundation/yeti');
	});

	test('trailing line breaks are dropped and every other space and break is kept', async ({ page }) => {
		await open(page);
		await record(page);
		await page.click('#copy-block');
		await expect.poll(() => written(page)).toEqual(['  first line\n    second line']);
	});

	test('an input and a textarea are copied by value, as typed', async ({ page }) => {
		await open(page);
		await record(page);
		await page.click('#copy-field');
		await page.click('#copy-area');
		await expect.poll(() => written(page)).toEqual(['from the value', 'from the area']);
		await page.fill('#field', 'typed later');
		await page.fill('#area', 'typed\nlater');
		await page.click('#copy-field');
		await page.click('#copy-area');
		await expect.poll(() => written(page)).toEqual(['from the value', 'from the area', 'typed later', 'typed\nlater']);
	});

	test('yeti:copy fires once on the button and reaches the document', async ({ page }) => {
		await open(page);
		await record(page);
		await page.evaluate(() => {
			window.__own = 0;
			document.getElementById('plain').addEventListener('yeti:copy', () => { window.__own += 1; });
		});
		await page.click('#plain');
		await expect.poll(() => events(page)).toEqual(['plain']);
		await turn(page);
		expect(await events(page)).toEqual(['plain']);
		expect(await page.evaluate(() => window.__own)).toBe(1);
	});

	test('data-copied shows its label after a copy and the original comes back', async ({ page }) => {
		await open(page, { clock: true });
		await record(page);
		await page.click('#labelled');
		await expect.poll(() => text(page, 'labelled')).toBe('Copied');
		await page.clock.fastForward(1900);
		expect(await text(page, 'labelled')).toBe('Copied');
		await page.clock.fastForward(200);
		expect(await text(page, 'labelled')).toBe('Copy snippet');
	});

	test('the very nodes the button held come back, not copies of them', async ({ page }) => {
		await open(page, { clock: true });
		await record(page);
		await page.evaluate(() => {
			window.__svg = document.querySelector('#icon > svg');
			window.__span = document.querySelector('#icon > span');
		});
		await page.click('#icon');
		await expect.poll(() => text(page, 'icon')).toBe('Copied');
		await page.clock.fastForward(2100);
		expect(await page.evaluate(() => {
			const button = document.getElementById('icon');
			return button.firstChild === window.__svg && button.lastChild === window.__span && button.childNodes.length === 2;
		})).toBe(true);
	});

	test('a second click restarts the two seconds and never keeps the label as the original', async ({ page }) => {
		await open(page, { clock: true });
		await record(page);
		await page.click('#labelled');
		await expect.poll(() => events(page)).toEqual(['labelled']);
		await page.clock.fastForward(1000);
		await page.click('#labelled');
		await expect.poll(() => events(page)).toEqual(['labelled', 'labelled']);
		expect(await written(page)).toEqual(['npm install @foundation/yeti', 'npm install @foundation/yeti']);
		// Two and a half seconds after the first click, one and a half after
		// the second: still the label.
		await page.clock.fastForward(1500);
		expect(await text(page, 'labelled')).toBe('Copied');
		await page.clock.fastForward(600);
		expect(await text(page, 'labelled')).toBe('Copy snippet');
	});

	test('the button keeps its width while a shorter label shows, and the inline size goes after', async ({ page }) => {
		await open(page, { clock: true });
		await record(page);
		const before = await rect(page, '#labelled');
		await page.click('#labelled');
		await expect.poll(() => text(page, 'labelled')).toBe('Copied');
		expect((await rect(page, '#labelled')).width).toBeGreaterThanOrEqual(before.width - 0.5);
		// The label alone would be narrower, or this test proves nothing.
		const bare = await page.evaluate(() => {
			const probe = document.getElementById('labelled').cloneNode(true);
			probe.removeAttribute('style');
			probe.removeAttribute('id');
			document.getElementById('labelled').after(probe);
			const width = probe.getBoundingClientRect().width;
			probe.remove();
			return width;
		});
		expect(bare).toBeLessThan(before.width - 1);
		await page.clock.fastForward(2100);
		expect(await text(page, 'labelled')).toBe('Copy snippet');
		expect(await page.evaluate(() => document.getElementById('labelled').style.minInlineSize)).toBe('');
		// The button had no style attribute, so it is left with none.
		expect(await page.evaluate(() => document.getElementById('labelled').getAttribute('style'))).toBeNull();
	});

	test('a button removed while its label shows throws nothing when the two seconds end', async ({ page }) => {
		const errors = await open(page, { clock: true });
		await record(page);
		await page.click('#labelled');
		await expect.poll(() => text(page, 'labelled')).toBe('Copied');
		await page.evaluate(() => { window.__removed = document.getElementById('labelled'); window.__removed.remove(); });
		await page.clock.fastForward(2100);
		expect(await page.evaluate(() => window.__removed.textContent)).toBe('Copy snippet');
		expect(errors).toEqual([]);
	});

	test('a button with aria-disabled="true" does not copy', async ({ page }) => {
		const errors = await open(page);
		await record(page);
		// Playwright waits for an aria-disabled element to become enabled, so
		// the click is forced, as a pointer would deliver it.
		await page.click('#inert', { force: true });
		await turn(page);
		expect(await written(page)).toEqual([]);
		expect(await events(page)).toEqual([]);
		expect(await text(page, 'inert')).toBe('Copy');
		expect(errors).toEqual([]);
	});

	test('a data-copy that names no element writes nothing and throws nothing', async ({ page }) => {
		const errors = await open(page);
		await record(page);
		await page.click('#missing');
		await turn(page);
		expect(await written(page)).toEqual([]);
		expect(await events(page)).toEqual([]);
		expect(await text(page, 'missing')).toBe('Copy nothing');
		expect(errors).toEqual([]);
	});

	test('a write the browser refuses changes nothing and throws nothing', async ({ page }) => {
		const errors = await open(page);
		await record(page, { reject: true });
		await page.click('#labelled');
		await turn(page);
		expect(await written(page)).toEqual(['npm install @foundation/yeti']);
		expect(await events(page)).toEqual([]);
		expect(await text(page, 'labelled')).toBe('Copy snippet');
		expect(errors).toEqual([]);
	});

	test('without data-copied the text is copied and the button is left as it was', async ({ page }) => {
		await open(page);
		await record(page);
		const node = await page.evaluate(() => { window.__label = document.getElementById('plain').firstChild; return document.getElementById('plain').innerHTML; });
		await page.click('#plain');
		await expect.poll(() => events(page)).toEqual(['plain']);
		expect(await written(page)).toEqual(['npm install @foundation/yeti']);
		expect(await page.evaluate(() => document.getElementById('plain').innerHTML)).toBe(node);
		expect(await page.evaluate(() => document.getElementById('plain').firstChild === window.__label)).toBe(true);
		expect(await page.evaluate(() => document.getElementById('plain').getAttribute('style'))).toBeNull();
	});

	test('a button added after load copies too', async ({ page }) => {
		await open(page);
		await record(page);
		await page.evaluate(() => {
			const button = document.createElement('button');
			button.className = 'button';
			button.type = 'button';
			button.id = 'late';
			button.dataset.copy = 'field';
			button.textContent = 'Copy late';
			document.querySelector('main').append(button);
		});
		await page.click('#late');
		await expect.poll(() => written(page)).toEqual(['from the value']);
		expect(await events(page)).toEqual(['late']);
	});

	test('without the module a click does nothing and throws nothing', async ({ page }) => {
		await withoutModule(page, 'copy');
		const errors = await open(page);
		await record(page);
		await page.click('#labelled');
		await turn(page);
		expect(await written(page)).toEqual([]);
		expect(await events(page)).toEqual([]);
		expect(await text(page, 'labelled')).toBe('Copy snippet');
		expect(errors).toEqual([]);
	});
});
