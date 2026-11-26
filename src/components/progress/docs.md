## When to use it

Work with a known length: an upload, a wizard's steps, a quota. Leave the value off for work whose length is unknown and the bar says "busy" instead of "40%".

## How it works

The native `progress` element, with its own drawing switched off and a thin rounded track in its place. The filled part is the hue, through the engines' own pseudo-elements, and slides when the value changes. Without a `value` the element is indeterminate: the track takes diagonal stripes that move along it. `data-size` sets the thickness to half of the size's space step.

```html demo sm
<progress class="progress" data-variant="success" data-size="lg" value="3" max="5" aria-label="Steps">3 of 5</progress>
<progress class="progress" aria-label="Loading">Loading</progress>
```

## Reading progress

`data-scroll` makes the bar fill with how far the nearest scroll container has been scrolled: the page, when the bar sits at its top, or a `scroller`, when the bar is inside one. It is the one form of progress that is not a `progress` element, because there is no value to announce: it is a block with the class, and it carries `aria-hidden` so a reader is not told about a bar that only mirrors their own scrolling. Pin it with `data-sticky` as the first child of the page's stack.

```html
<div class="stack">
	<div class="progress" data-scroll aria-hidden="true" data-sticky></div>
	…
</div>
```

It is guarded by `@supports`, and where a scroll timeline is missing the bar is not shown at all: a bar that never moved would say the reader had not started. It is not switched off under reduced motion, because nothing in it moves on its own; the fill follows the reader's hand and stops when they do.

A reading bar at the top of the page usually wants to sit on the edge and be thin: set `--yeti-sticky-offset: 0` and `--yeti-progress-size: 2px` on the bar itself. It paints above the page as it scrolls.

## Accessibility

A `progress` element is a progress bar to assistive tech already; it needs a name, from `aria-label` or `aria-labelledby`. Keep the text between the tags current, since some readers announce that rather than the value. An indeterminate bar is announced as busy with no percentage, which is right.
