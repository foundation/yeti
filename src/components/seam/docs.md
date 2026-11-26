## When to use it

Between bands of a landing page, where a straight line between two backgrounds looks cut from cardboard. A slant, a curve, or a wave along one edge of a section, alternating direction down the page, is the classic move.

## How it works

The cut is taken from the section itself, not added on top: a slant is a `clip-path` polygon, a curve or wave a mask made of a solid body and a shaped strip along the cut edge. Because the section's own background is what is cut, the page, the previous section, or an image behind it shows through, with no extra element. `data-edge` picks the edge, `data-size` the depth, `data-flip` mirrors a slant or a wave for the next section down. The seam adds the depth of the cut as space after or before the content, so give the section its padding as usual and nothing sits in the cut.

```html demo md
<section class="seam" data-shape="slant" data-edge="both" data-flip data-size="lg" style="background: var(--yeti-color-secondary-subtle); padding: var(--yeti-space-xl)">
	<h2>Slanted top and bottom</h2>
</section>
```

## Accessibility

Purely visual. The clip and the mask change nothing about the content, its order, or its size for assistive tech; the added space keeps text out of the cut for everyone.
