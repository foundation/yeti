## When to use it

Every control in a form: text, email, number, select, textarea, checkbox, radio, switch, range. A form is a `stack` of fields and a button; the field owns what bare HTML cannot, the label's link to its control, the help text, and the error.

## How it works

A tight column: label, control, hint, error. The control is a native element styled to the control tokens, so a theme that changes `--yeti-control-radius` changes every input. The error is hidden until the control is invalid *and* the visitor has touched it (`:user-invalid`), or until you set `aria-invalid="true"` after a server round trip; then it shows and the border turns to the alert color. A `required` control gets a marker after its label. A checkbox or radio is laid out inline automatically, label after the control, and its checked mark is a variant-colored centre inside a ring of the surface color.

```html
<fieldset class="field">
	<legend>Notify me by</legend>
	<div class="field"><input id="n-email" type="checkbox" name="notify" value="email"><label for="n-email">Email</label></div>
	<div class="field"><input id="n-sms" type="checkbox" name="notify" value="sms"><label for="n-sms">Text message</label></div>
	<p data-hint>Pick as many as you like.</p>
</fieldset>
```

A checkbox with `role="switch"` becomes a switch: a track with a thumb that slides to the end and takes the field's color when on. Off, the track is `--yeti-switch-track` and the thumb `--yeti-switch-thumb`, the control border and surface by default; a theme that darkens the control border sets these so off stays distinct from on, and the off track must still clear 3:1 against the page surface. A `range` input gets a thin track and a round thumb in the field's color, the height of a control so it is easy to grab.

The filled part of the track is `--yeti-range-value`, how far along the value sits from 0 to 1, because CSS cannot read an input's value. `range.js` keeps it in step, and writes the value into an `output` placed before the input, which is drawn over the thumb. Give the output `aria-hidden`: the input announces its own value and a screen reader should not hear it twice. Leave the output out of a page that does not load the module, or it stays empty.

The fill stops where the thumb's centre is, not at that share of the width. A thumb's centre only travels from half a thumb in to half a thumb from the end, so a plain percentage runs ahead of it, by eleven pixels at each end on a track this wide. The stylesheet makes that correction, because the thumb's width is an em it already knows and script would have to measure it again on every resize.

Without the module the track sits wherever `--yeti-range-value` says, so set it on the input for a static one.

```html
<div class="field"><input id="dark" type="checkbox" role="switch"><label for="dark">Dark mode</label></div>
<div class="field"><label for="quality">Quality</label><output for="quality" aria-hidden="true"></output><input id="quality" type="range" min="0" max="100" value="70"></div>
```

```html
<div class="field"><label for="volume">Volume</label><input id="volume" type="range" min="0" max="100" value="40"></div>
```

Set by hand, it is a number rather than a percentage: `style="--yeti-range-value: 0.7"`.

`validate.js` is the field's second module, and it is about the form rather than one control. On submit it finds every invalid control in the form, inside a `.field` or not, and sets `aria-invalid="true"` on each — which is the same attribute a server round trip would set, so the error shows and the border turns at once — writes the browser's own message into the empty `[data-error]` of the nearest field that has one, focuses the first control, and stops the submission. A control outside every field is counted and stops the submit like any other; there is simply nowhere to put its message, and under `novalidate` nothing else was going to stop it. A radio or checkbox group gets its message on the `fieldset.field` that carries the slot, not on the bare `.field` around each input. It dispatches `yeti:invalid` on the form with the controls it found, so a page can count them, scroll a summary into view, or send them somewhere. Typing or picking a valid value clears the mark again.

Give a form that loads it `novalidate`. Without that attribute the browser opens its own bubble on the first invalid control and never fires a submit event at all, so the module never runs and the page gets the bubble instead of its own error text. An error element you fill in yourself is never overwritten; an empty one is the slot the module writes into.

```html demo md
<form class="stack" data-gap="md" novalidate>
	<div class="field">
		<label for="signup-email">Email</label>
		<input id="signup-email" type="email" required aria-describedby="signup-email-error">
		<p id="signup-email-error" data-error></p>
	</div>
	<button class="button" type="submit">Sign up</button>
</form>
```

## Accessibility

The label must point at the control with `for` and the control must carry that `id`; Yeti's validator refuses an example without the pair. Put the hint's and the error's ids in the control's `aria-describedby`, so a screen reader hears the help text with the control and the error the moment it appears. Errors found on the server are shown with `aria-invalid="true"`. The required marker is a visual echo of the `required` attribute, which is what is announced.
