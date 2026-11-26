## When to use it

A set of things of equal weight that would take too much room laid out at once: work samples, quotes, photographs. Not for anything a reader must see, since a slide out of view is a slide most people never scroll to.

## How it works

The track is a row that scrolls and snaps, so dragging, swiping, and a trackpad all work with nothing added. The dots underneath are ordinary links to each slide's id, which means the browser scrolls to a slide when one is followed, the keyboard reaches them by Tab, and the CSS needs no script. The one module, described below, is optional.

The scrollbar under the track is hidden, since the dots already say where you are and the bar is noise beneath a track that snaps. Scrolling itself is untouched: dragging, swiping, the trackpad and the arrow keys all still work.

`data-slides` sets how many slides are visible at once, and each slide takes an equal share of the track less the gaps. Smooth scrolling comes from a token, `--yeti-carousel-scroll`, rather than from the reset, because a components-layer declaration would otherwise outrank it; the token itself collapses to `auto` under `prefers-reduced-motion`, so the preference still reaches the track. The track itself carries `tabindex="0"` and a name, because a region that scrolls has to be reachable from the keyboard; once it has focus, the arrow keys scroll it.

```html demo sm
<section class="carousel" data-slides="2" aria-roledescription="carousel" aria-label="Quotes">
	<div data-track role="group" aria-label="Slides" tabindex="0">
		<blockquote id="quote-1" data-slide><p>It just worked.</p></blockquote>
		<blockquote id="quote-2" data-slide><p>No build step.</p></blockquote>
		<blockquote id="quote-3" data-slide><p>Nothing to learn.</p></blockquote>
	</div>
	<ol data-dots role="list">
		<li><a href="#"><span class="visually-hidden">Quote 1</span></a></li>
		<li><a href="#"><span class="visually-hidden">Quote 2</span></a></li>
		<li><a href="#"><span class="visually-hidden">Quote 3</span></a></li>
	</ol>
</section>
```

## Accessibility

Label the region and mark it with `aria-roledescription="carousel"`, so it is announced as a carousel rather than as an anonymous group. A dot has no room for visible text, so name each one: put the words inside it in a `span` carrying `visually-hidden`, which leaves them in the accessibility tree and takes them off the screen, or use an `aria-label`.

The dots take you to a slide; they do not tell you which slide you are on. CSS cannot know that, and the module deliberately does not track it either: watching scroll position to light up a dot is a different and much larger job. If that matters for what you are building, the honest answer is a list rather than a carousel.

Following a dot is a navigation to a fragment, and every navigation adds an entry to the browser's history. A reader who looked at four slides would then need four presses of back to leave the page, which is why `carousel.js` exists: it takes the click and scrolls the track itself, so the dots cost no history and the URL is left alone. Load it with `<script type="module" src="…/js/carousel.js">`. The module is optional and the dots are ordinary links without it, so a page that never loads it still works, at the price of those history entries. Modified clicks, the ones that open a new tab, are left to the browser either way.

Browser-drawn scroll markers will one day do this in CSS and report the current slide as well. Today they are in one engine, so the module is the honest answer.
