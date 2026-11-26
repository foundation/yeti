## When to use it

Something the reader should know now: the form was saved, the trial ends on Friday, the address did not validate. One message, one hue, in the flow of the page where it applies. For a message that arrives and leaves on its own, wait; that is not this.

## How it works

A flex row: an optional icon, the message, and an optional close button pushed to the end. The hue draws the border and, at `medium` emphasis, a tint behind the text; `high` fills the box for the message that must be seen; `low` keeps the border alone. The start edge is `--yeti-alert-edge` thick, four border widths by default (the same mark the card uses for a variant), at every emphasis. The token is undeclared and read with that fallback, so the four is four of whatever `--yeti-border-width` is in force where the alert sits, not the page's root value; set `--yeti-alert-edge` directly to fix the width regardless.

The close button is a `button` carrying `data-close`. Yeti's `alert.js`, loaded once with `<script type="module" src="…/js/alert.js">`, listens on the document: a click fades the alert over the fast duration and removes it. Without the module the button does nothing, so leave it out on pages that do not load the module.

```html demo sm
<div class="alert" role="alert" data-variant="alert" data-emphasis="high">
	<div><strong>Payment failed.</strong> The card was declined.</div>
	<button type="button" data-close aria-label="Dismiss">×</button>
</div>
```

## Accessibility

`role="status"` for the usual notice, which is announced politely when it appears; `role="alert"` only for something urgent, which interrupts whatever the reader is doing. Neither role announces content that is already on the page at load; they matter for alerts inserted later. The color is decoration: say "Saved" or "Failed" in the words. The close button needs a name, and after it removes the alert focus moves to where the alert was, so the reader keeps their place; put an alert near the thing it describes rather than far above it.
