---
raw: true
title: "Color"
description: "How color works in Yeti and how to use it: why a color is a lightness, a chroma and a hue, six hues and a ladder, text that reads on every one of them, the same six words as status on a component, a color by name on anything, a greyscale that flips with the scheme, and the tokens behind all of it."
nav_group: "Guides"
nav_order: 8
---

# Color

<p class="lede">Color in Yeti is six words and a distance. A hue has a name, <code>primary</code> or <code>warning</code>, and the same name means the same thing on a badge, a button, an alert and a painted section. A grey has a number, how far it sits from the page toward the page's own text, and that number means the same thing in light mode and in dark. The browser picks the scheme; Yeti keeps every pair of colors readable in both. This page starts with why it is built that way, and then how to use it.</p>

The [theming guide](theming.md) is how to change it.

## A color is three answers

A hex code says how much red, green and blue light a screen should give off. `#006bbb` is exact, and it tells you nothing you can design with: not how bright the color is, not how strong, and not what to change to get a lighter one that still looks related.

Yeti writes a color as `oklch(lightness chroma hue)`. Those are three questions you already ask of every color:

- **Lightness: how bright is it?** `0` is black and `1` is white. `0.5` looks half-way between them.
- **Chroma: how colorful is it?** `0` is grey. `0.15` is a clear accent. There is no fixed top: how far it can go depends on the other two.
- **Hue: which color is it?** An angle around a wheel: 25 is red, 80 amber, 145 green, 195 teal, 250 blue, 300 violet.

The three are built to match the eye and not the screen, so you can change one and the other two look much as they did. Try it: start from a color you know, then move one slider at a time.

```html demo xl md nocode
<style>
	.mixer { --color: oklch(var(--l) var(--c) var(--h)); }
	.swatch { background: var(--color); padding: var(--yeti-space-lg); border-radius: var(--yeti-radius-md); }
	.strip { block-size: 0.75rem; border-radius: var(--yeti-radius-sm); }
</style>
<div class="mixer stack" data-gap="md" style="--l: 0.52; --c: 0.15; --h: 250">
	<div class="swatch cluster" data-gap="lg"><strong style="color: white">White text</strong><strong style="color: black">Black text</strong></div>
	<code id="value">oklch(0.52 0.15 250)</code>
	<div class="field">
		<label for="l">Lightness</label>
		<output for="l" aria-hidden="true"></output>
		<input id="l" type="range" min="0" max="1" step="0.01" value="0.52">
	</div>
	<div class="strip" style="background: linear-gradient(to right in oklch, oklch(0 var(--c) var(--h)), oklch(1 var(--c) var(--h)))"></div>
	<div class="field">
		<label for="c">Chroma</label>
		<output for="c" aria-hidden="true"></output>
		<input id="c" type="range" min="0" max="0.3" step="0.005" value="0.15">
	</div>
	<div class="strip" style="background: linear-gradient(to right in oklch, oklch(var(--l) 0 var(--h)), oklch(var(--l) 0.3 var(--h)))"></div>
	<div class="field">
		<label for="h">Hue</label>
		<output for="h" aria-hidden="true"></output>
		<input id="h" type="range" min="0" max="360" step="1" value="250">
	</div>
	<div class="strip" style="background: linear-gradient(to right in oklch longer hue, oklch(var(--l) var(--c) 0), oklch(var(--l) var(--c) 360))"></div>
	<div class="field">
		<label for="start">Start from a color you know</label>
		<input id="start" type="color" value="#006bbb">
	</div>
</div>
<script>
	const mixer = document.querySelector('.mixer');
	const sliders = ['l', 'c', 'h'].map((id) => document.getElementById(id));
	mixer.addEventListener('input', (event) => {
		if (event.target.id === 'start') {
			// The browser converts the hex code; read the three numbers back.
			const probe = document.createElement('i');
			probe.style.color = `oklch(from ${event.target.value} l c h)`;
			mixer.append(probe);
			const numbers = getComputedStyle(probe).color.match(/[\d.]+(e-?\d+)?/g).map(Number);
			probe.remove();
			sliders.forEach((slider, i) => {
				slider.value = numbers[i];
				slider.dispatchEvent(new Event('input', { bubbles: true }));
			});
			return;
		}
		sliders.forEach((slider) => mixer.style.setProperty(`--${slider.id}`, slider.value));
		document.getElementById('value').textContent = `oklch(${sliders.map((s) => s.value).join(' ')})`;
	});
</script>
```

