---
raw: true
title: "Layouts"
description: "Eighteen intrinsic layouts that respond to their container, one attribute vocabulary, and the responsive model behind them."
nav_group: "Guides"
nav_order: 3
---

# Layouts

<p class="lede">Layouts are Yeti's grammar. A layout is a class that arranges its own children and owns the space between them. Children never carry their own margins; the layout that holds them decides the gap.</p>

## Three tools, in this order

Yeti has three ways to make a page respond to its context, and they apply in a fixed order.

Intrinsic layouts come first. The eighteen on this page arrange their children by reading their own width, not the viewport's. A `sidebar` drops to a stack when it runs low on room, wherever on the page it sits and whatever else is happening at the edge of the browser window. Reach for one of these before reaching for anything else.

Container queries come second. They let a single component change shape based on the width of the box that holds it rather than the window: a card that goes from one column to two once its own container is wide enough, in a sidebar or in a full-width section alike. These arrive in phase 3. A Yeti layout may query itself and change its children, never itself; the thresholds are the width tokens' defaults, written as numbers because a container condition cannot read a token. When something must change its own shape, put it in a `container` and query that.

Media queries come last, if at all. They read the viewport itself, or a visitor's stated preferences: color scheme, reduced motion, print. Those are the right job for a media query. Layout is not, because a rule that switches at a viewport width breaks the moment its element moves into a narrower or wider container than the one it was tuned for.

Nothing under `src/layouts/` contains a media query, and the validator refuses one there.

## Why columns has a threshold, not a breakpoint

`columns` takes a `data-threshold`, not a breakpoint, and the difference shows as soon as the same markup moves.

Put a `columns` inside a `sidebar`'s content side, and it never sees the full viewport: the sidebar has already taken some of the width for itself. The columns still switch to rows at their own threshold, measured against their own container, so they can be stacked as rows while the page around them is wide open. Put the identical `columns` markup in a full-width section instead, and it switches at a much wider viewport, because its container is wider. Same markup, same threshold, two different viewport widths, because a threshold reads the box the element is in, not the window.

```html demo md lg
<div class="sidebar" data-side="start" data-width="xs">
	<nav aria-label="Section">
		<a href="#">Overview</a>
	</nav>
	<div class="columns" data-threshold="sm">
		<section>
			<h2>Plan</h2>
			<p>Three equal columns once the content column is wide enough.</p>
		</section>
		<section>
			<h2>Build</h2>
			<p>Two rows once it is not, regardless of the viewport.</p>
		</section>
	</div>
</div>
```

Four across, two by two, one is the same question with an extra step, and the answer is `grid` with `data-fold`, not a longer chain of thresholds: `data-min="xs" data-columns="4" data-fold` halves the column count as its own content box narrows — four, then two, then one — and never passes through three. The no-query alternative is two `columns` nested inside a third:

```html demo sm md
<div class="columns" data-threshold="md">
	<div class="columns" data-threshold="sm"><div>One</div><div>Two</div></div>
	<div class="columns" data-threshold="sm"><div>Three</div><div>Four</div></div>
</div>
```

When the cells are not alike and their places are chosen, as on an exhibition wall with a deliberate empty bay, `grid` with `data-tracks` gives a fixed number of tracks and each child a `data-start` line and a `data-span`, and still falls to one column in source order below its `data-threshold`.

The [responsive guide](responsive.md) takes this idea through the whole framework.

## The vocabulary

Every layout is configured with a small set of `data-*` attributes, drawn from a shared list of values.

<!-- yeti:attributes:start -->

<div class="scroller" role="region" aria-label="Layout attributes" tabindex="0" markdown="1">

| Attribute | Values | Read by |
| --- | --- | --- |
| `data-align` | `start`, `center`, `end`, `stretch`, `baseline` | cluster, columns, grid, hero, icon, layer, media, sidebar, stack |
| `data-align-self` | `start`, `center`, `end`, `stretch`, `baseline` | layer (> *) |
| `data-alternate` | boolean | timeline |
| `data-bleed` | boolean | breakout (> *) |
| `data-border` | boolean | box |
| `data-center` | boolean | cover (> *) |
| `data-columns` | `1`, `2`, `3`, `4`, `5`, `6` | columns, grid, masonry |
| `data-fill` | boolean | overlay (> [data-over]), stack |
| `data-fixed` | boolean | overlay |
| `data-fold` | boolean | grid |
| `data-gap` | `none`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `xs-sm`, `xs-md`, `xs-lg`, `xs-xl`, `xs-2xl`, `xs-3xl`, `xs-4xl`, `sm-md`, `sm-lg`, `sm-xl`, `sm-2xl`, `sm-3xl`, `sm-4xl`, `md-lg`, `md-xl`, `md-2xl`, `md-3xl`, `md-4xl`, `lg-xl`, `lg-2xl`, `lg-3xl`, `lg-4xl`, `xl-2xl`, `xl-3xl`, `xl-4xl`, `2xl-3xl`, `2xl-4xl`, `3xl-4xl` | box, breakout, center, cluster, columns, cover, grid, hero, icon, masonry, media, overlay, scroller, shell, sidebar, stack, timeline |
| `data-hide` | `3xs`, `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` | container (*) |
| `data-intrinsic` | boolean | center |
| `data-justify` | `start`, `center`, `end`, `between`, `around`, `evenly` | cluster, columns |
| `data-justify-self` | `start`, `center`, `end`, `stretch` | layer (> *) |
| `data-max` | `3xs`, `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` | breakout, center |
| `data-min` | `none`, `3xs`, `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` | grid, masonry |
| `data-note` | boolean | breakout (> *) |
| `data-over` | boolean | overlay (> *) |
| `data-ratio` | `1/1`, `4/3`, `3/2`, `16/9`, `21/9` | frame, hero, media |
| `data-rows` | `2`, `3`, `4`, `5`, `6` | grid |
| `data-show` | `3xs`, `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` | container (*) |
| `data-side` | `start`, `end` | hero, media, sidebar |
| `data-snap` | boolean | scroller |
| `data-shrink` | boolean | columns (> *) |
| `data-span` | `1`, `2`, `3`, `4`, `5`, `6` | columns (> *) |
| `data-split` | boolean | stack (> *) |
| `data-sticky` | boolean | shell (> div > :is(nav, aside)), sidebar (> *), stack (> *) |
| `data-surface` | `base`, `raised`, `sunken` | box |
| `data-threshold` | `3xs`, `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` | columns, hero |
| `data-width` | `3xs`, `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` | media, scroller, shell, sidebar |

