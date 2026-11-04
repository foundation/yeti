import { test, expect } from 'playwright/test';
import { stage, rect, px, token, expectNoChildMargins, same, axe } from '../lib/layout.js';

const open = async (page, width = 1000) => {
	const response = await page.goto('/test/browser/fixtures/recipes/shell.html');
	expect(response.status()).toBe(200);
	await stage(page, width);
};

test.describe('shell recipe', () => {
	test('matches the composed form with the footer at the bottom of the viewport', async ({ page }) => {
		await open(page, 1000);
		const [c, p] = await Promise.all([rect(page, '#classed'), rect(page, '#composed')]);
		const height = await page.evaluate(() => window.innerHeight);
		expect(c.height).toBeCloseTo(height, 0);
		expect(p.height).toBeCloseTo(height, 0);
		for (const part of ['header', 'nav', 'main', 'footer']) {
			const [a, b] = await Promise.all([rect(page, `#c-${part}`), rect(page, `#p-${part}`)]);
			same(a, b, c, p);
		}
		const [footer, nav, main] = await Promise.all([rect(page, '#c-footer'), rect(page, '#c-nav'), rect(page, '#c-main')]);
		expect(footer.bottom).toBeCloseTo(c.bottom, 1);
		expect(nav.top).toBeCloseTo(main.top, 1);
		// flex-grow: 1 against main's 999 leaves nav a fraction of a pixel over its basis (see sidebar.spec.js).
		expect(Math.abs(nav.width - await token(page, '--yeti-width-sm'))).toBeLessThan(2);
	});

	test('a part with a layout class of its own keeps the shell\'s gap above it', async ({ page }) => {
		await open(page, 1000);
		await page.evaluate(() => {
			document.querySelector('#stage').insertAdjacentHTML('beforeend', `<div class="shell" data-gap="sm">
				<header>Header</header>
				<main id="gapped-main" class="stack" data-gap="2xl"><p>One</p><p>Two</p></main>
				<footer id="gapped-footer" class="stack"><p>Footer</p></footer>
			</div>`);
		});
		const sm = await token(page, '--yeti-space-sm');
		expect(await px(page, '#gapped-main', 'margin-top')).toBeCloseTo(sm, 1);
		expect(await px(page, '#gapped-footer', 'margin-top')).toBeCloseTo(sm, 1);
		// Falsification: main's own gap still spaces its children.
		expect(await px(page, '#gapped-main', 'row-gap')).toBeCloseTo(await token(page, '--yeti-space-2xl'), 1);
	});

	test('matches the composed form stacked', async ({ page }) => {
		await open(page, 400);
		const [c, p] = await Promise.all([rect(page, '#classed'), rect(page, '#composed')]);
		for (const part of ['header', 'nav', 'main', 'footer']) {
			const [a, b] = await Promise.all([rect(page, `#c-${part}`), rect(page, `#p-${part}`)]);
			same(a, b, c, p);
		}
		const [nav, main] = await Promise.all([rect(page, '#c-nav'), rect(page, '#c-main')]);
		expect(main.top).toBeGreaterThanOrEqual(nav.bottom);
	});

	test('three regions share the row, nav first and aside last, and stack when narrow', async ({ page }) => {
		// 1200, not 1000: with two data-width="xs" (256px) flanks plus the
		// md gap (18px) on both sides of main, main's own 50%-of-container
		// floor needs a container of at least 4*(256+18) = 1096px before all
		// three fit on one line (below that, main's floor alone forces a
		// wrap no matter how the flanks are sized down to 0). 1000px is
		// under that threshold, so it wraps even though it isn't "narrow"
		// by the recipe's own standard; 1200 comfortably clears it.
		await open(page, 1200);
		const xs = await token(page, '--yeti-width-xs');
		const [nav, main, aside] = await Promise.all([rect(page, '#t-nav'), rect(page, '#t-main'), rect(page, '#t-aside')]);
		expect(nav.top).toBeCloseTo(main.top, 1);
		expect(aside.top).toBeCloseTo(main.top, 1);
		expect(nav.right).toBeLessThanOrEqual(main.left);
		expect(main.right).toBeLessThanOrEqual(aside.left);
		expect(Math.abs(nav.width - xs)).toBeLessThan(2);
		expect(Math.abs(aside.width - xs)).toBeLessThan(2);
		await stage(page, 400);
		const [n2, m2, a2] = await Promise.all([rect(page, '#t-nav'), rect(page, '#t-main'), rect(page, '#t-aside')]);
		expect(m2.top).toBeGreaterThanOrEqual(n2.bottom);
		expect(a2.top).toBeGreaterThanOrEqual(m2.bottom);
	});

	test('a body-row div only applies to a div holding nav, main, or aside', async ({ page }) => {
		await open(page, 1000);
		const [shell, pcA, pcB] = await Promise.all([rect(page, '#plain'), rect(page, '#pc-a'), rect(page, '#pc-b')]);
		const height = await page.evaluate(() => window.innerHeight);
		expect(pcB.top).toBeGreaterThanOrEqual(pcA.bottom);
		expect(shell.height).toBeCloseTo(height, 0);
	});

	test('an element an extension adds to the shell earns no space of its own', async ({ page }) => {
		await open(page, 1000);
		const before = await Promise.all(['#classed', '#c-header', '#c-main', '#c-footer'].map((s) => rect(page, s)));
		// A shell on body is where extensions append their roots: a custom
		// element after the footer and a div before the header, both empty.
		await page.evaluate(() => {
			const shell = document.getElementById('classed');
			shell.append(document.createElement('grammarly-desktop-integration'));
			shell.prepend(document.createElement('div'));
			shell.append(document.createElement('div'));
		});
		const [shell, header, main, footer, body] = await Promise.all(['#classed', '#c-header', '#c-main', '#c-footer', '#classed > div:has(main)'].map((s) => rect(page, s)));
		expect(header.top).toBeCloseTo(shell.top, 1);
		expect(footer.bottom).toBeCloseTo(shell.bottom, 1);
		// The parts keep their places and their spacing; the body row grows, so
		// the footer is a gap below the row, not below main.
		const gap = await token(page, '--yeti-space-md');
		expect(main.top - header.bottom).toBeCloseTo(gap, 1);
		expect(footer.top - body.bottom).toBeCloseTo(gap, 1);
		expect(header.top).toBeCloseTo(before[1].top, 1);
		expect(footer.bottom).toBeCloseTo(before[3].bottom, 1);
	});

	test('a nav that is the shell\'s own child is a part, a gap above main', async ({ page }) => {
		await open(page, 1000);
		// The starter's top bar: a sticky nav straight in the shell, with no
		// header around it (a header would stop it sticking past itself).
		await page.evaluate(() => {
			const shell = document.createElement('div');
			shell.className = 'shell';
			shell.id = 'bar';
			shell.innerHTML = '<a href="#m">Skip</a><nav id="bar-nav">Bar</nav><main id="m">Main</main><footer id="bar-footer">Foot</footer>';
			document.body.append(shell);
		});
		const gap = await token(page, '--yeti-space-md');
		const [nav, main, footer] = await Promise.all(['#bar-nav', '#m', '#bar-footer'].map((s) => rect(page, s)));
		expect(main.top - nav.bottom).toBeCloseTo(gap, 1);
		expect(footer.top - main.bottom).toBeCloseTo(gap, 1);
	});

	test('children have no margins', async ({ page }) => {
		await open(page);
		// The shell spaces its parts with a top margin on each part after the
		// first, by design; those are skipped here and asserted exactly below.
		await expectNoChildMargins(page, '.shell', '[data-split], [data-center], .shell > :is(header, main, footer, div) ~ *');
		const gap = await token(page, '--yeti-space-md');
		const parts = await page.evaluate(() => [...document.querySelectorAll('#classed > *')].map((el) => { const cs = getComputedStyle(el); return [parseFloat(cs.marginTop), cs.marginRight, cs.marginBottom, cs.marginLeft]; }));
		expect(parts[0][0]).toBe(0);
		for (const p of parts.slice(1)) expect(p[0]).toBeCloseTo(gap, 1);
		for (const p of parts) expect(p.slice(1)).toEqual(['0px', '0px', '0px']);
		await expectNoChildMargins(page, '.shell > div:has(> :is(nav, main, aside))');
	});

	test('has no accessibility violations', async ({ page }) => {
		await open(page);
		// Stacking several full shells (each with its own header/footer/main) in one
		// document to measure them side by side creates landmark duplicates and,
		// for #plain's bare div.center, content outside any landmark; those are
		// artifacts of the fixture, not the recipe, so both are removed here and
		// measured on their own above instead.
		await page.evaluate(() => { document.getElementById('three').remove(); document.getElementById('plain').remove(); });
		expect(await axe(page)).toEqual([]);
	});
});
