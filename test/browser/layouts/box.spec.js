import { test, expect } from 'playwright/test';
import { open, px, token, style, axe } from '../lib/layout.js';

test.describe('box', () => {
	test('padding equals the gap token', async ({ page }) => {
		await open(page, 'box');
		const md = await token(page, '--yeti-space-md');
		for (const side of ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']) {
			expect(await px(page, '#box', side)).toBeCloseTo(md, 1);
		}
		expect(await px(page, '#bordered', 'padding-top')).toBeCloseTo(await token(page, '--yeti-space-lg'), 1);
	});

	test('one axis can be padded over data-gap', async ({ page }) => {
		await open(page, 'box');
		const [sm, md, lg, xl] = await Promise.all(['sm', 'md', 'lg', 'xl'].map((s) => token(page, `--yeti-space-${s}`)));
		expect(await px(page, '#axes', 'padding-left')).toBeCloseTo(xl, 1);
		expect(await px(page, '#axes', 'padding-right')).toBeCloseTo(xl, 1);
		expect(await px(page, '#axes', 'padding-top')).toBeCloseTo(sm, 1);
		expect(await px(page, '#axes', 'padding-bottom')).toBeCloseTo(sm, 1);
		expect(await px(page, '#block-only', 'padding-top')).toBeCloseTo(lg, 1);
		expect(await px(page, '#block-only', 'padding-bottom')).toBeCloseTo(lg, 1);
		expect(await px(page, '#block-only', 'padding-left')).toBeCloseTo(md, 1);
		// Falsification: the two axes differ, so a shorthand did not leak across.
		expect(xl).not.toBeCloseTo(sm, 1);
	});

	test('data-border draws a one-pixel border', async ({ page }) => {
		await open(page, 'box');
		expect(await px(page, '#box', 'border-top-width')).toBe(0);
		expect(await px(page, '#bordered', 'border-top-width')).toBe(await token(page, '--yeti-border-width'));
	});

	test('a surface sets the page text, so its words read on it', async ({ page }) => {
		await open(page, 'box');
		// Text is inherited already resolved, so a box in a forced scheme would
		// paint the dark surface and keep the light page's dark words.
		const forced = await style(page, '#forced', 'color');
		expect(forced).toBe(await style(page, '#forced-text', 'color'));
		expect(forced).not.toBe(await style(page, 'body', 'color'));
		// On paint it must not keep the on-primary words meant for the paint.
		expect(await style(page, '#on-paint', 'color')).toBe(await style(page, 'body', 'color'));
	});

	test('data-surface fills the box from the matching token, and nothing fills it without one', async ({ page }) => {
		await open(page, 'box');
		// A box with no data-surface is transparent: the thing behind it shows
		// through, which is what makes it safe to put one inside a card. #box
		// is not the one to ask, because the fixture gives it an inline colour
		// from the days when a box had no other way to be seen.
		expect(await style(page, '#plain', 'background-color')).toBe('rgba(0, 0, 0, 0)');
		// Each value paints its own token. Resolved by painting the token on a
		// probe, because the tokens are authored in oklch and the computed
		// value comes back in whatever form the engine prefers.
		for (const [id, name] of [['#base-surface', '--yeti-color-surface'], ['#raised', '--yeti-color-surface-raised'], ['#sunken', '--yeti-color-surface-sunken']]) {
			const expected = await page.evaluate((n) => {
				const probe = document.createElement('div');
				probe.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
				document.body.append(probe);
				const got = getComputedStyle(probe).backgroundColor;
				probe.remove();
				return got;
			}, name);
			expect(await style(page, id, 'background-color')).toBe(expected);
		}
	});

	test('the three surfaces are visibly different from each other', async ({ page }) => {
		await open(page, 'box');
		const seen = [];
		for (const id of ['#base-surface', '#raised', '#sunken']) seen.push(await style(page, id, 'background-color'));
		expect(new Set(seen).size).toBe(3);
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page, 'box');
		expect(await axe(page)).toEqual([]);
	});
});