Watch the two words as you move lightness: white text fades as the color gets brighter, and black text fades as it gets darker. Then move the hue. The words hardly change. That is the idea the rest of this page is built on.

You may know the same three letters as LCH. It is the same idea in an older form. OKLCH corrects it, most visibly in blues, which drift toward purple in LCH as they get lighter.

## Why HSL cannot do this

HSL has a hue and a lightness too, and it looks like the same thing. But its lightness is arithmetic on the screen's numbers. Pure yellow and pure blue are both 50% light in HSL. White text on that yellow is about 1:1, which is invisible, and on that blue it is about 8.6:1.

Here are six colors made two ways. Each row keeps its other two numbers the same and changes only the hue. Then take the color away, and what is left is how bright each one really is.

```html demo lg lg
<style>
	.row { display: grid; grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr)); gap: var(--yeti-space-xs); }
	.row > * { color: white; text-align: center; }
	.compare:has(:checked) .row { filter: grayscale(1); }
</style>
<div class="compare stack" data-gap="md">
	<div class="stack" data-gap="xs">
		<code>hsl(hue 70% 45%)</code>
		<div class="row">
			<div class="box" data-gap="sm" style="background: hsl(0 70% 45%)">Red</div>
			<div class="box" data-gap="sm" style="background: hsl(50 70% 45%)">Yellow</div>
			<div class="box" data-gap="sm" style="background: hsl(130 70% 45%)">Green</div>
			<div class="box" data-gap="sm" style="background: hsl(180 70% 45%)">Teal</div>
			<div class="box" data-gap="sm" style="background: hsl(225 70% 45%)">Blue</div>
			<div class="box" data-gap="sm" style="background: hsl(270 70% 45%)">Violet</div>
		</div>
	</div>
	<div class="stack" data-gap="xs">
		<code>oklch(0.52 0.15 hue)</code>
		<div class="row">
			<div class="box" data-gap="sm" style="background: oklch(0.52 0.15 25)">Red</div>
			<div class="box" data-gap="sm" style="background: oklch(0.52 0.15 100)">Yellow</div>
			<div class="box" data-gap="sm" style="background: oklch(0.52 0.15 145)">Green</div>
			<div class="box" data-gap="sm" style="background: oklch(0.52 0.15 195)">Teal</div>
			<div class="box" data-gap="sm" style="background: oklch(0.52 0.15 250)">Blue</div>
			<div class="box" data-gap="sm" style="background: oklch(0.52 0.15 300)">Violet</div>
		</div>
	</div>
	<div class="field">
		<input id="grey" type="checkbox" role="switch">
		<label for="grey">Take the color away</label>
	</div>
</div>
```

In HSL, every hue needs its own hand-picked lightness before the words read. In OKLCH, one lightness serves them all. Measured at every fifteen degrees, white text on the HSL recipe runs from 1.9:1 to 10:1. On the OKLCH one it runs from 4.7:1 to 6:1, so it never drops under the 4.5:1 that body text needs.

There is a cost, and it is in the second row. A yellow dark enough to carry white text is an olive. No system can give you a bright yellow that white words read on, because there isn't one. If your brand is that yellow, use it as [a brand color](#a-brand-color), and Yeti puts black words on it.

## Lightness does the work

Two colors read against each other when one is much lighter than the other. Hue and chroma add very little. So Yeti fixes the lightness, and gives each step of it one job:

