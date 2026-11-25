---
raw: true
title: "Color"
description: "How color works in Yeti and how to use it: six hues and a ladder, text that reads on every one of them, the same six words as status on a component, a color by name on anything, a greyscale that flips with the scheme, and the tokens behind all of it."
nav_group: "Guides"
nav_order: 8
---

# Color

<p class="lede">Color in Yeti is six words and a distance. A hue has a name, <code>primary</code> or <code>warning</code>, and the same name means the same thing on a badge, a button, an alert and a painted section. A grey has a number, how far it sits from the page toward the page's own text, and that number means the same thing in light mode and in dark. The browser picks the scheme; Yeti keeps every pair of colors readable in both. This page is how to use it. The <a href="theming.md">theming guide</a> is how to change it.</p>

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

These are promises, not intentions. The browser tests check them at every hue angle in steps of thirty degrees, in both schemes:

| Pair | Holds at least |
| --- | --- |
| page text on the page surface | 7:1 |
| muted text on the page surface | 4.5:1 |
| `on-` text on every base hue | 4.5:1 |
| `-text` of every hue on the page surface | 4.5:1 |
| page text on every `-subtle` tint | 7:1 |

A theme that sets a hue keeps every one of these, because the ladder is fixed and only the angle moved.

A brand color keeps its own set. The browser tests check these over a grid of brand colors from black to white, in both schemes:

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
