## When to use it

A wall of photos, cards of unpredictable length, quotes of different sizes: anything where equal rows would leave holes under the short items. If the items are roughly equal, use a `grid` and keep the rows.

## How it works

Everywhere, the masonry is a multi-column layout: `data-min` is the column width, `data-columns` caps the count, and each item is told not to break across columns. In that form items flow down the first column, then the next, so the reading order runs in columns. Where the browser supports native masonry, the same element becomes a grid with masonry rows, items read across as in a grid, and the gap is a real gap. Both forms use the same attributes and the same tokens, so nothing in your markup changes when a browser gains support. In the multi-column fallback the last item of each column keeps its bottom gap, so the fallback is one gap taller than the native form.

Since the reading order depends on the browser, masonry suits items that can be read in any order. Where the order matters, as on a menu or a list of steps, use CSS columns directly, which read down each column everywhere:

```css
.menu { columns: 2; }
.menu > * { break-inside: avoid; }
```

## Why this name

The word everyone already uses for the brick-wall arrangement. Foundation 6 had nothing for it; people reached for a JavaScript library, which is the thing this layout replaces.
