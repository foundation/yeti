## When to use it

A heading or a short line set between rules: a section head on a menu, a date under a masthead, the "or" between two ways to sign in. For a rule with no text, use `hr`, or `data-rule` on a stack for a line between every child.

## How it works

The class goes on the element that holds the text, and the rules are that element's own `::before` and `::after`, so a heading stays a heading and nothing extra is read out. Each rule fills the room left by the text.

```html
<h2 class="divider">Mains</h2>
```

`data-align` moves the text. `center` is the default; `start` and `end` put it at that edge with one rule filling the rest.

```html
<h2 class="divider" data-align="start">Mains</h2>
```

Long text wraps into balanced lines, and each rule keeps at least 1.5rem. The element's children each take a place in the row, so text with an inline element in it goes in one `span`:

```html
<p class="divider"><span>Served from <time datetime="12:00">noon</time></span></p>
```

`data-gap` is the space either side of the text, and `--yeti-divider-line` is the rule itself, written as a border: the border width in the border color by default. A divider fills its container, heading or not, so it sets no reading measure.

## Why this name

It is what it does, and `rule` already means the line a stack draws. Foundation 6's `hr` could not hold text.
