import { test, expect } from 'playwright/test';
import { contrast } from './lib/color.js';
import { painted } from './lib/layout.js';

// A brand color per role (--yeti-brand-primary and the others) derives the
// whole ladder from one color. Without one, every color must be what the hue
// alone gave before the brand input existed, so the first test compares each
// step with that literal formula, and the line step has no value at all.
//
// The derived tokens are declared on :root (and on [data-palette], tested at
// the end), and a custom property that holds var() is resolved where it is
// declared, so every input before that is set on the root element. Colors are read through color(from … srgb r g b) on a probe,
// which keeps them as unclamped floats instead of rounded 8-bit channels.

const ROLES = ['primary', 'secondary', 'success', 'warning', 'alert'];
const HUES = { primary: 250, secondary: 300, success: 145, warning: 80, alert: 25 };
// The line step is left out: it has a value only when the role has a brand color.
const STEPS = ['subtle', 'soft', 'base', 'strong', 'text', 'on'];
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
// The chroma share stays a calc() as it was in the declaration, so the
// computed color can be compared as a string.
const literal = (step, scheme, hue) => {
	if (step === 'on') return scheme === 'light' ? 'oklch(0.99 0 0)' : 'oklch(0.15 0 0)';
	const s = LADDER[step];
	return `oklch(${s[scheme]} ${s.c === 1 ? CHROMA : `calc(${CHROMA} * ${s.c})`} ${hue})`;
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
	// The computed color string, exactly as the engine writes it.
	computed(scheme, expr) {
		const probe = this.host(scheme).firstElementChild;
		probe.style.backgroundColor = '';
		probe.style.backgroundColor = expr;
		return getComputedStyle(probe).backgroundColor;
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
	// No role's line step has a value, so everything that draws a line falls
	// back to the base step.
	const lines = await page.evaluate((roles) => roles.map((r) => getComputedStyle(document.documentElement).getPropertyValue(`--yeti-color-${r}-line`)), ROLES);
	expect(lines).toEqual(ROLES.map(() => ''));

	const mismatches = [];
	const missing = [];
	// A step is the old declaration character for character, so its computed
	// color string must equal the literal's exactly.
	const step = async (scheme, expr, expected, label) => {
		const [a, b] = await page.evaluate(([s, x, y]) => [window.__brand.computed(s, x), window.__brand.computed(s, y)], [scheme, expr, expected]);
		if (a !== b) mismatches.push(`${label}: ${a} is not ${b}`);
	};
	// A tone is now a mix, so it is compared as numbers.
	const tone = async (scheme, expr, expected, label) => {
		const [a, b] = await Promise.all([read(page, scheme, expr), read(page, scheme, expected)]);
		if (!a) { missing.push(label); return; }
		const d = worst(a, b);
		if (d > 0.01) mismatches.push(`${label} differs by ${d.toFixed(4)}`);
	};
	for (const scheme of ['light', 'dark']) {
		for (let hue = 0; hue < 360; hue += 30) {
			await setRoot(page, '--yeti-hue-primary', String(hue));
			for (const s of STEPS) {
				await step(scheme, `var(${token('primary', s)})`, literal(s, scheme, hue), `${scheme} hue ${hue} primary ${s}`);
			}
			for (const [n, share] of Object.entries(TONES)) {
				await tone(scheme, `var(--yeti-color-primary-${n})`, `oklch(from var(--yeti-grey-${n}) l ${CHROMA * share} ${hue})`, `${scheme} hue ${hue} primary-${n}`);
			}
		}
		await setRoot(page, '--yeti-hue-primary', null);
		for (const role of ROLES.slice(1)) {
			for (const s of STEPS) {
				await step(scheme, `var(${token(role, s)})`, literal(s, scheme, HUES[role]), `${scheme} ${role} ${s}`);
			}
			for (const [n, share] of Object.entries(TONES)) {
				await tone(scheme, `var(--yeti-color-${role}-${n})`, `oklch(from var(--yeti-grey-${n}) l ${CHROMA * share} ${HUES[role]})`, `${scheme} ${role}-${n}`);
			}
		}
	}
	expect(mismatches).toEqual([]);
	expect(missing).toEqual([]);
});