</div>

<!-- yeti:attributes:end -->

A name in parentheses is the descendant that carries the attribute, not the layout itself: `layer (> *)` means a child of a `layer`. This table is generated from the manifests by `npm run docs`; the paragraphs around it are not.

Three names in the table are not layout at all and work on any element: `data-paint` and `data-text`, which the [color guide](color.md) covers, and `data-border`, which draws the border width in the border color. They are listed under the layout that introduced them, with `(*)` for where they apply; a fourth, `data-numeric`, which lines up digits with tabular figures, is in the [components guide](components.md)'s table. On a control the plain border color outranks the variant's, so `data-border` belongs on surfaces.

For the sizing attributes the mapping rule is always the same: a value is a token suffix. `data-gap="lg"` reads `--yeti-space-lg`; `data-width="sm"` reads `--yeti-width-sm`. The attribute names the property to set; the value names the step on Yeti's scale to set it to. The rest — `data-align`, `data-justify`, `data-ratio`, `data-columns`, `data-side` — name a behaviour rather than a token; `attributes.css` maps each value to the CSS keyword it means.

Gap alone also takes a fluid pair. `data-gap="sm-lg"` does not jump between the two: it runs from the `sm` stop at the narrow end of the viewport to the `lg` stop at the wide end, the same way the type scale itself is fluid. `none` never anchors a pair, so any smaller of the remaining eight sized stops can pair with any larger one, which is what makes twenty-eight pairs out of eight. The stops from `xl` to `4xl` are section room, two to sixteen times the body size, so a pair like `md-3xl` is the usual way to give the great parts of a page a gap that is modest on a phone and generous on a desk.

`data-sticky` is the odd one in the table. Every other name there sets a private property for a layout to read; this one sets two properties on the child itself, `position: sticky` and the offset. A third is needed in a row and only in a row: an item stretched to the full height of its row has nowhere left to move and never sticks, so `sidebar` and the `shell`'s body row take their sticky children out of that stretch in their own stylesheets. A `stack` stretches sideways instead, which costs a sticky child nothing, so a sticky child of a stack keeps the full width of the column. A sticky child also takes a stacking level above the page's own and above a card's controls, so it paints over the content that scrolls under it. A second token, `--yeti-scroll-padding`, sets the root's `scroll-padding-block-start` so a fragment jump or a focused control stops below the bar rather than behind it; it defaults to the sticky offset, so a page with a bar sets one number, and can be set alone for more room.

Type can answer a container too. The [billboard](../billboard.md) utility's `data-fit` names a pair of type steps and clamps a font size between them, reading `cqi` in between, so a headline is sized by the column it is in rather than by the window. It needs a size container above it, which is what `container` is for.

Two more names in the table belong to a container rather than to a layout. `data-show` and `data-hide` take a width from the same scale and mean the same direction as `data-threshold`: `data-show="md"` shows the element from `md` up, `data-hide="md"` removes it from `md` up. They measure the nearest size container, so the same markup decides differently in a sidebar and across a page, and outside a size container they do nothing at all. They are the last tool to reach for, not the first — a component that can change shape should — and the [visibility guide](visibility.md) says when the trade is worth it.

## The eighteen

