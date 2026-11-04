import fs from 'node:fs';
import { test, expect } from 'playwright/test';

// What each token collapses to under reduced motion. A reader's setting has to
// outrank a theme, so every one is checked against an override on :root, on an
// element and in a style attribute.
const collapsed = {
	'--yeti-duration-fast': '0.01ms',
	'--yeti-duration-base': '0.01ms',
	'--yeti-motion-iterations': '1',
	'--yeti-page-duration': '0.01ms',
	'--yeti-spinner-duration': '0.01ms',
	'--yeti-carousel-scroll': 'auto',
	'--yeti-toc-scroll': 'auto',
	'--yeti-enter-duration': '0.01ms',
	'--yeti-enter-stagger': '0s',
	'--yeti-enter-delay': '0s',
	'--yeti-attention-duration': '0.01ms',
	'--yeti-lift-duration': '0.01ms',
	'--yeti-lift-distance': '0rem',
	'--yeti-lift-scale': '1',
};
const overrides = Object.keys(collapsed).map((name) => `${name}: 7s;`).join(' ');

const open = async (page, reducedMotion) => {
	await page.emulateMedia({ reducedMotion });
	await page.goto('/test/browser/fixtures/base.html');
	await page.addStyleTag({ content: `:root { ${overrides} } .local { ${overrides} }` });
	await page.evaluate((style) => {
		document.body.insertAdjacentHTML('beforeend', `<div class="local" id="local"><button class="button" id="button">Save</button></div><p id="inline" style="${style}">Words</p>`);
	}, overrides);
};
const read = (page, id, name) => page.evaluate(([i, n]) => getComputedStyle(document.getElementById(i)).getPropertyValue(n).trim(), [id, name]);

test.describe('reduced motion', () => {
	test('every duration token in the catalogue is collapsed', () => {
		const tokens = JSON.parse(fs.readFileSync('src/tokens/tokens.json', 'utf8'));
		const names = (Array.isArray(tokens) ? tokens : tokens.tokens).map((t) => t.name).filter((n) => /-duration$/.test(n));
		expect(names.filter((n) => !(n in collapsed))).toEqual([]);
	});

	test('a token set anywhere cannot undo the reader\'s setting', async ({ page }) => {
		await open(page, 'reduce');
		for (const [name, value] of Object.entries(collapsed)) {
			expect(await read(page, 'local', name), `${name} on an element`).toBe(value);
			expect(await read(page, 'inline', name), `${name} in a style attribute`).toBe(value);
			expect(await page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name), `${name} on the root`).toBe(value);
		}
		expect(await page.evaluate(() => getComputedStyle(document.getElementById('button')).transitionDuration.split(',')[0])).toBe('1e-05s');
	});

	test('without the setting the same tokens take effect', async ({ page }) => {
		await open(page, 'no-preference');
		for (const name of Object.keys(collapsed)) expect(await read(page, 'local', name)).toBe('7s');
		expect(await page.evaluate(() => getComputedStyle(document.getElementById('button')).transitionDuration.split(',')[0])).toBe('7s');
	});
});
