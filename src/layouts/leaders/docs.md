## When to use it

A name and a value a reader's eye has to travel between: a menu, a price list, opening hours, the page numbers on a contents page. The dotted line carries the eye across. If the rows have more than two things to compare, use a table.

## How it works

Each child of `leaders` is a row. Its first child is the name and its second is the value, and the line fills the space between them. The line is the row's own `::after`, so there is no element to add and the markup stays valid: a `dl` can hold nothing between a `dt` and its `dd`.

```html
<dl class="leaders">
	<div><dt>Soup of the day</dt><dd>$9</dd></div>
	<div><dt>Roast chicken with lemon and thyme</dt><dd>$24</dd></div>
</dl>
```

The rows can be any elements, so a contents page is a list. `role="list"` takes the list's markers off:

```html
<ol class="leaders" role="list">
	<li><a href="#starters">Starters</a><span>12</span></li>
	<li><a href="#mains">Mains</a><span>18</span></li>
</ol>
```

A row with no value draws no line. The second child is always the value, so a row with a description but no price keeps an empty element in that place, with nothing inside it, not even a space: `<h3>Market fish</h3><strong></strong><p>Ask what came in today.</p>`. A long name wraps, and the line and the value stay on its last line. The line never gets shorter than 1.5rem, so a name that would fill the row wraps sooner to leave room for it.

Anything after the value sits below the row at the full width, which is where a dish's description goes:

```html
<div class="leaders" data-gap="md">
	<article>
		<h3>Trout</h3>
		<strong>$21</strong>
		<p>With brown butter and almonds.</p>
	</article>
</div>
```

A row can stand alone. `data-row` makes the element the row itself, for a name and a price among other content, with no wrapper around it:

```html
<article class="stack">
	<figure>…</figure>
	<div class="leaders" data-row><h3>Trout</h3><strong>$21</strong></div>
</article>
```

`data-gap` is the space between rows. `--yeti-leaders-line` is the line itself, written as a border: `2px dotted` in the muted text color by default. The dots stand on the baseline, as printed dots do. To raise them, move the line in your theme with `.leaders > *::after { translate: 0 -0.3em; }`.

## Why this name

Leaders are what typesetters call the line of dots that leads the eye across a page. Foundation 6 had nothing for it.