test('a brand color that is not set leaves the base at the hue', async ({ page }) => {
	const hueBase = await read(page, 'light', literal('base', 'light', 250));
	expect(worst(await read(page, 'light', 'var(--yeti-color-primary)'), hueBase)).toBeLessThanOrEqual(0.01);
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

// The brand color is not registered, so a light-dark() pair set on the root
// travels as written and is resolved where it is used: a section that pins
// the other scheme gets the other half.
test('3E: a light-dark() brand color set on the root follows a section that pins the other scheme', async ({ page }) => {
	await page.evaluate(() => { document.documentElement.style.colorScheme = 'light'; });
	await setRoot(page, '--yeti-brand-primary', 'light-dark(#0b1f4b, #8aa2d4)');
	expect(worst(await read(page, 'dark', 'var(--yeti-color-primary)'), hex('#8aa2d4')), 'dark section').toBeLessThanOrEqual(0.5);
	expect(worst(await read(page, 'light', 'var(--yeti-color-primary)'), hex('#0b1f4b')), 'light section').toBeLessThanOrEqual(0.5);
});

test('the focus color is the line step with a brand color, and the base step without', async ({ page }) => {
	for (const brand of [null, '#ffd400', '#0b1f4b']) {
		await setRoot(page, '--yeti-brand-primary', brand);
		for (const scheme of ['light', 'dark']) {
			const focus = await read(page, scheme, 'var(--yeti-color-focus)');
			const expected = await read(page, scheme, brand ? 'var(--yeti-color-primary-line)' : 'var(--yeti-color-primary)');
			expect(expected, `${brand} ${scheme} resolves`).not.toBeNull();
			expect(worst(focus, expected), `${brand} ${scheme}`).toBeLessThanOrEqual(0.01);
		}
	}
});

// A theme or a section that sets --yeti-color-primary itself, with no brand
// color, still colors its links and lines: the line step has no value then,
// and every reader falls back to the base step where it is read.
test.describe('a direct override still wins', () => {
	const GREEN = 'rgb(0, 128, 0)';

	const visit = async (page, path) => {
		const response = await page.goto(path);
		expect(response.status()).toBe(200);
	};
	const style = (page, selector, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [selector, prop]);
	// A token's color as computed on an element in the page.
	const tokenColor = (page, name) => page.evaluate((n) => {
		const el = document.createElement('span');
		el.style.color = `var(${n})`;
		document.body.append(el);
		const v = getComputedStyle(el).color;
		el.remove();
		return v;
	}, name);

	test('on the root, links, focus, a tab\'s underline and an outline button follow it', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/base.html');
		await setRoot(page, '--yeti-color-primary', GREEN);
		await painted(page);
		expect(await style(page, '#link', 'color'), 'link').toBe(GREEN);
		expect(await tokenColor(page, '--yeti-color-focus'), 'focus').toBe(GREEN);

		await visit(page, '/test/browser/fixtures/components/tabs.html');
		await setRoot(page, '--yeti-color-primary', GREEN);
		await expect(page.locator('#t1')).toHaveAttribute('aria-selected', 'true');
		await painted(page);
		expect(await style(page, '#t1', 'borderBottomColor'), 'tab underline').toBe(GREEN);

		await visit(page, '/test/browser/fixtures/components/button.html');
		await setRoot(page, '--yeti-color-primary', GREEN);
		await painted(page);
		expect(await style(page, '#medium', 'borderTopColor'), 'medium button').toBe(GREEN);
	});

	test('on a section, its own links and outline buttons follow it, and nothing outside', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/base.html');
		await page.evaluate(() => {
			const button = document.createElement('button');
			Object.assign(button, { className: 'button', type: 'button', id: 'sect-button', textContent: 'Outline' });
			button.dataset.emphasis = 'medium';
			document.getElementById('sect').append(button);
		});
		await painted(page);
		expect(await style(page, '#sect-link', 'color'), 'link inside').toBe(GREEN);
		expect(await style(page, '#sect-button', 'borderTopColor'), 'button inside').toBe(GREEN);
		expect(await style(page, '#link', 'color'), 'link outside').not.toBe(GREEN);
	});
});

