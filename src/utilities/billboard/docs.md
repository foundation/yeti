## When to use it

Display text: a hero's headline, a figure's number, a pull quote, the title on a card that is sometimes a column and sometimes a page. A billboard is sized to fill the board it is on and to be read from wherever the reader is standing, and the default pair says so — it runs from `md` to `3xl`, the top of the everyday scale.

Not body copy. Prose has a measure and a comfortable size, and neither of them is a percentage of a column.

## How it works

`font-size` reads `cqi`, one percent of the container's inline size, so the line is sized by the box it is in rather than by the window. The same heading is one size in a card and another across a page, on the same page, which no viewport unit can say. It shrinks as readily as it grows: a billboard in a narrow column comes down to the bottom of its pair, which with the default is body size, not nothing.

`data-fit` is a pair of steps from the type scale, `<min>-<max>`, and the pair is the two ends of a clamp: the line never sets smaller than the first step or larger than the second, whatever the container does. The attribute keeps the name the value has always had — it is the range the text fits within, the way `data-gap` is the gap — while the class names the thing. Any smaller of the eight steps can pair with any larger one, which makes twenty-eight pairs, and `md-3xl` is what you get when the attribute is absent.

Between the ends the size is a proportion of the container, and the proportion is not a number in the stylesheet. It is the pair's own maximum divided by `--yeti-fit-width`, the container width at which a fitted line reaches its ceiling, `32rem` by default. So a pair that ends higher grows faster, every pair arrives at its ceiling in the same box, and a theme moves all twenty-eight by moving one token. With the default pair it works out between six and eleven percent of the container, depending where the fluid scale itself is standing.

```html
<div class="container">
	<h1 class="billboard" data-fit="lg-display">Build interfaces that read their own container</h1>
</div>
```

The container is the nearest ancestor with `container-type: inline-size`. That is what the [container](container.md) layout is for; `grid`, `timeline`, `nav`, `pagination` and `demo` are already size containers, as is a `card` with a leading figure and a `breakout` with a note; anything else needs a `container` above it, or the line measures the viewport. It has to be an ancestor: an element cannot query itself, so putting `billboard` and `container` on the same element measures the box outside it. With no container anywhere above, `cqi` falls back to the small viewport, so a billboard on a bare page grows with the window instead — a lesser effect, not a broken one.

## A line of unknown length

The default assumes a line of a certain length, and a headline from a CMS is not. CSS cannot measure text, but a template can count its letters. Pass the count in as a custom property and make the ceiling arrive at the width that many letters need:

```html
<h1 class="billboard" data-fit="md-display" style="--name-length: 14">The Copper Pan</h1>
```

```css
.billboard {
	--yeti-fit-width: calc(var(--yeti-text-display) * max(var(--name-length), 6) * 0.6);
}
```

The `0.6` is an estimate of one letter's width as a fraction of its size. It fits most typefaces with a little room over; a condensed face can come down toward `0.45`, and a wide one needs more, so try the longest and shortest names you expect at a phone's width. The `max(…, 6)` is a floor for short names: without it a three-letter name reaches its ceiling in a very small box and stays that large as the box narrows, and it runs off a phone.

## Accessibility

The clamp is the accessibility story. A size that is only `cqi` has no floor and no ceiling: it shrinks past legibility in a narrow column and runs off the top of a wide screen, and a reader who zooms in gets neither end back. The floor and the ceiling here are steps of the type scale, set in `rem`, so a larger default font size raises the floor and a billboard can never fall below a legible step; the middle of the ramp, between the two ends, follows the container instead.

Nothing here changes what an element is. A billboard `h1` is an `h1`; the class sizes it and says nothing about its rank.
