## When to use it

One thing in a box: an article in a listing, a product, a person, a plan. Put cards in a `grid` and they line up; give one a wide column and it puts its picture beside the text on its own, because it reads its own width rather than the screen's.

## How it works

A card is a flex column on the raised surface with a border and a radius. A picture, video, or `figure` placed first bleeds through the padding to the card's edges and, while it sits on top, is cropped to `data-ratio`. Everything after it is the body, spaced at the card's gap. A `footer` is pushed to the bottom, so a row of cards of different lengths keeps its actions aligned. `data-raised` trades the border for a shadow; `data-variant` colors the border and draws a bar along the top without tinting the text. From the `md` width of content, a card with a picture becomes a two-column row: the picture down the left, the body taking the rest. The picture fills that column, so `data-ratio` has nothing to say about it any more; narrower than that the card stacks, picture on top, the form a phone and a grid cell want, and the ratio governs it again. `data-threshold` moves that switch to any width stop: `xs` for a card that should be a row almost everywhere, `xl` for one that should stack until it has a whole column. A card in a grid with `data-rows` keeps its picture and footer aligned with its neighbours' and does not switch to the row. It is not the `box` layout's `data-surface="raised"`, which is a tone.

Two things follow from how that query works. Only a card with a picture is a size container, because a size container has no intrinsic width: a card that always was one collapsed to its padding as a cluster item. And anything pressable inside a card sits above a stretched link, so a footer button in a card whose heading carries `data-stretch` still takes the click.

```html demo lg
<ul class="grid" data-min="sm" role="list">
	<li class="card" data-raised>
		<figure>
			<img src="ridge.jpg" alt="A snow ridge at first light">
			<figcaption>Photo: Ada</figcaption>
		</figure>
		<h3>First light</h3>
		<p>Up before the sun, and glad of it.</p>
	</li>
	<li class="card" data-variant="warning">
		<h3>No picture</h3>
		<p>A card is fine without one.</p>
		<footer><a class="button" href="#" data-emphasis="medium">Details</a></footer>
	</li>
</ul>
```

## Accessibility

Do not wrap a card in a link. Put the link on the heading and add `data-stretch`: the link grows to cover the card, so the whole card is clickable, while its accessible name stays the heading text. If the footer repeats the link as a button, give that button `tabindex="-1"` so keyboard users do not meet the same destination twice. Use `article` for a card that stands alone and `li` for cards in a list, so the list is announced with its count.