- [stack](../stack.md): stacks its children vertically with one consistent gap between them.
- [cluster](../cluster.md): lays its children out in a row that wraps, keeping one gap between them on both axes.
- [sidebar](../sidebar.md): places a fixed-width sidebar beside flexible content, and stacks them when the content would drop below half the width.
- [columns](../columns.md): lays its children out as equal columns when the container is wider than a threshold, and as rows when it is not.
- [cover](../cover.md): fills at least the viewport's height and centers one child vertically, with optional content pinned above and below it.
- [grid](../grid.md): fits as many equal columns as the container allows at a minimum width, up to an optional maximum count.
- [frame](../frame.md): holds one child in a fixed aspect ratio, cropping media to fill it and centering anything else.
- [scroller](../scroller.md): lays its children out in a single row that scrolls horizontally.
- [overlay](../overlay.md): holds one child over the rest, centered, without pushing anything around; the parent is the box it covers.
- [box](../box.md): pads its content on all sides, with an optional border.
- [center](../center.md): centers a column of content horizontally, up to a maximum width, with gutters on narrow screens.
- [icon](../icon.md): sizes an inline SVG to the surrounding text and aligns it with the text beside it.
- [masonry](../masonry.md): packs items of uneven height into columns with no gaps under the short ones.
- [leaders](../leaders.md): joins a name and a value with a dotted line, for menus, price lists, hours and contents pages.
- [breakout](../breakout.md): keeps its children in a centered reading column with gutters, and lets any child carrying data-bleed span the full width.
- [layer](../layer.md): stacks its children in one box, later ones on top, with the box as tall as the tallest of them.
- [container](../container.md): makes its box the thing a container query measures, so what is inside can respond to its width instead of the viewport's.
- [timeline](../timeline.md): lays its entries along a rail with a marker each, on one side, or on alternate sides of a centred rail when it is wide.

## Fine-tuning spacing

Most of what version 6's margin and padding classes did was adjust a layout that already worked, and Yeti keeps those adjustments on the layout. Padding is a `box`: any element takes the class, `data-gap` pads all four sides, and `data-gap-inline` or `data-gap-block` pads one axis over that. Space between siblings is a `stack`'s gap, and the one child that needs more or less carries `data-space` with the gap it wants before it. There is no margin class, because a margin on an element is a decision the layout can no longer see; the same words, on the layout or its child, keep the rule and the exception in one place. And room that is about height rather than distance is not padding at all: a band that claims height is a `cover` with `data-height`, from a stop of the height scale to half or all of the viewport, with its content marked `data-center`. The height is a minimum, so the band grows if the content is taller.

```html demo md
<div class="stack" data-gap="sm">
	<p>A stack at a small gap.</p>
	<p>Its paragraphs sit close.</p>
	<h3 data-space="xl">A heading with room above it</h3>
	<p>Then back to the stack's own rhythm.</p>
	<div class="box" data-gap="sm" data-gap-inline="xl" data-surface="raised" data-border>A box padded a little top and bottom and a lot at the sides.</div>
</div>
```

## Composing

None of these layouts do much alone. Nest a few and they add up to a page.

A card: a bordered `box` holds a `stack`, which separates a cropped photo, a heading, and a paragraph at its own gap. The last child is a `cluster` of links carrying `data-split`, so it settles at the bottom of the card once the stack has more height than its content needs.

```html demo lg sm both
<div class="box" data-border>
	<div class="stack" data-gap="sm">
		<div class="frame" data-ratio="4/3">
			<img src="trail.jpg" alt="A mountain trail at dawn, cropped to four by three">
		</div>
		<h3>Weekend in the hills</h3>
		<p>Six miles, one summit, and a view worth the early start.</p>
		<nav class="cluster" data-gap="sm" data-split aria-label="Card actions">
			<a href="#">Read more</a>
			<a href="#">Share</a>
		</nav>
	</div>
</div>
```

**The most common compositions ship as recipes, one class each, and every recipe page shows the same result built from primitives so nothing is hidden:** [shell](../shell.md) (page skeleton with a sticky footer), [media](../media.md) (a figure beside text), [hero](../hero.md) (a split opening band). `dist/yeti.css` includes the recipes; a project that composes its own can import the `dist/css/` files it wants and leave `dist/css/recipes/` out.

A recipe still nests inside a primitive like anything else: a `grid` of three `media` items, each a figure and a caption.

```html demo lg xl
<ul class="grid" data-min="sm" data-columns="3" role="list">
	<li class="media" data-width="xs">
		<img src="trail.jpg" alt="A mountain trail at dawn">
		<div>
			<h3>Weekend in the hills</h3>
			<p>Six miles, one summit, and a view worth the early start.</p>
		</div>
	</li>
	<li class="media" data-width="xs">
		<img src="ada.jpg" alt="Portrait of Ada Lovelace">
		<div>
			<h3>Ada Lovelace</h3>
			<p>Wrote the first published algorithm, for Babbage's Analytical Engine.</p>
		</div>
	</li>
	<li class="media" data-width="xs">
		<img src="peak.jpg" alt="A snow ridge at first light">
		<div>
			<h3>First light on the ridge</h3>
			<p>The cloud broke just after dawn, for about ten minutes.</p>
		</div>
	</li>
</ul>
```

## Coming from version 6

The biggest habit to unlearn is thinking in breakpoints at all: Foundation 6's grid classes each encoded a viewport width chosen ahead of time, while Yeti's layouts read the width of the box they are placed in. The full map from every version 6 class to its Yeti equivalent is in the [migration guide](migrating.md).
