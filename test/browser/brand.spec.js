import { test, expect } from 'playwright/test';
import { contrast } from './lib/color.js';

// A brand color per role (--yeti-brand-primary and the others) derives the
// whole ladder from one opaque color. Without one, every color must be what
// the hue alone gave before the brand input existed, so the first test
// compares each step with that literal formula.
//
// The derived tokens are declared on :root, and a custom property that holds
// var() is resolved where it is declared, so every input here is set on the
// root element. Colors are read through color(from … srgb r g b) on a probe,
// which keeps them as unclamped floats instead of rounded 8-bit channels.

const ROLES = ['primary', 'secondary', 'success', 'warning', 'alert'];
const HUES = { primary: 250, secondary: 300, success: 145, warning: 80, alert: 25 };
const STEPS = ['subtle', 'soft', 'base', 'strong', 'text', 'line', 'on'];
const CHROMA = 0.15;

// The ladder as it stood before the brand input: lightness per scheme, and
// the share of --yeti-chroma each step carries.
const LADDER = {
	subtle: { light: 0.95, dark: 0.25, c: 0.4 },
	soft: { light: 0.85, dark: 0.35, c: 0.7 },
	base: { light: 0.52, dark: 0.70, c: 1 },
	strong: { light: 0.42, dark: 0.80, c: 1 },
	text: { light: 0.35, dark: 0.85, c: 0.8 },
};
const TONES = { 0: 0.4, 20: 0.7, 50: 1, 90: 0.4 };

const token = (role, step) => {
	if (step === 'on') return `--yeti-on-${role}`;
	if (step === 'base') return `--yeti-color-${role}`;
	return `--yeti-color-${role}-${step}`;
};

// The formula each step had before this change, written out with numbers.
const literal = (step, scheme, hue) => {
	if (step === 'on') return scheme === 'light' ? 'oklch(0.99 0 0)' : 'oklch(0.15 0 0)';
	const s = LADDER[step === 'line' ? 'base' : step];
	return `oklch(${s[scheme]} ${CHROMA * s.c} ${hue})`;
};

// Two hosts, one per scheme, each holding a probe. Reading inside a host
// resolves light-dark() for that host's scheme.
const HELPERS = `
window.__brand = {
	host(scheme) {
		let host = document.getElementById('brand-' + scheme);
		if (!host) {
			host = document.createElement('div');
			host.id = 'brand-' + scheme;
			host.style.colorScheme = scheme;
			host.append(document.createElement('i'));
			document.body.append(host);
		}
		return host;
	},
	srgb(scheme, expr) {
		const probe = this.host(scheme).firstElementChild;
		probe.style.backgroundColor = '';
		probe.style.backgroundColor = 'color(from ' + expr + ' srgb r g b)';
		const m = getComputedStyle(probe).backgroundColor.match(/color\\(srgb\\s+([-\\d.e]+)\\s+([-\\d.e]+)\\s+([-\\d.e]+)/);
		return m ? m.slice(1, 4).map((v) => parseFloat(v) * 255) : null;
	},
	set(name, value) {
		if (value === null) document.documentElement.style.removeProperty(name);
		else document.documentElement.style.setProperty(name, value);
	},
};
`;

const clamp255 = (a) => a.map((v) => Math.min(255, Math.max(0, v)));
const ratio = (a, b) => contrast(clamp255(a), clamp255(b));
const worst = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

const read = (page, scheme, expr) => page.evaluate(([s, e]) => window.__brand.srgb(s, e), [scheme, expr]);
const setRoot = (page, name, value) => page.evaluate(([n, v]) => window.__brand.set(n, v), [name, value]);

// Every 51st value of each channel: 216 brand colors.
const GRID = [];
for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
	GRID.push('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''));
}

// One evaluate for the whole grid: set each brand color on the root, read
// the named steps in both schemes, hand the floats back.
const sweep = (page, names) => page.evaluate(([grid, names]) => {
	const out = [];
	for (const color of grid) {
		window.__brand.set('--yeti-brand-primary', color);
		for (const scheme of ['light', 'dark']) {
			const v = { color, scheme };
			for (const [key, expr] of Object.entries(names)) v[key] = window.__brand.srgb(scheme, expr);
			out.push(v);
		}
	}
	window.__brand.set('--yeti-brand-primary', null);
	return out;
}, [GRID, names]);

test.beforeEach(async ({ page }) => {
	await page.addInitScript(HELPERS);
	const response = await page.goto('/test/browser/fixtures/color.html');
	expect(response.status()).toBe(200);
});

