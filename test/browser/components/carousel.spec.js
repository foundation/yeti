import { test, expect } from 'playwright/test';
import { stage, rect, style, token, axe, withoutModule } from '../lib/layout.js';

const open = async (page, width = 1000) => {
	const response = await page.goto('/test/browser/fixtures/components/carousel.html');
	expect(response.status()).toBe(200);
	await stage(page, width);
};
const scrollLeft = (page, id) => page.evaluate((i) => document.getElementById(i).scrollLeft, id);

test.describe('carousel', () => {
	test('data-gap="none" leaves a slide filling the track', async ({ page }) => {
		await open(page);
		await page.evaluate(() => document.getElementById('one').setAttribute('data-gap', 'none'));
		const [track, slide] = await Promise.all([rect(page, '#track'), rect(page, '#s1')]);
		expect(slide.width).toBeCloseTo(track.width, 0);
	});

	test('one slide fills the track and the track snaps', async ({ page }) => {
		await open(page);
		const [track, slide] = await Promise.all([rect(page, '#track'), rect(page, '#s1')]);
		expect(slide.width).toBeCloseTo(track.width, 0);
		expect(await style(page, '#track', 'scroll-snap-type')).toContain('mandatory');
		expect(await style(page, '#s1', 'scroll-snap-align')).toBe('start');
	});

	test('data-slides="2" halves each slide less the gap', async ({ page }) => {
		await open(page);
		const track = await rect(page, '#track-two');
		const gap = await token(page, '--yeti-space-md');
		expect((await rect(page, '#q1')).width).toBeCloseTo((track.width - gap) / 2, 0);
	});

	test('a dot scrolls to its slide', async ({ page }) => {
		await open(page);
		expect(await scrollLeft(page, 'track')).toBe(0);
		await page.click('#dot3');
		await expect.poll(async () => Math.round((await rect(page, '#s3')).left - (await rect(page, '#track')).left)).toBe(0);
	});

	test('under reduced motion the track does not animate its scrolling', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await open(page);
		expect(await style(page, '#track', 'scroll-behavior')).toBe('auto');
	});

	test('each dot is a named, pressable link', async ({ page }) => {
		await open(page);
		const size = await token(page, '--yeti-control-size');
		const dot = await rect(page, '#dot1');
		expect(dot.width).toBeCloseTo(size, 0);
		expect(dot.height).toBeCloseTo(size, 0);
		await expect(page.getByLabel('Slide 2')).toHaveAttribute('href', '#s2');
	});

	test('the track scrolls with no scrollbar showing', async ({ page }) => {
		await open(page);
		const track = await page.evaluate(() => {
			const el = document.getElementById('track');
			return { gutter: el.offsetHeight - el.clientHeight, scrollable: el.scrollWidth > el.clientWidth };
		});
		// The bar is hidden, but the track still scrolls: the one must not cost the other.
		// The gutter alone proves nothing on a system with overlay scrollbars, where
		// every scroller reports zero, so the computed property is what is asserted.
		expect(track.gutter).toBe(0);
		expect(track.scrollable).toBe(true);
		expect(await style(page, '#track', 'scrollbar-width')).toBe('none');
	});

	test('following a dot scrolls the track and leaves the history alone', async ({ page }) => {
		await open(page);
		const before = await page.evaluate(() => history.length);
		await page.click('#dot3');
		await page.waitForFunction(() => {
			const track = document.getElementById('track');
			return track.scrollLeft > 0 && Math.abs(track.scrollLeft - (document.getElementById('s3').getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft)) < 2;
		}, null, { timeout: 3000 });
		// The whole point: four slides looked at must not be four presses of back.
		expect(await page.evaluate(() => history.length)).toBe(before);
		expect(await page.evaluate(() => location.hash)).toBe('');
	});

	test('without the module a dot still reaches its slide', async ({ page }) => {
		await withoutModule(page, 'carousel');
		await open(page);
		await page.click('#dot3');
		await page.waitForFunction(() => document.getElementById('track').scrollLeft > 0, null, { timeout: 3000 });
		// The link is the fallback, so it navigates, and that is what costs the
		// history entry the module exists to avoid.
		expect(await page.evaluate(() => location.hash)).toBe('#s3');
	});

	test('two dots pressed in quick succession still land on a slide', async ({ page }) => {
		await open(page);
		// A relative scroll is resolved against the smooth scroll still in flight,
		// and WebKit then overshoots and does not re-snap, parking the track between
		// slides. The target has to be absolute.
		await page.click('#dot3');
		await page.click('#dot2');
		await page.waitForTimeout(1500);
		const offset = await page.evaluate(() => {
			const track = document.getElementById('track');
			return document.getElementById('s2').getBoundingClientRect().left - track.getBoundingClientRect().left;
		});
		expect(Math.abs(offset)).toBeLessThan(2);
	});

	test('in a right-to-left carousel a dot brings its slide to the start edge', async ({ page }) => {
		await open(page);
		// The slides snap to the start edge, which is the right edge here. A scroll
		// measured from the left edge would leave the dot's slide second in view.
		await page.click('#rtl-dot3');
		await page.waitForTimeout(1500);
		const offset = await page.evaluate(() => {
			const track = document.getElementById('track-three');
			return document.getElementById('r3').getBoundingClientRect().right - track.getBoundingClientRect().right;
		});
		expect(Math.abs(offset)).toBeLessThan(2);
	});

	test('a modified click is left to the browser', async ({ page }) => {
		await open(page);
		const opened = await page.evaluate(() => {
			const dot = document.getElementById('dot2');
			const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
			dot.dispatchEvent(event);
			return event.defaultPrevented;
		});
		expect(opened).toBe(false);
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page);
		expect(await axe(page)).toEqual([]);
	});

	test('following a dot dispatches yeti:slide with the slide and its index', async ({ page }) => {
		await open(page);
		// The listener is installed from script; the click is a real one, so the
		// module is driven the way a reader drives it.
		await page.evaluate(() => {
			window.caught = null;
			document.addEventListener('yeti:slide', (event) => {
				window.caught = {
					target: event.target.id,
					bubbles: event.bubbles,
					composed: event.composed,
					index: event.detail.index,
					slide: event.detail.slide.id,
				};
			}, { once: true });
		});
		await page.click('#dot3');
		expect(await page.evaluate(() => window.caught)).toEqual({ target: 'one', bubbles: true, composed: true, index: 2, slide: 's3' });
	});
});
