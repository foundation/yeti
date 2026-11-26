## When to use it

A word or a number that labels something else: a status beside a title, a count on a tab, a version next to a heading. It sits in the line of text and takes the hue that means the state.

## How it works

An inline box one step smaller than the text around it, with a pill corner by default. `data-emphasis="medium"`, the default, is a subtle tint of the hue with the hue's darker text, quiet enough to repeat down a list. `high` fills the badge for the one state that must stand out; `low` is the text alone.

```html demo sm
<h3>Release notes <span class="badge" data-emphasis="high">New</span></h3>
```

On a painted band use `data-variant="black"` or `"white"`, the two constants, which read the same in both schemes.

```html demo sm
<div class="box" data-paint="primary">Build status <span class="badge" data-variant="white">Passing</span></div>
```

## Accessibility

Color is decoration here; the word is the meaning, so "Live" and "Draft" work with no color at all. A count beside a button or a tab is read as separate text, which is rarely what you want; put it into the control's `aria-label` instead. Text over every tint meets AA in both schemes.