// A line (a link, an underline, a rule, an outline border, a spinner's arc)
// is drawn straight onto the page or onto a subtle tint, so it takes the line
// step, which stays readable there. A fill (a solid button, badge, bar, a
// checked box, a painted band, a filled tab) keeps the brand color itself.
// #ffd400 is a yellow far too light to read on white: the line step moves
// away from it and the fills keep it.
test.describe('lines and fills with a brand color', () => {
	const BRAND = '#ffd400';

	const visit = async (page, path, brands = { '--yeti-brand-primary': BRAND }) => {
		const response = await page.goto(path);
		expect(response.status()).toBe(200);
		for (const [name, value] of Object.entries(brands)) await setRoot(page, name, value);
		await painted(page);
	};

	// The used value of one property on an element, read through the same
	// probe as the tokens so both sides are unclamped sRGB floats.
	const used = (page, selector, prop) => page.evaluate(([s, p]) => {
		const el = document.querySelector(s);
		return el ? window.__brand.srgb('light', getComputedStyle(el)[p]) : null;
	}, [selector, prop]);

	// One pixel of an element as drawn, for a fill no engine exposes to
	// getComputedStyle: Chromium reports the host's background for
	// ::-webkit-progress-value. The screenshot is decoded in the page.
	const pixel = async (page, selector, fx, fy) => {
		const png = await page.screenshot({ clip: await page.locator(selector).boundingBox() });
		return page.evaluate(async ([b64, x, y]) => {
			const image = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
			const canvas = new OffscreenCanvas(image.width, image.height);
			const ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0);
			return [...ctx.getImageData(Math.floor(image.width * x), Math.floor(image.height * y), 1, 1).data.slice(0, 3)];
		}, [png.toString('base64'), fx, fy]);
	};

	const expectLine = async (page, selector, prop, role = 'primary') => {
		const at = await used(page, selector, prop);
		const line = await read(page, 'light', `var(--yeti-color-${role}-line)`);
		expect(at, `${selector} ${prop} resolves`).not.toBeNull();
		expect(worst(at, line), `${selector} ${prop} is the ${role} line`).toBeLessThanOrEqual(0.5);
		expect(worst(at, hex(BRAND)), `${selector} ${prop} is not the brand color`).toBeGreaterThan(10);
	};
	const expectFill = (at, label) => {
		expect(at, `${label} resolves`).not.toBeNull();
		expect(worst(at, hex(BRAND)), `${label} is the brand color`).toBeLessThanOrEqual(1);
	};

	test('a link in body text is drawn in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/base.html');
		await expectLine(page, '#link', 'color');
	});

	test('a selected tab\'s underline is drawn in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/tabs.html');
		await expect(page.locator('#t1')).toHaveAttribute('aria-selected', 'true');
		await painted(page);
		await expectLine(page, '#t1', 'borderBottomColor');
	});

	test('a tabnav\'s marked link\'s underline is drawn in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/tabnav.html');
		await expectLine(page, '#tn-issues', 'borderBottomColor');
	});

	test('the toc\'s current item\'s marker is drawn in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/toc.html');
		await expect(page.locator('#link-one')).toHaveAttribute('aria-current', /.+/);
		await painted(page);
		await expectLine(page, '#link-one', 'borderLeftColor');
	});

	test('a default alert\'s border is drawn in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/alert.html');
		await expectLine(page, '#medium', 'borderTopColor');
	});

	test('a card with a variant is edged in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/card.html');
		await page.evaluate(() => { document.getElementById('tinted').dataset.variant = 'primary'; });
		await painted(page);
		await expectLine(page, '#tinted', 'borderTopColor');
	});

	test('a medium-emphasis button\'s border is drawn in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/button.html');
		await expectLine(page, '#medium', 'borderTopColor');
	});

	test('a standalone spinner\'s arc is drawn in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/spinner.html');
		await expectLine(page, '#spin', 'borderTopColor');
	});

	test('data-text="primary" is drawn in the line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/layouts/paint.html');
		await page.evaluate(() => { document.getElementById('text-alert').dataset.text = 'primary'; });
		await expectLine(page, '#text-alert', 'color');
	});

	test('an invalid field\'s border is drawn in the alert line step', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/field.html', { '--yeti-brand-alert': BRAND });
		await expectLine(page, '#name', 'borderTopColor', 'alert');
	});

	test('a solid button is filled with the brand color, with black text on it', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/button.html');
		expectFill(await used(page, '#primary', 'backgroundColor'), 'solid button');
		expect((await used(page, '#primary', 'color')).map(Math.round)).toEqual([0, 0, 0]);
	});

	test('a solid badge is filled with the brand color', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/badge.html');
		expectFill(await used(page, '#high', 'backgroundColor'), 'solid badge');
	});

	test('a progress bar\'s value is filled with the brand color', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/progress.html');
		// #bar is at 40%, so a tenth of the way in, half way down, is the value.
		expectFill(await pixel(page, '#bar', 0.1, 0.5), 'progress value');
	});

	test('a checked checkbox is filled with the brand color', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/field.html');
		expectFill(await used(page, '#agree', 'backgroundColor'), 'checked checkbox');
	});

	test('data-paint="primary" is filled with the brand color', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/layouts/paint.html');
		expectFill(await used(page, '#paint-primary', 'backgroundColor'), 'paint');
	});

	test('a high-emphasis selected tab is filled with the brand color', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/tabs.html');
		await expect(page.locator('#f1')).toHaveAttribute('aria-selected', 'true');
		await painted(page);
		expectFill(await used(page, '#f1', 'backgroundColor'), 'high tab');
	});

	test('another role\'s brand reaches its own variant\'s line', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/button.html', { '--yeti-brand-success': BRAND });
		await page.evaluate(() => { document.getElementById('medium').dataset.variant = 'success'; });
		await painted(page);
		await expectLine(page, '#medium', 'borderTopColor', 'success');
	});

	test('a theme can still set the line step itself', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/base.html', { '--yeti-brand-primary': BRAND, '--yeti-color-primary-line': 'rgb(1, 2, 3)' });
		expect(await page.evaluate(() => getComputedStyle(document.getElementById('link')).color)).toBe('rgb(1, 2, 3)');
	});

	test('a hovered link still reads on the page', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/base.html');
		await page.hover('#link');
		await painted(page);
		const at = await used(page, '#link', 'color');
		const surface = await read(page, 'light', 'var(--yeti-color-surface)');
		expect(at, 'hovered link resolves').not.toBeNull();
		expect(ratio(at, surface)).toBeGreaterThanOrEqual(4.5);
	});

	// Custom properties inherit, so a neutral variant has to clear the line
	// it would otherwise take from a brand-colored variant around it.
	test('a neutral variant inside a brand-colored one does not take its line', async ({ page }) => {
		await visit(page, '/test/browser/fixtures/components/button.html');
		await page.evaluate(() => {
			const wrap = document.createElement('div');
			wrap.dataset.variant = 'primary';
			const button = document.createElement('button');
			Object.assign(button, { className: 'button', type: 'button', id: 'nested', textContent: 'Neutral' });
			button.dataset.variant = 'neutral';
			button.dataset.emphasis = 'medium';
			wrap.append(button);
			document.body.append(wrap);
		});
		await painted(page);
		const at = await used(page, '#nested', 'borderTopColor');
		const neutral = await read(page, 'light', 'var(--yeti-color-neutral)');
		expect(at, 'border resolves').not.toBeNull();
		expect(worst(at, neutral)).toBeLessThanOrEqual(0.5);
	});
});