```html demo lg lg
<div class="grid" data-min="xs" data-gap="md" data-palette style="--yeti-hue-primary: 250; --yeti-chroma: 0.15">
	<div class="box stack" data-surface="base" data-gap="sm" style="color-scheme: light">
		<strong>Light</strong>
		<div class="box" data-gap="sm" style="background: var(--yeti-color-primary-subtle)">Subtle, 0.95</div>
		<div class="box" data-gap="sm" style="background: var(--yeti-color-primary-soft)">Soft, 0.85</div>
		<div class="box" data-gap="sm" style="background: var(--yeti-color-primary); color: var(--yeti-on-primary)">Base, 0.52</div>
		<div class="box" data-gap="sm" style="background: var(--yeti-color-primary-strong); color: var(--yeti-on-primary)">Strong, 0.42</div>
		<div style="color: var(--yeti-color-primary-text)">Text, 0.35</div>
	</div>
	<div class="box stack" data-surface="base" data-gap="sm" style="color-scheme: dark">
		<strong>Dark</strong>
		<div class="box" data-gap="sm" style="background: var(--yeti-color-primary-subtle)">Subtle, 0.25</div>
		<div class="box" data-gap="sm" style="background: var(--yeti-color-primary-soft)">Soft, 0.35</div>
		<div class="box" data-gap="sm" style="background: var(--yeti-color-primary); color: var(--yeti-on-primary)">Base, 0.70</div>
		<div class="box" data-gap="sm" style="background: var(--yeti-color-primary-strong); color: var(--yeti-on-primary)">Strong, 0.80</div>
		<div style="color: var(--yeti-color-primary-text)">Text, 0.85</div>
	</div>
</div>
```

- **Distance from the page is the job.** Subtle sits close to the page, so it can go behind a paragraph. Text sits far from it, so it can be one. Base is in between, far enough to be seen as a button and to carry words of its own.
- **Dark mode is the same jobs from the other end.** It is not the light palette turned upside down. Each step has a second lightness, measured from a dark page, and the words on a base button turn from near white to near black.
- **The hue is free.** Because the jobs belong to the lightness, any hue can do all of them. That is why you give Yeti one number and get a whole family that reads.

