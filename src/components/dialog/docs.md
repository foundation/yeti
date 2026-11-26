## When to use it

A decision that has to be made before anything else happens: confirming something destructive, a short form the page cannot carry, a message that must be acknowledged. Anything the reader can come back to later belongs on the page rather than over it.

## How it works

A native `dialog`, opened as a modal. That one word is why the component exists in this shape: `showModal` makes everything behind the dialog inert, keeps focus inside it, closes it on Escape, and gives you a `::backdrop` to paint. None of that is Yeti's, and none of it needs ARIA.

Opening is native too. A `button` carrying `commandfor` with the dialog's id and `command="show-modal"` opens it modally, with no script. Closing needs none either if you use a form: a button inside `<form method="dialog">` closes the dialog on its own. `dialog.js` adds the two things the platform does not do yet: a click on the backdrop closes the dialog, and focus returns to the button that opened it when it closes.

```html
<button class="button" type="button" commandfor="share" command="show-modal">Share</button>

<dialog class="dialog" id="share" data-max="sm" aria-labelledby="share-title">
	<h2 id="share-title">Share this page</h2>
	<p>Anyone with the link can read it.</p>
	<footer>
		<form method="dialog"><button class="button" type="submit">Done</button></form>
	</footer>
</dialog>
```

## A drawer

A drawer is the same dialog, pinned to an edge of the screen. Use it for a panel that is longer or taller than a centered dialog suits: filters, a cart, the details of a row. It is still modal, so the page behind is inert and Escape closes it. A panel that should leave the page usable is a different thing: a `sidebar` layout, or a popover.

Add `data-panel="drawer"`, and pick the edge with `data-placement`: `start` (the default), `end`, `top` or `bottom`. `start` and `end` follow the writing direction, so in a right-to-left page a `start` drawer comes from the right. A side drawer is as tall as the screen, and its width comes from `data-max`, `sm` when it is absent. It always leaves a strip of backdrop to tap. A top or bottom drawer is as wide as the screen and as tall as its content, up to the screen's height less that strip; `data-max` does nothing on it. The drawer slides in from its edge and back out.

A long drawer scrolls as one piece. The footer sits at the bottom when the content is short, and scrolls with the content when it is long.

```html demo lg
<button class="button" type="button" commandfor="filters" command="show-modal">Filters</button>

<dialog class="dialog" id="filters" data-panel="drawer" data-placement="end" aria-labelledby="filters-title">
	<button type="button" data-close aria-label="Close" commandfor="filters" command="close">×</button>
	<h2 id="filters-title">Filters</h2>
	<p>Choose what to show.</p>
	<footer>
		<form method="dialog"><button class="button" type="submit" data-emphasis="medium">Cancel</button></form>
		<button class="button" type="button">Apply</button>
	</footer>
</dialog>
```

## A close button

A `button` carrying `data-close`, as a child of any dialog, sits in the top end corner. Put it first in the dialog, with the heading straight after it: the heading is what keeps clear of the button, so its text never runs under it. It works in a centered dialog and in a drawer. It closes the dialog natively: give it `commandfor` with the dialog's id and `command="close"`, and no script is needed. Yeti adds only the look. Give it an `aria-label`, since its text is a symbol.

```html
<button type="button" data-close aria-label="Close" commandfor="share" command="close">×</button>
```

## Accessibility

Name the dialog with `aria-labelledby` pointing at its heading, so it is announced as something rather than as an unnamed dialog. Because it is opened modally the page behind it is genuinely inert, not merely covered, so a screen reader cannot wander out of it. Focus returns to the opener on close, which is what keeps a keyboard reader's place.

The browser focuses the first control in a dialog when it opens. That is the close button when there is one, so put `autofocus` on a field that should have focus instead. The close button scrolls away with a long drawer's content, and Escape still closes the drawer.

Without the module the dialog still opens and Escape still closes it. What is lost is the backdrop click and, in Safari, the return of focus to the opener, because Safari does not focus a button when it is clicked. Load the module on any page where a keyboard reader will meet a dialog.