test('3E: without a brand color every step and tone is what the hue gave before', async ({ page }) => {
	const mismatches = [];
	const missing = [];
	const check = async (scheme, expr, expected, label) => {
		const [a, b] = await Promise.all([read(page, scheme, expr), read(page, scheme, expected)]);
		if (!a) { missing.push(label); return; }
		const d = worst(a, b);
		if (d > 0.01) mismatches.push(`${label} differs by ${d.toFixed(4)}`);
	};
	for (const scheme of ['light', 'dark']) {
		for (let hue = 0; hue < 360; hue += 30) {
			await setRoot(page, '--yeti-hue-primary', String(hue));
			for (const step of STEPS) {
				await check(scheme, `var(${token('primary', step)})`, literal(step, scheme, hue), `${scheme} hue ${hue} primary ${step}`);
			}
			for (const [n, share] of Object.entries(TONES)) {
				await check(scheme, `var(--yeti-color-primary-${n})`, `oklch(from var(--yeti-grey-${n}) l ${CHROMA * share} ${hue})`, `${scheme} hue ${hue} primary-${n}`);
			}
		}
		await setRoot(page, '--yeti-hue-primary', null);
		for (const role of ROLES.slice(1)) {
			for (const step of STEPS) {
				await check(scheme, `var(${token(role, step)})`, literal(step, scheme, HUES[role]), `${scheme} ${role} ${step}`);
			}
			for (const [n, share] of Object.entries(TONES)) {
				await check(scheme, `var(--yeti-color-${role}-${n})`, `oklch(from var(--yeti-grey-${n}) l ${CHROMA * share} ${HUES[role]})`, `${scheme} ${role}-${n}`);
			}
		}
	}
	expect(mismatches).toEqual([]);
	expect(missing).toEqual([]);
});

test('a brand color that is not set, or is not a color, leaves the base at the hue', async ({ page }) => {
	const hueBase = await read(page, 'light', literal('base', 'light', 250));
	expect(worst(await read(page, 'light', 'var(--yeti-color-primary)'), hueBase)).toBeLessThanOrEqual(0.01);
	for (const bad of ['250', 'banana']) {
		await setRoot(page, '--yeti-brand-primary', bad);
		expect(worst(await read(page, 'light', 'var(--yeti-color-primary)'), hueBase), bad).toBeLessThanOrEqual(0.01);
	}
});

test('with a brand color set, the base step is the brand color', async ({ page }) => {
	for (const brand of ['#ffd400', '#ff6a00', '#e4002b', '#1d4ed8', '#0b1f4b', '#000000', '#ffffff', '#6b7280']) {
		await setRoot(page, '--yeti-brand-primary', brand);
		for (const scheme of ['light', 'dark']) {
			expect(worst(await read(page, scheme, 'var(--yeti-color-primary)'), hex(brand)), `${brand} ${scheme}`).toBeLessThanOrEqual(0.5);
		}
	}
});

test('3E: over a grid of brand colors, text and lines keep their contrast', async ({ page }) => {
	const rows = await sweep(page, {
		base: 'var(--yeti-color-primary)',
		strong: 'var(--yeti-color-primary-strong)',
		on: 'var(--yeti-on-primary)',
		line: 'var(--yeti-color-primary-line)',
		subtle: 'var(--yeti-color-primary-subtle)',
		soft: 'var(--yeti-color-primary-soft)',
		text: 'var(--yeti-color-primary-text)',
		surface: 'var(--yeti-color-surface)',
	});
	const low = [];
	for (const v of rows) {
		const pairs = { 'on/base': [v.on, v.base], 'on/strong': [v.on, v.strong], 'line/surface': [v.line, v.surface], 'text/subtle': [v.text, v.subtle], 'text/soft': [v.text, v.soft] };
		for (const [name, [a, b]] of Object.entries(pairs)) {
			if (!a || !b) { low.push(`${v.scheme} ${v.color} ${name} did not resolve`); continue; }
			const r = ratio(a, b);
			if (r < 4.5) low.push(`${v.scheme} ${v.color} ${name} ${r.toFixed(3)}`);
		}
	}
	expect(rows.length).toBe(GRID.length * 2);
	expect(low).toEqual([]);
});

