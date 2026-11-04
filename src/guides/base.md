---
raw: true
title: "Base"
description: "Everything the stylesheet does to plain HTML before you write a single class: the type scale, the flow rhythm, the quiet form controls, and the reset under all of it."
nav_group: "Guides"
nav_order: 2
---

# Base

<p class="lede">The base is the one layer that is not opt-in. It styles plain HTML the moment the stylesheet loads, and never with a class, and all but a couple of measurements it draws are tokens, so a theme changes the look of bare HTML without touching a line of markup.</p>

That is the whole bargain. A page of headings, paragraphs, lists, a table and a form, with no Yeti class anywhere in it, comes out looking designed. Add a class and you are choosing something more; add none and nothing is broken.

## How to read this page

Each section below shows the markup live, then the same markup once as a code block. The live sample sits in `<section class="box" data-border>` so you can see where it starts and stops. That wrapper is the only Yeti class in any sample on this page, it is there for the border, and everything inside it is bare HTML. The `section` element is deliberate too: it is one of the elements the flow rhythm treats as a container, which the [Flow](#flow) section explains.

Each section ends with the public tokens its rules read, copied from the CSS by hand. The base has no manifests, so this page's prose and token lists are written by hand in `src/guides/base.md` and checked by a human rather than generated from a manifest.

## Type

<section class="box" data-border>
	<h1>A page with no classes</h1>
	<h2>A second-level heading</h2>
	<h3>A third-level heading</h3>
	<h4>A fourth</h4>
	<h5>A fifth, the size of body text</h5>
	<h6>A sixth, one step smaller</h6>
	<p>Running text sits at the body size on the body leading, and wraps with <code>text-wrap: pretty</code>, so a paragraph is never left with one word on its last line. A <a href="#type">link</a> takes the primary color and an underline that skips the descenders, and it deepens to the strong step of the same hue on hover.</p>
	<p><strong>Strong text</strong> takes the bold weight, and <small>small text</small> takes one step down the scale.</p>
</section>

```html
<section class="box" data-border>
	<h1>A page with no classes</h1>
	<h2>A second-level heading</h2>
	<h3>A third-level heading</h3>
	<h4>A fourth</h4>
	<h5>A fifth, the size of body text</h5>
	<h6>A sixth, one step smaller</h6>
	<p>Running text sits at the body size on the body leading, and wraps with <code>text-wrap: pretty</code>, so a paragraph is never left with one word on its last line. A <a href="#type">link</a> takes the primary color and an underline that skips the descenders, and it deepens to the strong step of the same hue on hover.</p>
	<p><strong>Strong text</strong> takes the bold weight, and <small>small text</small> takes one step down the scale.</p>
</section>
```

Headings take the type scale by level, and the only thing that differs from one level to the next is the size: `h1` is `--yeti-text-3xl`, `h2` is `2xl`, `h3` is `xl`, `h4` is `lg`, `h5` is `md` — the same size as body text — and `h6` is `sm`, one step below it. Everything else about a heading is shared: the bold weight, the tight leading, and `text-wrap: balance` so a two-line headline breaks evenly. Hierarchy is therefore one token change away, because the steps are the same progression space uses; retune `--yeti-base` or `--yeti-ratio` and the headings move with the gaps between them rather than drifting apart from them. See the [theming guide](theming.md) for the two inputs.

The font family, the text color and the page background are set on `html`; the size and leading are set on `body` rather than on `html`, so `rem` keeps the visitor's own root default and every `rem`-based token resolves the same on every element.

Prose is also held to a measure. `p`, `li`, `dd`, `dt`, `blockquote`, `figcaption` and every heading get `max-inline-size: var(--yeti-measure)`, 70ch by default. `pre` and `table` are not in that list, because code and data are read by scanning across rather than by returning to a left margin.

**Tokens:** `--yeti-font-sans`, `--yeti-font-heading`, `--yeti-color-text`, `--yeti-color-surface`, `--yeti-text-md`, `--yeti-leading-md`, `--yeti-text-sm`, `--yeti-text-lg`, `--yeti-text-xl`, `--yeti-text-2xl`, `--yeti-text-3xl`, `--yeti-weight-heading`, `--yeti-weight-bold`, `--yeti-leading-tight`, `--yeti-measure`, `--yeti-color-primary`, `--yeti-color-primary-strong`, `--yeti-color-primary-subtle` (the selection highlight).

## Flow

<section class="box" data-border>
	<h2>A heading hugs what follows it</h2>
	<p>This paragraph sits a small step under its heading, because a heading and the thing it names are one unit and should read as one.</p>
	<p>This one sits a medium step under the paragraph above it. That is the default rhythm between any two siblings in flow.</p>
	<h3>A heading after content opens up</h3>
	<p>An <code>h2</code> or an <code>h3</code> that follows something which is not itself a heading gets an extra-large step above it, so a new section is visibly a new section.</p>
	<ul>
		<li>A prose list keeps its markers and gets an indent.</li>
		<li>Between one item and the next is a hair, not a gap.</li>
		<li>A list is meant to read denser than paragraphs.</li>
	</ul>
</section>

```html
<section class="box" data-border>
	<h2>A heading hugs what follows it</h2>
	<p>This paragraph sits a small step under its heading, because a heading and the thing it names are one unit and should read as one.</p>
	<p>This one sits a medium step under the paragraph above it. That is the default rhythm between any two siblings in flow.</p>
	<h3>A heading after content opens up</h3>
	<p>An <code>h2</code> or an <code>h3</code> that follows something which is not itself a heading gets an extra-large step above it, so a new section is visibly a new section.</p>
	<ul>
		<li>A prose list keeps its markers and gets an indent.</li>
		<li>Between one item and the next is a hair, not a gap.</li>
		<li>A list is meant to read denser than paragraphs.</li>
	</ul>
</section>
```

The container owns the space between its children, and the children carry no margins of their own. That is the same rule every layout in Yeti follows — a `stack` owns its gap, a `cluster` owns its gap — and the base is where it starts, so an unclassed page and a classed one are spaced by the same idea.

Three rules do it, and all three are scoped to the **direct children of a flow container**, so nothing nested in a layout is reached:

- `> * + *` gets `--yeti-space-md`. That is the default.
- `> :is(h1, h2, h3, h4, h5, h6) + *` gets `--yeti-heading-space-after` instead, `--yeti-space-sm` by default. A heading hugs what follows it.
- `> :not(h1, h2, h3, h4, h5, h6) + :is(h2, h3)` gets `--yeti-heading-space-before`, `--yeti-space-xl` by default. A major heading opens up from the content before it.

The two heading tokens are the ones to reach for when a design wants more air between sections: set them on `:root` for the whole site, or on one `article` for one long read, and nothing else that uses the space scale moves. A `breakout` reads the same two.

A flow container is one of `body`, `main`, `article`, `section`, `aside`, `header`, `footer`, `blockquote`, `figure`, `dd`, `li`, `details`, `fieldset` and `dialog`. The third rule leaves `dialog` out, because a dialog is short and its heading is its first child anyway. An `li` counts only in a prose list: an item of a list marked `role="list"` is layout, usually a row of an icon and a label, and its children get no flow spacing. A nested prose list, two paragraphs in one item, keeps its rhythm.

Two omissions are deliberate. `div` is not a flow container: a `div` is the element you reach for when you want a box and no opinions, and a box with a rhythm is an opinion. `dl` is not one either, for the reason the [Definitions](#definitions) section gives. And `form` is not one, because a real form is laid out with `stack` and `field` rather than by the base — see the [components guide](components.md#forms-without-javascript).

A prose list — one without `role="list"` on it — gets an indent of `--yeti-space-lg` and `--yeti-list-gap` between items. That gap is `0.25rem` and is not on the space scale on purpose: the scale is geometric and tied to the type steps, and its smallest step is already about two thirds of a line, which would space list items like short paragraphs.

**Tokens:** `--yeti-space-md`, `--yeti-space-lg`, `--yeti-heading-space-before`, `--yeti-heading-space-after`, `--yeti-list-gap`.

## Definitions

<section class="box" data-border>
	<dl>
		<dt>Layout</dt>
		<dd>A class that arranges its children and owns the gaps between them.</dd>
		<dt>Component</dt>
		<dd>A class with a look of its own and a manifest that describes it.</dd>
	</dl>
	<dl>
		<div><dt>Token</dt><dd>A custom property a theme may set.</dd></div>
		<div><dt>Marker</dt><dd>A bare attribute a parent reads.</dd></div>
	</dl>
</section>

```html
<section class="box" data-border>
	<dl>
		<dt>Layout</dt>
		<dd>A class that arranges its children and owns the gaps between them.</dd>
		<dt>Component</dt>
		<dd>A class with a look of its own and a manifest that describes it.</dd>
	</dl>
	<dl>
		<div><dt>Token</dt><dd>A custom property a theme may set.</dd></div>
		<div><dt>Marker</dt><dd>A bare attribute a parent reads.</dd></div>
	</dl>
</section>
```

A term takes the strong weight and its definition is indented by `--yeti-space-md`. The space goes **between pairs** and not between every line, which is why `dl` is kept out of the flow-container list above: a term and its definition are one thing, and the generic `> * + *` rule would have pushed them apart. Instead `dl > dt:not(:first-child)` gets `--yeti-space-sm`, which puts the space above every term except the first.

HTML allows a second shape for the same list, with each pair wrapped in a `div` — that is what the second list above is — and there the term is no longer a child of the `dl`, so the rule above cannot see it. `dl > div + div` carries the same `--yeti-space-sm` for that form. Both are shown because both are legal and a page will meet both.

The `div` shape is also what a [`leaders`](../leaders.md) list uses for a name, a dotted line and a price.

**Tokens:** `--yeti-weight-strong`, `--yeti-space-sm`, `--yeti-space-md`.

## Quotes and captions

<section class="box" data-border>
	<blockquote>
		<p>Everything should be made as simple as possible, but no simpler.</p>
	</blockquote>
	<figure>
		<blockquote>
			<p>A design is finished not when there is nothing left to add, but when there is nothing left to take away.</p>
		</blockquote>
		<figcaption>Antoine de Saint-Exupéry</figcaption>
	</figure>
	<figure>
		<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='600' viewBox='0 0 1200 600'%3E%3Crect width='1200' height='600' fill='%23cbd5e1'/%3E%3Ctext x='600' y='300' font-family='system-ui, sans-serif' font-size='64' fill='%23334155' text-anchor='middle' dominant-baseline='middle'%3E1200 %C3%97 600%3C/text%3E%3C/svg%3E" alt="">
		<figcaption>A caption under a picture stays a caption, with no dash in front of it.</figcaption>
	</figure>
</section>

```html
<section class="box" data-border>
	<blockquote>
		<p>Everything should be made as simple as possible, but no simpler.</p>
	</blockquote>
	<figure>
		<blockquote>
			<p>A design is finished not when there is nothing left to add, but when there is nothing left to take away.</p>
		</blockquote>
		<figcaption>Antoine de Saint-Exupéry</figcaption>
	</figure>
	<figure>
		<img src="…" alt="">
		<figcaption>A caption under a picture stays a caption, with no dash in front of it.</figcaption>
	</figure>
</section>
```

A quotation is set off by a rule on its leading edge and padded away from it. The rule is four pixels in `--yeti-color-border-strong`, the emphasised border rather than the divider one, because it is a mark and not a hairline; the four is a literal in the CSS and not a token, which is the one measurement in this group a theme cannot move.

A caption under a quotation is an attribution, and the dash is what says so. It is generated only for `figure > blockquote + figcaption`, never for a caption under a picture, and it carries empty alternative text — `content: "— " / ""` — so a screen reader announces the name and not the dash. Both kinds of caption share the small size and the muted color.

**Tokens:** `--yeti-text-sm`, `--yeti-color-text-muted`, `--yeti-space-md`, `--yeti-color-border-strong`.

## Code

<section class="box" data-border>
	<p>Inline <code>--yeti-space-md</code>, a key like <kbd>Esc</kbd>, and a program's output like <samp>validate: ok (49 components)</samp> all share one face.</p>
	<pre><code>@layer yeti.reset, yeti.base, yeti.theme, yeti.layouts, yeti.components, yeti.utilities;</code></pre>
</section>

```html
<section class="box" data-border>
	<p>Inline <code>--yeti-space-md</code>, a key like <kbd>Esc</kbd>, and a program's output like <samp>validate: ok (49 components)</samp> all share one face.</p>
	<pre><code>@layer yeti.reset, yeti.base, yeti.theme, yeti.layouts, yeti.components, yeti.utilities;</code></pre>
</section>
```

`code`, `kbd` and `samp` are three different meanings with one look: the mono family, a slight tint of the raised surface, a small radius, and `0.9em` so a snippet sits level with the text around it at any size. The padding is in `em` for the same reason. A block of code takes the same family and tint at the medium radius, with the space token for padding and `overflow-x: auto` so a long line scrolls inside the block rather than widening the page.

A block's leading is `--yeti-leading-sm`, a plain ratio, where running text uses `--yeti-leading-md`, which adds a constant to one em. The constant is what keeps text tight as it grows; below body size it works the other way and loosens instead, so a code block set at `0.9em` on the body formula comes out near 1.66 and reads airy. A ratio keeps it even.

`pre code` un-does the inline treatment — no padding, no radius, transparent, and the inherited size — so a `code` inside a `pre` does not draw a second box inside the first.

**Tokens:** `--yeti-font-mono`, `--yeti-color-surface-raised`, `--yeti-radius-sm`, `--yeti-radius-md`, `--yeti-leading-sm`, `--yeti-space-md`.

## Rules and disclosures

<section class="box" data-border>
	<p>A horizontal rule is one line in the border color and nothing else: no height, no shading, no margin of its own.</p>
	<hr>
	<details>
		<summary>What the base layer dresses</summary>
		<p>A summary in the strong weight, a chevron at the end that turns when the panel opens, and a panel that grows rather than appearing.</p>
	</details>
	<details name="base-guide" open>
		<summary>An open one, in a named set</summary>
		<p>The chevron points up. Give every <code>details</code> in a set the same <code>name</code> attribute and the browser closes the others for you.</p>
	</details>
	<details name="base-guide">
		<summary>And its neighbour</summary>
		<p>Opening this one shuts the one above it, with nothing from Yeti and no script at all.</p>
	</details>
</section>

```html
<section class="box" data-border>
	<p>A horizontal rule is one line in the border color and nothing else: no height, no shading, no margin of its own.</p>
	<hr>
	<details>
		<summary>What the base layer dresses</summary>
		<p>A summary in the strong weight, a chevron at the end that turns when the panel opens, and a panel that grows rather than appearing.</p>
	</details>
	<details name="base-guide" open>
		<summary>An open one, in a named set</summary>
		<p>The chevron points up. Give every <code>details</code> in a set the same <code>name</code> attribute and the browser closes the others for you.</p>
	</details>
	<details name="base-guide">
		<summary>And its neighbour</summary>
		<p>Opening this one shuts the one above it, with nothing from Yeti and no script at all.</p>
	</details>
</section>
```

An `hr` is stripped to a single logical border on its leading edge, drawn at `--yeti-border-width` in `--yeti-color-border`. The space above and below it comes from the flow rhythm like any other sibling's, not from the rule itself.

The disclosure lives in the base, and that is a decision rather than an accident. `details` and `summary` already open, close, take the keyboard and announce their state, so all that is ever left is the look — and if the look lived in the accordion component, a lone `details` on an unclassed page would be the one element in Yeti that came out raw. So the base draws it: the summary as a flex row in the strong weight with the browser's marker replaced by a chevron built from two borders on a turned square, and the panel on a grid row that animates from `0fr` to `1fr`, because a `details` cannot animate its own height to `auto` in every engine but a grid row measured in `fr` can. The rows are packed to the start so the summary takes no part in the interpolation and only the panel moves.

The [accordion](../accordion.md) then adds only what turns a column of disclosures into one object: the border around the set, the line between rows, the summary's own surface, and the padding that goes with them. Nothing in it re-draws the chevron or the animation.

Both durations here are tokens, and that is what honours a reader who asked for less motion: a rule in the base layer outranks the reset's universal `prefers-reduced-motion` rule, so the collapse has to come through the value, not the selector. The [animations guide](animations.md) has the whole argument.

**Tokens:** `--yeti-border-width`, `--yeti-color-border`, `--yeti-space-sm`, `--yeti-weight-strong`, `--yeti-duration-fast`, `--yeti-duration-base`, `--yeti-ease`.

## Forms

<section class="box" data-border>
	<form>
		<fieldset>
			<legend>Your details</legend>
			<label for="base-name">Name</label>
			<input id="base-name" type="text" placeholder="Ada Lovelace">
			<label for="base-notes">Notes</label>
			<textarea id="base-notes"></textarea>
			<label for="base-pick">Pick one</label>
			<select id="base-pick"><option>Summit</option><option>Ridge</option></select>
			<label for="base-off">Unavailable</label>
			<input id="base-off" type="text" value="Not today" disabled>
			<p><button type="submit">Submit</button> <input type="submit" value="A submit input"> <button type="button" disabled>Disabled</button></p>
		</fieldset>
	</form>
</section>

```html
<section class="box" data-border>
	<form>
		<fieldset>
			<legend>Your details</legend>
			<label for="base-name">Name</label>
			<input id="base-name" type="text" placeholder="Ada Lovelace">
			<label for="base-notes">Notes</label>
			<textarea id="base-notes"></textarea>
			<label for="base-pick">Pick one</label>
			<select id="base-pick"><option>Summit</option><option>Ridge</option></select>
			<label for="base-off">Unavailable</label>
			<input id="base-off" type="text" value="Not today" disabled>
			<p><button type="submit">Submit</button> <input type="submit" value="A submit input"> <button type="button" disabled>Disabled</button></p>
		</fieldset>
	</form>
</section>
```

A `label` and a `legend` are blocks in the strong weight, so a label always sits above its control. A `fieldset` is a padded, bordered group; it is also one of the flow containers, which is why the controls inside it are spaced and why everything in the sample above is inside it — a `form` itself is **not** a flow container, because a real form's spacing belongs to `stack` and `field` rather than to the base.

A native control's own colours follow the palette too: a bare checkbox or radio's fill, a range thumb, and a progress bar take the primary, through `accent-color` set once on the root — so a section that changes its own primary hue recolours its text and buttons but not a bare native control, which keeps the root's. The caret is left to follow the text it sits in instead, which is what a dark band or a forced-dark section needs.

Text-like inputs, `select` and `textarea` fill their container's width and take a hairline border in `--yeti-color-border` with the small radius. The selector deliberately excludes `checkbox`, `radio`, `range`, `color`, `submit`, `button`, `reset`, `file` and `image`, all of which are the wrong shape for a full-width box. A `textarea` gets `min-block-size: 4lh` and vertical resizing, and where the engine supports `field-sizing: content` — a `@supports` guard in the reset — it grows with what is typed.

Buttons, and the three input types that act as buttons, take the same padding and border on the raised surface with `cursor: default`. Anything disabled drops to `--yeti-opacity-muted`.

Say it plainly: this is a reset with manners, not a design. `input`, `select` and `button` come out tidy here and take their real face from the components. A [field](../field.md) gives a control the control-sized target, the `--yeti-control-border` color that clears 3:1 against the surface, the checkbox and radio and switch and range faces, the hint, and the error that appears on `:user-invalid`. A [button](../button.md) gives an action a hue from `data-variant`, a loudness from `data-emphasis`, a size from `data-size`, and `cursor: pointer` in place of the base's `default`. Neither is needed for a page to be usable; both are needed for it to look decided.

**Tokens:** `--yeti-weight-strong`, `--yeti-space-xs`, `--yeti-space-sm`, `--yeti-space-md`, `--yeti-border-width`, `--yeti-color-border`, `--yeti-radius-sm`, `--yeti-color-surface`, `--yeti-color-surface-raised`, `--yeti-opacity-muted`.

## Tables

<section class="box" data-border>
	<table>
		<caption>Steps on the scale</caption>
		<thead>
			<tr><th scope="col">Name</th><th scope="col">Where it sits</th></tr>
		</thead>
		<tbody>
			<tr><th scope="row">sm</th><td>one step below the base</td></tr>
			<tr><th scope="row">md</th><td>the base itself</td></tr>
			<tr><th scope="row">lg</th><td>one step above the base</td></tr>
		</tbody>
	</table>
</section>

```html
<section class="box" data-border>
	<table>
		<caption>Steps on the scale</caption>
		<thead>
			<tr><th scope="col">Name</th><th scope="col">Where it sits</th></tr>
		</thead>
		<tbody>
			<tr><th scope="row">sm</th><td>one step below the base</td></tr>
			<tr><th scope="row">md</th><td>the base itself</td></tr>
			<tr><th scope="row">lg</th><td>one step above the base</td></tr>
		</tbody>
	</table>
</section>
```

A table fills its container. The reset collapses its borders and zeroes the spacing first, so one border token draws a grid rather than a double line at every join. A `caption` is small, muted and start-aligned, because a caption above a table is a label and not a title. A `th` takes the bold weight and start alignment, undoing the centring and the browser's own bold. Every cell gets `--yeti-space-sm` of padding and a line under it in `--yeti-color-border` — that line is a literal `1px` in the CSS rather than `--yeti-border-width`, the one place in this group a theme cannot retune.

The [table](../table.md) component adds what the base has no business assuming: a size step that scales text and padding together, stripes, a hover tint, an outer border, and end-aligned tabular figures for a column of numbers. It never changes the table's shape at any width, because a table that becomes stacked cards breaks the row-and-column relationships a screen reader depends on.

**Tokens:** `--yeti-text-sm`, `--yeti-color-text-muted`, `--yeti-weight-bold`, `--yeti-space-sm`, `--yeti-color-border`.

## The reset

<section class="box" data-border>
	<p>Water is H<sub>2</sub>O, and the line it sits on is no taller for it<sup>1</sup>.</p>
	<p hidden>This paragraph carries the hidden attribute, so it is not here at all.</p>
	<ul role="list">
		<li>A list marked <code>role="list"</code> is layout: it loses its markers and its indent.</li>
		<li>A list without it is prose and keeps both.</li>
	</ul>
	<p><button type="button">A focusable control</button> — press Tab to reach it and see the ring every focusable element gets.</p>
	<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='600' viewBox='0 0 1200 600'%3E%3Crect width='1200' height='600' fill='%23cbd5e1'/%3E%3Ctext x='600' y='300' font-family='system-ui, sans-serif' font-size='64' fill='%23334155' text-anchor='middle' dominant-baseline='middle'%3E1200 %C3%97 600%3C/text%3E%3C/svg%3E" alt="">
</section>

```html
<section class="box" data-border>
	<p>Water is H<sub>2</sub>O, and the line it sits on is no taller for it<sup>1</sup>.</p>
	<p hidden>This paragraph carries the hidden attribute, so it is not here at all.</p>
	<ul role="list">
		<li>A list marked <code>role="list"</code> is layout: it loses its markers and its indent.</li>
		<li>A list without it is prose and keeps both.</li>
	</ul>
	<p><button type="button">A focusable control</button> — press Tab to reach it and see the ring every focusable element gets.</p>
	<img src="…" alt="">
</section>
```

The reset is the sublayer under the base, and it is protective rather than opinionated: every rule in it undoes a surprising or inconsistent user-agent default, and it reads **no token at all**, which is what makes it the one file in Yeti you can swap out whole.

- **Box sizing** includes padding and border, on every element and both generated boxes, because that is what everyone means by width.
- **Margins start at zero** on everything except `dialog`, whose native centring depends on its own margins. Space belongs to containers, which is the rule the [Flow](#flow) section is the first instance of.
- **Media are blocks** that never overflow: `img`, `picture`, `video`, `canvas` and `svg` get `display: block`, `max-inline-size: 100%` and `block-size: auto`, so an image is fluid and never stretched.
- **Form controls inherit** the font, the color and the letter spacing instead of taking the platform's own, and a handful of WebKit-only control pseudo-elements are normalised with them.
- **`sub` and `sup`** are set at 75% with a zeroed line height and shifted with `inset-block-start`, so a footnote marker never opens up the line it sits on.
- **Tables collapse** their borders and zero their spacing, so one border token draws a grid.
- **`[hidden]` wins over everything.** `[hidden] { display: none !important }` is the single `!important` in the whole framework, and the validator enforces that it stays single. Without it a component's own `display` would outrank the attribute, and `hidden` would silently stop working on a `card` or a `nav` item.
- **A list keeps its markers** unless the author says the list is decorative with `role="list"`, which is the sign every list-shaped component carries.

Two things in this group are base rules rather than reset rules, because they read tokens:

- **The focus ring.** `:focus-visible` gets `outline: 2px solid var(--yeti-color-focus)` with a 2px offset, in `src/base/typography.css`. Every focusable element on the page gets it and no component takes it away; a component that clips its corners moves the offset inside instead of removing the ring.
- **The selection highlight** takes `--yeti-color-primary-subtle`.

**Motion** is the one place the reset deliberately cannot reach far. Its `prefers-reduced-motion: reduce` rule collapses animation and transition durations on `*`, but a declaration in the components layer outranks a universal one in the reset, so that rule only catches animation the browser or a third party brought. Yeti's own motion collapses through `--yeti-duration-fast`, `--yeti-duration-base` and `--yeti-motion-iterations` instead, which is why every duration in a component is a token. Durations collapse; end states still apply. Page transitions are the same story once more: `src/base/transitions.css` re-times the browser's own cross-document crossfade onto `--yeti-page-duration` and `--yeti-page-ease` — it does not turn the feature on, which is one rule you write yourself. The [animations guide](animations.md) has all of it.

One reset rule is an opt-in rather than a normalisation: where the engine supports `interpolate-size: allow-keywords`, and only for a reader who has not asked for reduced motion, `:root` takes it, so a height can animate to and from `auto`.

**Tokens:** the reset reads none. The two base rules quoted here read `--yeti-color-focus` and `--yeti-color-primary-subtle`; the motion collapse reads `--yeti-duration-fast`, `--yeti-duration-base`, `--yeti-motion-iterations` and `--yeti-page-duration`.

## The skip link

One base rule is a convention rather than an element. The first link in the body, if it points at a fragment of the same page, is treated as a skip link: it is hidden by the clip-rect recipe — out of sight, still in the accessibility tree, still in Tab order — until it takes focus, at which point it becomes a small box pinned at the top start corner of the window, above any sticky bar, with the focus ring on it. There is no class to remember, because that is where a skip link goes anyway; the cost runs the other way, and a body whose first link is a fragment link but not a skip link will find it invisible until someone focuses it.

There is no live sample here, and there cannot be: the rule is `body > a[href^="#"]:first-child`, and a link in the middle of a page is by definition not the first child of the body. The [visibility guide](visibility.md#the-skip-link) owns the subject, with the markup, the Foundation 6 name for it, and the eight other ways to hide something beside it.

**Tokens:** `--yeti-space-sm`, `--yeti-space-md`, `--yeti-radius-sm`, `--yeti-color-surface-raised`, `--yeti-color-text`, `--yeti-color-focus` (the ring).

## What the base leaves alone

Every claim below was checked against the CSS rather than remembered.

**Lists keep their markers.** No rule in the base touches the markers on a prose list, and the only list that loses its bullets is one the author marked `role="list"`. What the base does add to a prose list is an indent of `--yeti-space-lg` and `--yeti-list-gap` between items — that is all.

**A bare `button` is not faceless, but it has no opinions.** The base gives it the same hairline border, small radius, raised fill and `xs`/`sm` padding it gives a text input, plus `cursor: default`: tidy, undesigned, obviously a control. What it does not have is a hue, a loudness, a size step, a minimum target height, or `cursor: pointer`. Those arrive with the [button](../button.md) class, and until then a form still works and still looks deliberate.

**An image is fluid and unframed.** The reset makes it a block that never overflows its container and keeps its own ratio. No border, no radius, no crop, no aspect ratio, no object fit. When images of unpredictable shape must present as the same shape, that is [frame](../frame.md).

**Almost nothing is positioned.** Three rules in the whole base use `position`, and they are all named on this page: `sub` and `sup` take `position: relative` to shift off the baseline, and the skip link takes `absolute` while it is hidden and `fixed` with `z-index: 3` while it is focused. Nothing floats, nothing is sticky, and no other rule in the base sets a `z-index`.

**No font is loaded and no color is guessed.** `--yeti-font-sans` is `system-ui, sans-serif` and `--yeti-font-mono` is `ui-monospace, monospace`; there is no `@font-face` anywhere in Yeti. There is no `:visited` style, no `text-transform`, no letter spacing, and no color on a heading beyond the inherited text color.

**No element sets its own outer margin.** Every margin the base adds is between two siblings inside a flow container, plus the `dd` indent and the space above a definition term or a wrapped pair. Take the surrounding container away and every element in the base collapses back to zero.

**And nothing in the base is a class.** Element selectors, attribute selectors and pseudo-classes only. If you find a base rule you disagree with, you can outrank it with one unlayered declaration of your own, because everything here lives in `yeti.reset` and `yeti.base`, the two lowest sublayers, and plain unlayered CSS beats all of them.
