## When to use it

Reach for a stack whenever things sit one above another and should be spaced evenly: the sections of a card, the fields of a form, the parts of a sidebar. Nest stacks with different gaps to express hierarchy: a large gap between sections, a small one inside each.

## How it works

The stack is a flex column with a `gap`, so the space between children is the stack's decision and children's own margins are zeroed. `data-align` controls horizontal alignment, and the default is to stretch, so an inline thing put straight into a stack, a badge or a button, becomes as wide as the column; give the stack `data-align="start"` or put the thing in a paragraph. Give one child `data-split` and it, with everything after it, moves to the end whenever the stack is taller than its content, which is how a card keeps its actions at the bottom. Add `data-fill` and the stack is at least as tall as the viewport, which with a `data-split` footer is the whole of a sticky footer. It is the stack that fills; on a child of an `overlay`, the same word means the child covers its box.

```html
<div class="stack" data-gap="sm" data-align="start">
	<h3>Title</h3>
	<p>Body</p>
	<a href="#" data-split>Action</a>
</div>
```

The gap is the stack's, but one child can ask for a different gap before it. `data-space` on a child takes the same words as `data-gap` and sets the space above that child alone, larger or smaller than the stack's own: more room above a heading that opens a new run of paragraphs, less between a label and the field under it. The rest of the stack keeps its rhythm. It does nothing on the first child, which has no gap before it, and `data-split` wins on a child carrying both. This is Yeti's margin utility, and it lives on the layout on purpose: the exception is one word on one child, and the stack still owns the rule.

```html
<div class="stack" data-gap="sm">
	<p>One paragraph.</p>
	<p>Another, at the stack's gap.</p>
	<h3 data-space="xl">A heading with room above it</h3>
	<p>And its paragraph, back at the stack's gap.</p>
</div>
```

`data-rule` on the stack draws a line between each pair of children, the border width in the border color, in the middle of the gap; the gap itself does not change, and `data-space` moves the line with it. A legend, a settings list, a run of plan features: anywhere rows want separating without boxing. The line is a `::before` on each child after the first, so a child that already draws its own `::before` keeps its own and loses the line. The line is lost too on a child that clips its overflow, a card, a frame, an accordion or a progress bar, and on a replaced element such as an image, which has no `::before` to draw. A child that is itself a stack still has its line placed by the ruled stack's gap, but a ruled stack directly inside another ruled stack places its line by its own gap, the same limit `data-space` has; give it a plain wrapper.

```html demo sm
<dl class="stack" data-rule data-gap="sm">
	<div class="cluster" data-justify="between"><dt>Distance</dt><dd data-numeric>14.2 km</dd></div>
	<div class="cluster" data-justify="between"><dt>Ascent</dt><dd data-numeric>1,120 m</dd></div>
</dl>
```

A child carrying `data-sticky` stays at `--yeti-sticky-offset` from the top of the scrollport while the rest of the stack scrolls past it, and keeps the full width of the column while it does. A stack stretches its children sideways, and sideways is not the direction a sticky child moves in, so nothing has to be taken away for it to work — which is not true in a row, where the same marker costs the child the row's height.

## Why this name

No other word says it as plainly: things stacked, one on another. Foundation 6 had no equivalent; the space between blocks came from each element's own margins.
