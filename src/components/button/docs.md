## When to use it

Anything the visitor does: submit, save, open, dismiss. Put the class on a `button` for an action and on an `a` for a link that should look like a button. One high-emphasis button per view is a good rule; the rest are medium or low, so the eye finds the main action.

## How it works

Three attributes and no classes. `data-variant` picks a hue from the palette and the button reads that hue's ladder for its fill, its hover step, and its outline text. `data-emphasis` picks how much of the ladder shows: `high` fills, `medium` outlines, `low` is text that tints on hover. `data-size` scales the text and the padding together so the shape holds. Hover, active, focus, disabled, pressed, and busy come from the element's own state, so nothing needs a script to look right.

A button is at least the control height, and a large one grows by the same step a large field does, so the two match in a row. Above that minimum, `--yeti-button-padding-block` and `--yeti-button-padding` set the padding as multiples of the size's space step.

Two values of `data-variant` are not hues: `black` and `white`. They do not follow the theme and do not flip with the scheme, which is what a button on a painted band needs, where the band's own hue would vanish into itself. They keep every state: black steps to a dark grey under the pointer, its outline and text forms wash with a translucent black, and white mirrors it.

```html demo sm
<section class="box" data-paint="warning">
	<h2>Start the season early</h2>
	<a class="button" href="#" data-variant="black">Book a place</a>
</section>
```

```html demo sm
<p>
	<a class="button" href="#" data-variant="secondary" data-emphasis="medium" data-size="lg">
		<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
		Read the docs
	</a>
</p>
```

A toggle needs no script when it is a native input. Put the class on a `label` wrapping a `radio` or `checkbox`: the input is hidden from sight but stays in Tab order, the label is filled while the input is checked, exactly as a pressed button is, draws the focus ring when the input has it, and dims when the input is disabled. The checked state submits with a form and, for radios sharing a name, the arrow keys move it. A real `<button aria-pressed>` looks the same, but moving `aria-pressed` from one button to the next is your script's job.

```html
<label class="button" data-emphasis="medium">
	<input type="checkbox" name="offline" checked>
	Keep maps offline
</label>
```

A link that is a button, `<a class="button">`, is drawn as a button and never underlined, since Yeti sets that inside its layer. A stylesheet of your own that underlines links on hover sits outside every layer and outranks it, so exclude buttons there: `a:hover:not(.button)`.

## Buttons that copy and share

`data-action` makes a button do one thing that the browser keeps for script. It takes `copy` or `share`. Both need the optional module `button.js`. Without the module such a button does nothing at all, so on a page that does not load it, leave the button out, or add it with the script that loads the module.

```html
<pre id="install"><code>npm install @foundation/yeti</code></pre>
<button class="button" type="button" data-action="copy" data-target="install" data-done="Copied" aria-live="polite">Copy</button>

<button class="button" type="button" data-action="share" data-done="Link copied" aria-live="polite">Share</button>

<script type="module" src="…/js/button.js"></script>
```

### Copy

`data-action="copy"` copies text to the clipboard. `data-target` is the id of the element to copy, a bare id as `for` and `popovertarget` take. A click copies that element's text. Where the element is an `input`, a `textarea` or a `select`, its value is copied instead, including what was typed after the page loaded. Line breaks at the very end are dropped, so a pasted command does not run by itself. Nothing else is changed: indentation and inner line breaks are copied as they are.

The browser's clipboard works only in a secure context, which is a page on https or on localhost. Where it is missing, or the browser refuses the write, the button stays as it is and no label shows.

### Share

`data-action="share"` opens the browser's share sheet, the one a phone shows with its apps and contacts. With no `data-target` it shares the page: its title, and the address in its `<link rel="canonical">`, or its own address when it has none. To share another page, give `data-target` the id of a link; the button shares that link's address and its text.

Not every browser has a share sheet. Safari has one, and so do the browsers on phones; Firefox on a desktop has none, and Chrome has one on some systems only. Where there is none, the button copies the link to the clipboard, so it always does something useful.

A visitor who closes the sheet without sharing changes nothing.

### The label

`data-done` is optional. It is the label the button shows for two seconds once something is on the clipboard, in your own words. Then the button gets back exactly what it held before, the same nodes, so an icon survives. The button keeps its width while a shorter label shows, so nothing beside it moves.

On a copy button the label shows after every copy. On a share button it shows only where the link was copied because there was no share sheet. The sheet is its own sign, so word the label for the copy: "Link copied", not "Shared".

### Events

The module dispatches `yeti:copy` on the button each time it puts text on the clipboard, which includes a share button in a browser with no share sheet. It dispatches `yeti:share` once the share sheet reports that the visitor shared. Both bubble, so one listener on `document` hears every button on the page.

An action the module does not know is left alone, so a `data-action` that belongs to another script on the page does no harm.

## Accessibility

A `button` is a button and an `a` is a link; the class changes the look, not the role, so use the element that matches what happens. An icon-only button needs an `aria-label`. A toggle is either a `label.button` wrapping a native radio or checkbox, whose own checked state is what a screen reader announces, or a button carrying `aria-pressed`, and the pressed look follows either. A button that is waiting on a request carries `aria-busy="true"` and `aria-disabled="true"` together: it dims, shows a progress cursor, and your handler ignores presses until the request returns. The focus ring is the page's ring and is never removed. A copy or share button needs `aria-live="polite"`, so a screen reader says the new label when it shows. Give it a `data-done` label too: without one, nothing tells any reader that something was copied. An icon-only copy or share button still needs an `aria-label`. Text over every fill meets AA in both color schemes; the test suite checks each variant.