// data-palette starts a new palette: the derived colors are declared on
// :root and on [data-palette], so the color inputs set on a region are
// resolved there, and everything inside it takes the region's colors. The
// region is built in the page: a default button, a primary variant, a link,
// a painted span and a probe for reading tokens where they are used.
test.describe('data-palette', () => {
	const RED = '#e4002b';

	// One region, appended to `parent` (the body by default), with its own
	// inputs as inline style. Every id inside it starts with `id`.
	const region = (page, id, style = '', parent = null) => page.evaluate(([id, style, parent]) => {
		const section = document.createElement('section');
		section.id = id;
		section.setAttribute('data-palette', '');
		if (style) section.setAttribute('style', style);
		section.innerHTML = `<a class="button" id="${id}-button" href="#">Shop the sale</a>`
			+ ` <button class="button" type="button" data-variant="primary" id="${id}-variant">Primary</button>`
			+ ` <a id="${id}-link" href="#">A link</a>`
			+ ` <span data-paint="primary" id="${id}-paint">Painted</span>`
			+ `<i id="${id}-probe"></i>`;
		(parent ? document.getElementById(parent) : document.body).append(section);
	}, [id, style, parent]);

	// The same pieces outside any region, for comparison.
	const outside = (page) => page.evaluate(() => {
		const div = document.createElement('div');
		div.innerHTML = '<a class="button" id="out-button" href="#">Outside</a> <a id="out-link" href="#">A link</a><i id="out-probe"></i>';
		document.body.append(div);
	});

	// A token's color as sRGB floats, read on the probe given.
	const at = (page, probe, expr) => page.evaluate(([p, e]) => {
		const el = document.getElementById(p);
		el.style.backgroundColor = '';
		el.style.backgroundColor = `color(from ${e} srgb r g b)`;
		const m = getComputedStyle(el).backgroundColor.match(/color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)/);
		return m ? m.slice(1, 4).map((v) => parseFloat(v) * 255) : null;
	}, [probe, expr]);
	// One property of an element as drawn, as sRGB floats.
	const used = (page, selector, prop) => page.evaluate(([s, p]) => window.__brand.srgb('light', getComputedStyle(document.querySelector(s))[p]), [selector, prop]);
	// A custom property's computed value on an element, as the engine writes it.
	const raw = (page, selector, name) => page.evaluate(([s, n]) => getComputedStyle(document.querySelector(s)).getPropertyValue(n), [selector, name]);
	const root = (page, expr) => read(page, 'light', expr);

	test('3E: a brand color on a region changes the colors inside it only', async ({ page }) => {
		await region(page, 'r', `--yeti-brand-primary: ${RED}`);
		await outside(page);
		await painted(page);
		const inside = await used(page, '#r-button', 'backgroundColor');
		expect(inside, 'button inside resolves').not.toBeNull();
		expect(worst(inside, hex(RED)), 'button inside is the region\'s brand').toBeLessThanOrEqual(1);
		expect((await used(page, '#r-button', 'color')).map(Math.round), 'white text on it').toEqual([255, 255, 255]);
		const page_ = await root(page, 'var(--yeti-color-primary)');
		expect(worst(await used(page, '#out-button', 'backgroundColor'), page_), 'button outside keeps the page\'s primary').toBeLessThanOrEqual(0.5);
	});

	test('a hue on a region works too', async ({ page }) => {
		await region(page, 'r', '--yeti-hue-primary: 25');
		const inside = await at(page, 'r-probe', 'var(--yeti-color-primary)');
		expect(worst(inside, await root(page, 'oklch(0.52 0.15 25)'))).toBeLessThanOrEqual(0.01);
	});

	test('the line step and the tones follow the region', async ({ page }) => {
		await region(page, 'r', `--yeti-brand-primary: ${RED}`);
		await outside(page);
		await painted(page);
		const line = await at(page, 'r-probe', 'var(--yeti-color-primary-line)');
		expect(line, 'the region has a line step').not.toBeNull();
		expect(worst(await used(page, '#r-link', 'color'), line), 'link is the region\'s line').toBeLessThanOrEqual(0.5);
		const tone = await at(page, 'r-probe', 'var(--yeti-color-primary-50)');
		const toneOut = await at(page, 'out-probe', 'var(--yeti-color-primary-50)');
		expect(worst(tone, toneOut), 'primary-50 differs inside').toBeGreaterThan(10);
	});

	test('data-variant needs nothing new', async ({ page }) => {
		await region(page, 'r', `--yeti-brand-primary: ${RED}`);
		await painted(page);
		expect(worst(await used(page, '#r-variant', 'backgroundColor'), hex(RED))).toBeLessThanOrEqual(1);
		expect(worst(await used(page, '#r-paint', 'backgroundColor'), hex(RED)), 'data-paint too').toBeLessThanOrEqual(1);
	});

	test('every role re-derives, each on its own', async ({ page }) => {
		await region(page, 'r', '--yeti-brand-success: #ffd400');
		expect(worst(await at(page, 'r-probe', 'var(--yeti-color-success)'), hex('#ffd400')), 'success inside').toBeLessThanOrEqual(0.5);
		expect(worst(await at(page, 'r-probe', 'var(--yeti-color-primary)'), await root(page, 'var(--yeti-color-primary)')), 'primary inside').toBeLessThanOrEqual(0.01);
	});

	test('a region with the marker and no inputs changes nothing', async ({ page }) => {
		await region(page, 'r');
		const names = STEPS.map((s) => token('primary', s)).concat('--yeti-color-primary-line');
		expect(names).toHaveLength(7);
		for (const name of names) {
			expect(await raw(page, '#r-probe', name), name).toBe(await raw(page, 'html', name));
		}
		for (const s of STEPS) {
			const name = token('primary', s);
			expect(worst(await at(page, 'r-probe', `var(${name})`), await root(page, `var(${name})`)), name).toBeLessThanOrEqual(0.01);
		}
	});

	test('regions nest, and the outer region\'s color returns after the inner one', async ({ page }) => {
		await region(page, 'outer', `--yeti-brand-primary: ${RED}`);
		await region(page, 'inner', '--yeti-brand-primary: #1d4ed8', 'outer');
		await page.evaluate(() => {
			const after = document.createElement('a');
			Object.assign(after, { className: 'button', id: 'after-button', href: '#', textContent: 'After' });
			document.getElementById('outer').append(after);
		});
		await painted(page);
		expect(worst(await used(page, '#inner-button', 'backgroundColor'), hex('#1d4ed8')), 'inner').toBeLessThanOrEqual(1);
		expect(worst(await used(page, '#outer-button', 'backgroundColor'), hex(RED)), 'outer before').toBeLessThanOrEqual(1);
		expect(worst(await used(page, '#after-button', 'backgroundColor'), hex(RED)), 'outer after').toBeLessThanOrEqual(1);
	});

	test('the page\'s own inputs still reach a region', async ({ page }) => {
		await setRoot(page, '--yeti-hue-primary', '145');
		await region(page, 'r');
		const inside = await at(page, 'r-probe', 'var(--yeti-color-primary)');
		expect(worst(inside, await root(page, 'oklch(0.52 0.15 145)')), 'the root\'s green').toBeLessThanOrEqual(0.01);
		expect(worst(inside, await root(page, 'oklch(0.52 0.15 250)')), 'not the default blue').toBeGreaterThan(10);
	});

	test('a region can go back to the hue', async ({ page }) => {
		await setRoot(page, '--yeti-brand-primary', RED);
		await region(page, 'r', '--yeti-brand-primary: initial');
		expect(worst(await at(page, 'r-probe', 'var(--yeti-color-primary)'), await root(page, 'oklch(0.52 0.15 250)'))).toBeLessThanOrEqual(0.01);
		expect(await raw(page, '#r-probe', '--yeti-color-primary-line'), 'no line step').toBe('');
	});

	test('a link inside a brand region is the region\'s line, and outside it the page\'s', async ({ page }) => {
		await setRoot(page, '--yeti-brand-primary', '#ffd400');
		await region(page, 'r', `--yeti-brand-primary: ${RED}`);
		await outside(page);
		await painted(page);
		const inside = await used(page, '#r-link', 'color');
		const out = await used(page, '#out-link', 'color');
		expect(worst(inside, await at(page, 'r-probe', 'var(--yeti-color-primary-line)')), 'inside').toBeLessThanOrEqual(0.5);
		expect(worst(out, await root(page, 'var(--yeti-color-primary-line)')), 'outside').toBeLessThanOrEqual(0.5);
		expect(worst(inside, out), 'the two differ').toBeGreaterThan(10);
	});

	test('the neutral and page roles are not re-derived', async ({ page }) => {
		await region(page, 'r', `--yeti-brand-primary: ${RED}`);
		for (const name of ['--yeti-color-surface', '--yeti-color-text', '--yeti-color-border', '--yeti-color-neutral', '--yeti-grey-50']) {
			expect(await raw(page, '#r-probe', name), name).toBe(await raw(page, 'html', name));
		}
	});
});