Lightness is very close to contrast, but it is not the same sum. The ratio that accessibility rules use is worked out from luminance, so the same lightness gives slightly different ratios at different hues. That is the spread in the figures above, and it is why Yeti measures [the pairs it promises](#text-on-color) and does not assume them.

## Chroma is how loud

Put a strong red beside a soft blue and the red looks more important, whether you meant it or not. When colors share a chroma, no hue shouts over another, and six unrelated hues look like one set. Importance is then something you choose, with size, position and `data-emphasis`, and not an accident of which color a thing happened to be.

```html demo md lg
<div class="stack" data-gap="md" data-palette style="--yeti-chroma: 0.15; --yeti-hue-primary: 250">
	<div class="field">
		<label for="chroma">One chroma, every color</label>
		<output for="chroma" aria-hidden="true"></output>
		<input id="chroma" type="range" min="0" max="0.25" step="0.01" value="0.15" oninput="this.closest('[data-palette]').style.setProperty('--yeti-chroma', this.value)">
	</div>
	<div class="cluster" data-gap="sm">
		<button class="button" type="button" data-variant="primary">Primary</button>
		<button class="button" type="button" data-variant="secondary">Secondary</button>
		<button class="button" type="button" data-variant="success">Success</button>
		<button class="button" type="button" data-variant="warning">Warning</button>
		<button class="button" type="button" data-variant="alert">Alert</button>
	</div>
	<div class="alert" role="status" data-variant="success"><div>Your changes are live.</div></div>
</div>
```

`--yeti-chroma` is one number for a site's whole temperament: near `0.05` it is quiet, and at the default `0.15` it is clear. Going higher has a cost, for the reason below.

One number does not mean every step gets all of it. A pale tint at full chroma is a highlighter pen, and words have to sit on it. So the base and strong steps take all of the chroma, the soft step 70% of it, the subtle step 40%, and words in the hue 80%.

Screens set a limit too. How colorful a color can be depends on its hue and its lightness, and the edge is uneven: at the base step's 0.52, an ordinary screen can show violet far past `0.15`, while teal stops near `0.09` and amber near `0.11`. Past the edge the browser shows the nearest color it can, so teal looks quieter than the others and may shift a little. A wide-gamut screen shows more.

That edge is why `0.15` is the default. The color a screen falls back to is a little brighter, so the words on it lose contrast. At `0.15` the weakest hue, near teal, holds about 4.6:1 in light mode. At `0.2` and the same lightness it would hold about 4.2:1, under what body text needs.

So above `0.15` Yeti gives up a little lightness to keep the words. In light mode the base step and its hover step go darker by 0.004 for each 0.01 of chroma: at `0.25` the base sits at 0.48 and not 0.52. Every hue then holds 4.5:1 up to a chroma of `0.3`. Past that, check your own hue. At `0.08` or lower, the base step of every hue fits on an ordinary screen, so all six match.

## Hue is the brand decision

With lightness doing the work and chroma set once, hue is the only part left to choose, and at the default chroma every angle reads. Turn it:

```html demo lg lg
<div class="stack" data-gap="md" data-palette style="--yeti-chroma: 0.15; --yeti-hue-primary: 250">
	<div class="field">
		<label for="hue">Primary hue</label>
		<output for="hue" aria-hidden="true"></output>
		<input id="hue" type="range" min="0" max="360" step="1" value="250" oninput="this.closest('[data-palette]').style.setProperty('--yeti-hue-primary', this.value)">
	</div>
	<div class="cluster" data-gap="sm" data-align="center">
		<button class="button" type="button">Save</button>
		<button class="button" type="button" data-emphasis="medium">Preview</button>
		<button class="button" type="button" data-emphasis="low">Cancel</button>
		<span class="badge" data-variant="primary">New</span>
	</div>
	<div class="alert" role="status" data-variant="primary"><div><strong>Draft saved.</strong> It is not published yet.</div></div>
	<p>Not sure? <a href="#">Read it through</a> first.</p>
	<div class="box" data-paint="primary">A painted band, with the words made for it.</div>
</div>
```

Every part moved, every tint and hover moved with it, and nothing had to be picked again. In your own stylesheet that is one line:

```css
:root { --yeti-hue-primary: 160; }
```

To find the hue of a color you already have, put it into the mixer at the top of this page, or click its swatch in your browser's developer tools and change the format to OKLCH. The third number is the hue.

Even lightness has one consequence to design for. With the color taken away, a success button and an alert button are nearly the same grey, and some readers see them almost that way. So a hue should never be the only thing that tells two statuses apart: say it in words, or add an icon.

## When to break it

Some brands are one exact color, and a hue at Yeti's lightness is a relative of it and not the thing itself. Then give Yeti the color, as [a brand color](#a-brand-color). The base step becomes exactly that color, the words on it become black or white, whichever reads, and the steps around it keep the ladder's lightness, so the tints and the text are as dependable as before.

Start with a hue if you are choosing. Use a brand color if it has already been chosen for you.

## Six hues, one chroma

Everything starts from six hue angles, `primary`, `secondary`, `success`, `warning`, `alert` and `neutral`, and one chroma for how saturated the accents are. From those, Yeti derives every color at runtime, in both schemes at once, through one fixed ladder of lightness. Change a hue and the whole family moves with it; nothing is hand-picked.

Each hue gets five steps and a partner for text placed on it:

<div class="scroller" role="region" aria-label="The color ladder" tabindex="0" markdown="1">

| Token | Light | Dark | For |
| --- | --- | --- | --- |
| `--yeti-color-primary-subtle` | L 0.95 | L 0.25 | a tint behind body text: a callout's background, a striped row |
| `--yeti-color-primary-soft` | L 0.85 | L 0.35 | a soft fill or a border with some weight |
| `--yeti-color-primary` | L 0.52 | L 0.70 | the color itself: a button, a badge, a bar, a link |
| `--yeti-color-primary-strong` | L 0.42 | L 0.80 | the same thing under the pointer |
| `--yeti-color-primary-text` | L 0.35 | L 0.85 | words in the hue on the page, at reading contrast |
| `--yeti-on-primary` | near white | near black | words placed on the base color |

</div>

The page itself has its own roles, and by default every one of them is a true grey. A theme can give them a hint of a hue: `--yeti-chroma-neutral` is how much of a hint, `0` by default and about `0.02` for a faint tint, and `--yeti-hue-neutral` is the hue, which follows the primary hue unless set. The roles are `--yeti-color-surface` and its `-raised` and `-sunken` steps, `--yeti-color-text` and `-text-muted`, `--yeti-color-border` and `-border-strong`, a `-scrim` for washing over a picture, and `-focus`, which is the primary by default, or its line step when the primary has a brand color. Every one of these is a token you can read from your own CSS and a role a theme can set outright.

## A brand color

A hue is an angle, and most brands are not. When a brand has a color of its own, give it to Yeti as it is. Each of the five accent roles takes one: `--yeti-brand-primary`, `--yeti-brand-secondary`, `--yeti-brand-success`, `--yeti-brand-warning` and `--yeti-brand-alert`. Each is optional and stands on its own, so you can set the primary and leave the other four on their hues. Any CSS color works, and `light-dark()` gives a different color in each scheme. Use an opaque one: the base step is the color as you give it, and the contrast promises below are for a color you cannot see through. Set them on `:root`, like the hues.

```css
:root {
	--yeti-brand-primary: #ff6a00;
	--yeti-brand-secondary: light-dark(#0b1f4b, #8aa2d4);
}
```

A brand color sets the base step exactly, and Yeti works out the rest of the role around it:

<div class="scroller" role="region" aria-label="The steps with a brand color" tabindex="0" markdown="1">

| Token | With a brand color |
| --- | --- |
| `--yeti-color-primary` | the brand color exactly: a solid button, a solid badge, a progress bar, a checked box |
| `--yeti-on-primary` | black or white, whichever reads on the brand color |
| `--yeti-color-primary-strong` | the hover fill, moved away from the text on it: darker under white text, lighter under black. A very dark brand color lightens and a very light one darkens instead, so the hover still shows |
| `--yeti-color-primary-subtle`, `-soft`, `-text` | the ladder's lightness under the brand's hue. Their chroma is the brand's own, capped at `--yeti-chroma`, so a pastel brand gives quiet tints and a neon one is held back |
| `--yeti-color-primary-0` to `-100` | each grey's lightness under the brand's hue, with the chroma capped the same way |
| `--yeti-color-primary-line` | the brand's hue, dark enough to read on the page, or in dark mode light enough |

</div>

The line step is the one a hue does not need. A fill carries its own text, so it can be any color: the text on it is picked to read. A link, a focus ring or a border sits on the page, so it has to read there. Yeti's base lightness does both jobs, which is why a hue has no line step. A yellow brand color can fill a button but cannot be a link on white. So with a brand color, what is drawn on the page takes the line step: links, the focus ring, a tab's underline, an outline button's border, an alert's and a card's border, a spinner's arc and `data-text`. The fills keep the brand color. The line step holds at least 4.5:1 against the page surface in both schemes.

The line step has a value only when its role has a brand color. Everything that reads it falls back to the base step, and your own CSS should read it the same way:

```css
.pull-quote {
	border-inline-start: 4px solid var(--yeti-color-primary-line, var(--yeti-color-primary));
}
```

A theme can set the line step itself, and that wins. Without a brand color, nothing changes: a site that sets only hues, or nothing, gets exactly the colors it had.

A brand color is not checked. The hue inputs are registered as numbers, so a hue that is not a number falls back to its default. A brand color can be any color, so it cannot be registered, and a value that is not a color, `--yeti-brand-primary: banana`, breaks that role's colors.

The page's greys do not follow a brand color, and do not need to: surfaces, text and borders are true greys by default. A theme that tints them sets the tint's hue itself, as the [theming guide](theming.md#make-a-theme) shows.

## Text on color

Two of the six steps exist only so that words read. `--yeti-on-primary` is what goes *on* the base color: it is near white in light mode, where the base is dark enough to carry it, and near black in dark mode, where the base is lifted to carry that instead. With a brand color it is black or white, whichever reads on that color. `--yeti-color-primary-text` is the hue *as* text on the page, pushed far enough from the surface to be read at body size. Reach for `on-` when you paint something the hue and put words on it; reach for `-text` when the words themselves are the hue.

These are promises, not intentions. The browser tests check them at every hue angle, at chromas from `0.05` to `0.3`, in both schemes:

| Pair | Holds at least |
| --- | --- |
| page text on the page surface | 7:1 |
| muted text on the page surface | 4.5:1 |
| `on-` text on every base hue | 4.5:1 |
| `-text` of every hue on the page surface | 4.5:1 |
| page text on every `-subtle` tint | 7:1 |

A theme that sets a hue keeps every one of these, because the ladder is fixed and only the angle moved. A theme that raises the chroma keeps them up to `0.3`, because the base step [goes darker to make room](#chroma-is-how-loud).

A brand color keeps its own set. The browser tests check these over a grid of brand colors from black to white, in both schemes, at the default chroma and at `0.25`:

| Pair | Holds at least |
| --- | --- |
| `on-` text on the brand color | 4.5:1 |
| `on-` text on the `-strong` hover fill | 4.5:1 |
| the `-line` step on the page surface | 4.5:1 |
| `-text` on `-subtle` | 4.5:1 |
| `-text` on `-soft` | 4.5:1 |

Page text on a `-subtle` tint still reaches 7:1.

A theme that sets a derived color directly, `--yeti-color-primary: #0a7`, takes the promise into its own hands for that role. With no brand color for that role, its links and lines follow that color, as before.

## Color that means something

On a component, a hue is a status, not a decoration. `data-variant` takes the six names, and the component decides what to do with the color: a button fills with it, a badge tints itself with the subtle step and writes in the hue, a card tints its border, an alert washes its background with the subtle step behind a border in the hue, and a progress bar and a toc use it for the moving part. The word stays the same across all of them, so a reader learns `success` once.

`danger` is a seventh word on that list that is not a seventh hue. It is `alert` under its Foundation 6 name, kept so a callout that said danger still says something. New pages should say `alert`.

The words are the same as `data-paint` uses below, and that is the point: this is what `success` looks like as a status, and beside it as a fill.

```html demo md
<div class="stack" data-gap="md">
	<div class="cluster" data-gap="sm" data-align="center">
		<span class="badge" data-variant="success">Live</span>
		<button class="button" type="button" data-variant="success">Publish</button>
		<div class="alert" role="status" data-variant="success">
			<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
			<div><strong>Saved.</strong> Your changes are live.</div>
		</div>
	</div>
	<div class="box" data-paint="success">A section painted the same word: the base color, with the text made for it.</div>
</div>
```

`data-variant` also takes `black` and `white`. They are the constants, not hues: a black button is black in dark mode too. Reach for them on a painted band, where a control in the band's own hue would disappear. That is what they are for: on the plain page one of them disappears in one scheme, white on a light page and black on a dark one, so they are not a substitute for `neutral`.

## A color by name

Anything can be painted. `data-paint` sets the background of any element, and the words on it, from one list: the six hues at their base step, three constants, and the eleven steps of the greyscale. `data-text` sets the words alone, from the same list, and on an element that is also painted it wins over the automatic color. Neither needs a class, and both outrank whatever background or color the element's own component gave it, so a `card` or a `button` can be painted too.

- **A hue** paints the base color and puts its `on-` text on it, the same pair a button uses.
- **`white`, `black` and `grey`** are the only three colors in Yeti that never move: white and black are what they say, and `grey` is 18% reflectance, the photographic middle. White takes black text, black takes white, and grey takes black. Reach for them when a thing must be that color on every page, a caption band over a photograph, and for the greyscale otherwise.
- **`grey-0` to `grey-100`**, in tens, is the greyscale. `grey-0` is the page surface and `grey-100` is the page text, and each step is ten percent of the way from the one toward the other. A painted grey takes the page text up to `grey-40` and the page surface from `grey-50`, because half-way toward the text is where the text stops reading. The middle steps, `grey-40` to `grey-60`, suit a fill more than a block of text: no text color reaches full contrast on them.

A grey names a distance, not a color. In light mode the scale runs from white toward black; in dark mode from black toward white; and `grey-20` is a quiet panel near the page in both. That is the whole reason the steps are numbers and not names. The frame below shows the scale the way the page's own scheme reads it, so on a page that follows your setting it reverses when you change it; the second row is the primary hue at the same eleven steps, which is a token rather than a paint value.

```html demo sm
<div class="stack" data-gap="sm">
	<div class="cluster" data-gap="xs">
		<span class="box" data-gap="xs" data-paint="grey-0">0</span>
		<span class="box" data-gap="xs" data-paint="grey-10">10</span>
		<span class="box" data-gap="xs" data-paint="grey-20">20</span>
		<span class="box" data-gap="xs" data-paint="grey-30">30</span>
		<span class="box" data-gap="xs" data-paint="grey-40">40</span>
		<span class="box" data-gap="xs" data-paint="grey-50">50</span>
		<span class="box" data-gap="xs" data-paint="grey-60">60</span>
		<span class="box" data-gap="xs" data-paint="grey-70">70</span>
		<span class="box" data-gap="xs" data-paint="grey-80">80</span>
		<span class="box" data-gap="xs" data-paint="grey-90">90</span>
		<span class="box" data-gap="xs" data-paint="grey-100">100</span>
	</div>
	<div class="cluster" data-gap="xs" aria-hidden="true">
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-0)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-10)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-20)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-30)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-40)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-50)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-60)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-70)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-80)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-90)"></span>
		<span class="box" data-gap="sm" style="background-color: var(--yeti-color-primary-100)"></span>
	</div>
</div>
```

A button inside a painted band keeps its own colors, and on a band in the brand hue a brand-colored button disappears; paint the button too, `data-paint="white"` on a primary band, and it reads. Inside a painted element, a plain link and a caption take the element's color too. Without that, a link inside a primary band would be primary on primary. A link that is a button keeps its own colors, because it is a button, and a caption that names its own `data-text` keeps that. A painted element also keeps its background on paper: browsers drop backgrounds when printing unless told otherwise, and a band's words were chosen for that background, so Yeti asks for them to stay; the reader's own print setting can still take them away.

```html demo md
<div class="stack" data-gap="md">
	<section class="box" data-paint="primary" data-gap="lg">
		<h2>A painted band</h2>
		<p>Its words are the color made for it, and so is <a href="#">a link inside it</a>. A heading, a paragraph and a link, all readable, nothing set by hand.</p>
	</section>
	<section class="box" data-paint="grey-80" data-gap="lg">
		<p>Past the middle of the scale the words flip to the page surface. This is grey-80, a dark panel on a light page and a pale one on a dark page.</p>
	</section>
	<p data-text="grey-60">Muted words, with no background painted at all.</p>
</div>
```

## Light and dark

Yeti declares `color-scheme: light dark` on the root, so the page follows the reader's setting and every color above resolves for the scheme in use. To force one, set `color-scheme: light` or `dark` on any element and everything below it flips: the hues, the page roles, the greys and the tones. Force it on the root to opt a whole site out of dark mode; force it on a section to keep a photograph's caption band dark on a light page.

```css
@layer yeti.theme {
	html { color-scheme: light; }
}
```

A page pinned to one scheme sets `color-scheme` on the root, and every color in Yeti follows because each is a `light-dark()` pair; `dark` pins it the other way.

Forcing a scheme on any other element flips the links, buttons and components below it, but the text color arrives inherited and already resolved, and nothing paints the element itself. A `box` with `data-surface` does both, so a band that is always dark needs only the scheme:

```html
<section class="box band" data-surface="base">…</section>
```

```css
.band { color-scheme: dark; }
```

Any other element says all three:

```css
.band {
	color-scheme: dark;
	background-color: var(--yeti-color-surface);
	color: var(--yeti-color-text);
}
```

Two things to know. The accent inputs, the five accent hues, the brand colors and `--yeti-chroma`, take effect only where the ladder is computed: on the root, and on an element marked `data-palette`, below. The neutral hue and its chroma, the page roles and the greys are worked out on the root alone. A derived color, `--yeti-color-primary` or `--yeti-color-surface`, can be set on any element, and every role that reads it there follows; the greys do not, because they were mixed at the root from the poles the root had. If a section needs its own greys, force its scheme rather than its surface.

## A palette for one part of a page

Every color is worked out once, on the root, so a hue or a brand color set on a section changes nothing inside it. Mark the section with `data-palette` and the colors are worked out again there. The color inputs set on that element, a brand color, a hue or `--yeti-chroma`, re-derive the five accent roles and their tones for everything inside it. The components follow with nothing else to set: `data-variant="primary"` inside the region is the region's primary, and so are its links and lines.

```html demo sm
<div class="stack" data-gap="md">
	<div class="cluster" data-gap="sm">
		<button class="button" type="button">The page</button>
		<button class="button" type="button" data-emphasis="medium">The page</button>
		<button class="button" type="button" data-emphasis="low">The page</button>
	</div>
	<section class="cluster" data-gap="sm" data-palette style="--yeti-brand-primary: #e4002b">
		<button class="button" type="button">A region</button>
		<button class="button" type="button" data-emphasis="medium">A region</button>
		<button class="button" type="button" data-emphasis="low">A region</button>
	</section>
</div>
```

A region inherits the page's inputs and changes only what it sets, so a region that sets `--yeti-brand-success` alone keeps the page's primary. Regions nest, and an inner region's colors stop at its edge. On a page with a brand color, a region goes back to the hue with `--yeti-brand-primary: initial`. A bare form control inside a region, a checkbox or a range with no class, takes the region's primary.

A region changes the accents and nothing else:

- The neutral role, the greys and the page surfaces stay the page's. For a darker section, force its scheme, as above.
- The focus ring stays the page's, so it looks the same everywhere on the page.
- A step set directly on the root, `--yeti-color-primary: #0a7`, does not reach a region, because the region works every step out again from the inputs. Give the color as an input instead, a hue or a brand color, which does reach a region, or set the step on the region too.

A section without `data-palette` can still set a derived color on itself, and what reads it there follows. One limit: when the page has a brand color, a section that sets only `--yeti-color-primary` does not recolor its links and lines, because the page's line step still has a value and they read that first. Such a section sets `--yeti-color-primary-line` too, or uses `data-palette` with a brand color of its own.

## In your own CSS

Every color on this page is a public token, and a class of your own can read any of them: the ladder steps, the page roles, `--yeti-white`, `--yeti-black` and `--yeti-grey`, the greyscale `--yeti-grey-0` to `--yeti-grey-100`, and the same eleven steps at every hue, `--yeti-color-primary-0` to `--yeti-color-primary-100` and so on for the other five. A tone sits at exactly the lightness of the grey with its number, so a hued panel and its text can be picked from opposite ends of one scale:

```css
.promo {
	background-color: var(--yeti-color-primary-20);
	color: var(--yeti-color-primary-90);
}
```

That pair flips with the scheme, follows the brand hue, and keeps its contrast, because the two numbers are seventy steps apart on the same ladder. The [tokens page](../tokens.md) lists every name with its default; the [theming guide](theming.md) says how to move the inputs they all derive from.
