## When to use it

Use a cluster for a row of things that are sized by their content and may need to wrap: tags, buttons, navigation links, a logo beside a menu. When it wraps, the gap holds between rows as well as between items, so nothing needs a margin.

## How it works

A cluster is a wrapping flex row with a `gap`. `data-justify` distributes the items along the row, so `between` pushes the first and last to the edges, and `data-align` lines them up vertically within a row. Items keep their own width; a cluster never stretches them.

```html
<ul class="cluster" data-gap="xs" role="list">
	<li>css</li>
	<li>layout</li>
	<li>intrinsic</li>
</ul>
```

A term and its value on one line, parted to the two ends, is a cluster with `data-justify="between"`. A `div` may wrap a `dt` and its `dd`, so a whole legend is a `dl` that is a `stack` whose rows are clusters; add `data-rule` to the stack for a line between them and `data-numeric` to the values so the digits line up.

```html demo sm
<dl class="stack" data-gap="xs">
	<div class="cluster" data-justify="between"><dt>Distance</dt><dd data-numeric>14.2 km</dd></div>
	<div class="cluster" data-justify="between"><dt>Ascent</dt><dd data-numeric>1,120 m</dd></div>
	<div class="cluster" data-justify="between"><dt>Time</dt><dd data-numeric>5 h 30</dd></div>
</dl>
```

## A column when it is narrow

`data-threshold` takes a width, `3xs` to `2xl`, and turns the cluster into a column of full-width items whenever its own width is below that size; at or above it, the cluster is the wrapping row again. It is for a row of actions or filters that sits in a sidebar or a stacked region, where a ragged wrap reads worse than a clean column.

```html demo md xs
<div class="cluster" data-threshold="sm" data-gap="xs">
	<a class="button" href="#">Save</a>
	<a class="button" href="#" data-emphasis="medium">Preview</a>
	<a class="button" href="#" data-emphasis="low">Discard</a>
</div>
```

The cluster measures itself to decide, which makes it a size container, and a size container cannot take its width from its content. A thresholded cluster fills the block it is in, so give it one that has a width; a cluster without `data-threshold` is not a container and sizes to its items as before.

The trap is putting one where its width comes from its content. As an item of another cluster, or of any flex row that sizes its items by their content, a thresholded cluster has no content width to offer and collapses to nothing. Give it a width of its own there, or `flex-grow` so it takes the row's spare room; `npm run validate` warns when one sits directly in another cluster.

## Why this name

The word is exact: items gather, they do not line up in columns. Foundation 6 reached for `.button-group` or a menu for the same job.
