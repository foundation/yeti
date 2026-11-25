## When to use it

A small panel of anything beside the button that opens it: a share box with a link to copy, a short explanation, a filter or two, a quick form. The page stays usable while it is open.

It is not a menu. A list of links and actions belongs in a `dropdown`, which turns each one into a menu row. It is not a hint either: a few words that explain a control, with nothing to click, are a `tooltip`. And a question the reader must answer before going on is a `dialog`.

## How it works

The panel is a native popover. The button carries `popovertarget` with the panel's id, and the panel carries `popover` and the class. The browser opens it, puts it in the top layer, closes it on Escape or a click outside, and keeps the button's expanded state current. No script is needed.

The button that opens the panel is its anchor, so there is no wrapper and no anchor name. The panel can sit anywhere in the page, and a page can hold many. The browser also puts the panel straight after its button in the tab order, wherever it sits in the markup.

```html
<button class="button" type="button" popovertarget="share">Share</button>

<div class="popover" id="share" popover>
	<h3>Share this page</h3>
	<p>Anyone with the link can read it.</p>
	<button class="button" type="button">Copy link</button>
</div>
```

What it holds is ordinary flow content. Links look like links and buttons like buttons, and its children are spaced the way an `article` spaces them. The panel fades in and closes at once.

The panel's background is `--yeti-popover-surface`, its corner is `--yeti-popover-radius`, and its padding is `--yeti-popover-padding`.

## Placement

By default the panel opens below its button, lined up with the button's start edge, with a small gap between them. Pick another side with `data-placement`: `bottom` (the default), `top`, `start` or `end`. `start` and `end` follow the writing direction, so in a right-to-left page `end` is to the button's left.

Where there is no room on that side, the panel flips to the other. Where it would run past the end of the screen, it lines up with the button's other edge instead, and it shifts to stay on the screen when neither fits.

```html
<button class="button" type="button" popovertarget="hint">What is this?</button>

<div class="popover" id="hint" popover data-placement="end">
	<p>Your plan renews on the first of each month.</p>
</div>
```

Where anchor positioning is missing the browser centers the panel on the screen. It still opens, closes and reads correctly.

## Width

The panel is as wide as its content, up to `data-max`, from the width scale. The default is `xs`. On a narrow screen it is never wider than the screen less a margin each side.

## A panel that holds a form

Make the panel a `dialog` element when it holds a form. A screen reader then announces a named dialog, and `autofocus` on a field works. It is still not modal: the page behind stays usable, and a click outside closes it.

```html
<button class="button" type="button" popovertarget="rename">Rename</button>

<dialog class="popover" id="rename" popover aria-labelledby="rename-title">
	<h3 id="rename-title">Rename</h3>
	<div class="field">
		<label for="rename-name">Name</label>
		<input id="rename-name" type="text" autofocus>
	</div>
</dialog>
```

## What it is not

There is no arrow pointing at the button, because an arrow cannot follow the panel when it flips. It does not open on hover: that is the tooltip's job, or the dropdown's `hover.js`. A menu of links belongs in a `dropdown`.

## Accessibility

Give the button a name. The browser sets its expanded state from `popovertarget`, so a screen reader hears whether the panel is open. Escape closes the panel and returns focus to the button.

Tab moves from the button into the panel and, from the panel's last control, on to whatever follows the button. That holds wherever the panel sits in the markup. A screen reader reading the page in order still meets the panel where it sits, so keep it close to its button, and inside the same landmark.
