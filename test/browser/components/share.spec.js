import { test, expect } from 'playwright/test';
import { withoutModule } from '../lib/layout.js';

// The share button: data-action="share" opens the browser's share sheet,
// and where the browser has none it copies the link instead.
//
// A test cannot open a real share sheet, and of the three engines only
// WebKit has one. So every test but the last puts its own navigator.share in
// place, a recorder or nothing at all, and the same tests then mean the same
// thing in every engine. The clipboard is a recorder too, as in copy.spec.js.
const PAGE = { title: 'Share button fixture', url: 'https://example.com/canonical-page' };

const open = async (page, { clock = false } = {}) => {
	// A paused clock, not just an installed one: see copy.spec.js.
	if (clock) await page.clock.install();
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const response = await page.goto('/test/browser/fixtures/components/share.html');
	expect(response.status()).toBe(200);
	if (clock) await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
	await page.evaluate(() => {
		window.__events = [];
		for (const name of ['yeti:share', 'yeti:copy']) {
			document.addEventListener(name, (event) => window.__events.push(`${name} ${event.target.id}`));
		}
		window.__written = [];
		const writeText = (text) => { window.__written.push(text); return Promise.resolve(); };
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
	});
	return errors;
};
// A share sheet that records what it was given and settles at once: made,
// or, when asked, dismissed, which the browser reports as an AbortError.
const sheet = (page, { dismiss = false } = {}) => page.evaluate((abort) => {
	window.__shared = [];
	const share = (data) => {
		window.__shared.push(data);
		return abort ? Promise.reject(new DOMException('Share canceled', 'AbortError')) : Promise.resolve();
	};
	Object.defineProperty(navigator, 'share', { configurable: true, value: share });
}, dismiss);
// A browser with no share sheet, whatever the engine really has.
const noSheet = (page) => page.evaluate(() => {
	window.__shared = [];
	Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
});
const shared = (page) => page.evaluate(() => window.__shared);
const written = (page) => page.evaluate(() => window.__written);
const events = (page) => page.evaluate(() => window.__events);
const text = (page, id) => page.evaluate((i) => document.getElementById(i).textContent, id);
const turn = (page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
const origin = (page) => page.evaluate(() => location.origin);

test.describe('share button, with a share sheet', () => {
	test('a click shares the page by its canonical link and its title', async ({ page }) => {
		await open(page);
		await sheet(page);
		await page.click('#plain');
		await expect.poll(() => shared(page)).toEqual([PAGE]);
		await turn(page);
		expect(await written(page)).toEqual([]);
	});

	test('a page with no canonical link is shared by its own address', async ({ page }) => {
		await open(page);
		await sheet(page);
		await page.evaluate(() => document.querySelector('link[rel="canonical"]').remove());
		await page.click('#plain');
		await expect.poll(() => shared(page)).toEqual([{ title: PAGE.title, url: `${await origin(page)}/test/browser/fixtures/components/share.html` }]);
	});

	test('data-target shares the link it names, by its address and its text', async ({ page }) => {
		await open(page);
		await sheet(page);
		await page.click('#link');
		await expect.poll(() => shared(page)).toEqual([{ title: 'Article one', url: `${await origin(page)}/articles/one` }]);
	});

	test('yeti:share fires once on the button and reaches the document, and yeti:copy does not fire', async ({ page }) => {
		await open(page);
		await sheet(page);
		await page.evaluate(() => {
			window.__own = 0;
			document.getElementById('plain').addEventListener('yeti:share', () => { window.__own += 1; });
		});
		await page.click('#plain');
		await expect.poll(() => events(page)).toEqual(['yeti:share plain']);
		await turn(page);
		expect(await events(page)).toEqual(['yeti:share plain']);
		expect(await page.evaluate(() => window.__own)).toBe(1);
	});

	test('data-done does not show after a share: the sheet was the sign', async ({ page }) => {
		await open(page);
		await sheet(page);
		await page.click('#labelled');
		await expect.poll(() => events(page)).toEqual(['yeti:share labelled']);
		await turn(page);
		expect(await text(page, 'labelled')).toBe('Share this page');
		expect(await written(page)).toEqual([]);
	});

	test('a sheet the visitor dismisses fires nothing, copies nothing and throws nothing', async ({ page }) => {
		const errors = await open(page);
		await sheet(page, { dismiss: true });
		await page.click('#labelled');
		await expect.poll(() => shared(page)).toEqual([PAGE]);
		await turn(page);
		expect(await events(page)).toEqual([]);
		expect(await written(page)).toEqual([]);
		expect(await text(page, 'labelled')).toBe('Share this page');
		expect(errors).toEqual([]);
	});

	test('a data-target that names no element, or one that is not a link, shares nothing', async ({ page }) => {
		const errors = await open(page);
		await sheet(page);
		await page.click('#missing');
		await page.click('#not-a-link');
		await turn(page);
		expect(await shared(page)).toEqual([]);
		expect(await written(page)).toEqual([]);
		expect(await events(page)).toEqual([]);
		expect(errors).toEqual([]);
	});

	test('a button with aria-disabled="true" does not share', async ({ page }) => {
		const errors = await open(page);
		await sheet(page);
		await page.click('#inert', { force: true });
		await turn(page);
		expect(await shared(page)).toEqual([]);
		expect(await events(page)).toEqual([]);
		expect(errors).toEqual([]);
	});

	test('a share button added after load shares too', async ({ page }) => {
		await open(page);
		await sheet(page);
		await page.evaluate(() => {
			const button = document.createElement('button');
			button.className = 'button';
			button.type = 'button';
			button.id = 'late';
			button.dataset.action = 'share';
			button.textContent = 'Share late';
			document.querySelector('main').append(button);
		});
		await page.click('#late');
		await expect.poll(() => shared(page)).toEqual([PAGE]);
	});
});

test.describe('share button, with no share sheet', () => {
	test('a click copies the page link, and yeti:copy fires in place of yeti:share', async ({ page }) => {
		await open(page);
		await noSheet(page);
		await page.click('#plain');
		await expect.poll(() => written(page)).toEqual([PAGE.url]);
		await expect.poll(() => events(page)).toEqual(['yeti:copy plain']);
		await turn(page);
		expect(await events(page)).toEqual(['yeti:copy plain']);
		expect(await text(page, 'plain')).toBe('Share');
	});

	test('data-target copies the address of the link it names', async ({ page }) => {
		await open(page);
		await noSheet(page);
		await page.click('#link');
		await expect.poll(() => written(page)).toEqual([`${await origin(page)}/articles/one`]);
	});

	test('data-done shows its label once the link is copied and the original comes back', async ({ page }) => {
		await open(page, { clock: true });
		await noSheet(page);
		await page.click('#labelled');
		await expect.poll(() => text(page, 'labelled')).toBe('Link copied');
		await page.clock.fastForward(1900);
		expect(await text(page, 'labelled')).toBe('Link copied');
		await page.clock.fastForward(200);
		expect(await text(page, 'labelled')).toBe('Share this page');
	});

	test('a data-target that names no element, or one that is not a link, copies nothing', async ({ page }) => {
		const errors = await open(page);
		await noSheet(page);
		await page.click('#missing');
		await page.click('#not-a-link');
		await turn(page);
		expect(await written(page)).toEqual([]);
		expect(await events(page)).toEqual([]);
		expect(await text(page, 'missing')).toBe('Share nothing');
		expect(errors).toEqual([]);
	});

	// The one test that leaves navigator.share alone. Chromium and Firefox
	// have none here; WebKit has a real one, which a test cannot drive.
	test('an engine that has no share sheet of its own copies the link', async ({ page }) => {
		await open(page);
		test.skip(await page.evaluate(() => typeof navigator.share === 'function'), 'this engine has a share sheet');
		await page.click('#labelled');
		await expect.poll(() => written(page)).toEqual([PAGE.url]);
		await expect.poll(() => text(page, 'labelled')).toBe('Link copied');
	});
});

test.describe('button actions', () => {
	// Written here, not in the fixture: the validator knows only Yeti's own
	// two values and would report these. The inherited names are the ones a
	// lookup on a plain object would wrongly find.
	test('an action the module does not know does nothing and throws nothing', async ({ page }) => {
		const errors = await open(page);
		await sheet(page);
		await page.evaluate(() => {
			for (const action of ['print', 'constructor', '__proto__', 'click->gallery#next']) {
				const button = document.createElement('button');
				button.className = 'button';
				button.type = 'button';
				button.dataset.action = action;
				button.dataset.done = 'Done';
				button.textContent = 'Other';
				document.querySelector('main').append(button);
			}
		});
		for (const button of await page.locator('main > button[data-action]').all()) await button.click();
		await turn(page);
		expect(await page.locator('main > button[data-action]').count()).toBe(4);
		expect(await shared(page)).toEqual([]);
		expect(await written(page)).toEqual([]);
		expect(await events(page)).toEqual([]);
		expect(await page.locator('main > button[data-action]').allTextContents()).toEqual(['Other', 'Other', 'Other', 'Other']);
		expect(errors).toEqual([]);
	});

	test('without the module a share button does nothing and throws nothing', async ({ page }) => {
		await withoutModule(page, 'button');
		const errors = await open(page);
		await sheet(page);
		await page.click('#labelled');
		await turn(page);
		expect(await shared(page)).toEqual([]);
		expect(await written(page)).toEqual([]);
		expect(await events(page)).toEqual([]);
		expect(errors).toEqual([]);
	});
});