test('the hover step shows and moves the right way', async ({ page }) => {
	const rows = await sweep(page, { base: 'var(--yeti-color-primary)', strong: 'var(--yeti-color-primary-strong)' });
	const faint = rows.filter((v) => ratio(v.strong, v.base) < 1.08).map((v) => `${v.scheme} ${v.color} ${ratio(v.strong, v.base).toFixed(3)}`);
	expect(faint).toEqual([]);

	const lum = ([r, g, b]) => contrast(clamp255([r, g, b]), [0, 0, 0]);
	for (const [brand, way] of [['#000000', 'lighter'], ['#ffffff', 'darker'], ['#e4002b', 'darker'], ['#ff6a00', 'lighter']]) {
		await setRoot(page, '--yeti-brand-primary', brand);
		for (const scheme of ['light', 'dark']) {
			const base = await read(page, scheme, 'var(--yeti-color-primary)');
			const strong = await read(page, scheme, 'var(--yeti-color-primary-strong)');
			const lighter = lum(strong) > lum(base);
			expect(lighter, `${brand} ${scheme} strong should be ${way}`).toBe(way === 'lighter');
		}
	}
});

test('the text on the fill is pure black or pure white', async ({ page }) => {
	for (const [brand, on] of [['#ffd400', [0, 0, 0]], ['#0b1f4b', [255, 255, 255]]]) {
		await setRoot(page, '--yeti-brand-primary', brand);
		for (const scheme of ['light', 'dark']) {
			// Compared as 8-bit channels: Chromium's oklch(1 0 0) lands a few
			// ten-thousandths off 1 in sRGB, which is still rgb(255, 255, 255).
			const rgb = (await read(page, scheme, 'var(--yeti-on-primary)')).map(Math.round);
			expect(rgb, `${brand} ${scheme}`).toEqual(on);
		}
	}
});

test('the tones follow the brand color', async ({ page }) => {
	await setRoot(page, '--yeti-brand-primary', '#e4002b');
	for (const scheme of ['light', 'dark']) {
		const [r, g, b] = await read(page, scheme, 'var(--yeti-color-primary-50)');
		expect(r, `${scheme} red leads`).toBeGreaterThan(Math.max(g, b));
	}
	// #6b7280 is a grey with some blue of its own (oklch chroma 0.023 at hue
	// 264): its channels are 21 apart. The tone keeps that tint, measured at
	// 21.2 in light and 20.8 in dark, so the bound sits just above it. A tone
	// that took the full --yeti-chroma instead would be far wider apart.
	await setRoot(page, '--yeti-brand-primary', '#6b7280');
	for (const scheme of ['light', 'dark']) {
		const c = await read(page, scheme, 'var(--yeti-color-primary-50)');
		expect(Math.max(...c) - Math.min(...c), scheme).toBeLessThanOrEqual(22);
	}
});

test('each role has its own brand input', async ({ page }) => {
	const brand = '#e4002b';
	for (const role of ROLES) {
		await setRoot(page, `--yeti-brand-${role}`, brand);
		expect(worst(await read(page, 'light', `var(--yeti-color-${role})`), hex(brand)), role).toBeLessThanOrEqual(0.5);
		for (const other of ROLES.filter((r) => r !== role)) {
			const at = await read(page, 'light', `var(--yeti-color-${other})`);
			const hue = await read(page, 'light', literal('base', 'light', HUES[other]));
			expect(worst(at, hue), `${other} with only ${role} set`).toBeLessThanOrEqual(0.01);
		}
		await setRoot(page, `--yeti-brand-${role}`, null);
	}
});

test('light-dark() works as the brand input', async ({ page }) => {
	await setRoot(page, '--yeti-brand-primary', 'light-dark(#0b1f4b, #8aa2d4)');
	for (const [scheme, expected] of [['light', '#0b1f4b'], ['dark', '#8aa2d4']]) {
		await page.emulateMedia({ colorScheme: scheme });
		expect(worst(await read(page, scheme, 'var(--yeti-color-primary)'), hex(expected)), scheme).toBeLessThanOrEqual(0.5);
	}
});

test('the focus color is the primary line step, with and without a brand', async ({ page }) => {
	for (const brand of [null, '#ffd400', '#0b1f4b']) {
		await setRoot(page, '--yeti-brand-primary', brand);
		for (const scheme of ['light', 'dark']) {
			const focus = await read(page, scheme, 'var(--yeti-color-focus)');
			const line = await read(page, scheme, 'var(--yeti-color-primary-line)');
			expect(line, `${brand} ${scheme} line resolves`).not.toBeNull();
			expect(worst(focus, line), `${brand} ${scheme}`).toBeLessThanOrEqual(0.01);
		}
	}
});
