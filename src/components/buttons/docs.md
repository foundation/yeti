## When to use it

Two or more buttons that belong together: a form's submit and cancel, a set of view toggles, a toolbar row. Loose, they sit in a row at a small gap and wrap when they must. Affixed, they become one control with shared borders, the shape of a segmented toggle.

## How it works

Loose is a wrapping flex row at `data-gap`. `data-affix` removes the gap, squares the inner corners, and overlaps each border with the next so the seam is one line wide. A focused member is lifted above its neighbours and draws its focus ring inside its own border, where it cannot cross the seam onto the members either side. An affixed group is one control, so it never wraps onto a second row: short of room, its members narrow and their labels wrap inside them.

```html demo sm
<div class="buttons" role="group" aria-label="Form actions">
	<button class="button" type="submit">Save</button>
	<button class="button" type="button" data-emphasis="low">Cancel</button>
</div>
```

A segmented control, one choice of several, is an affixed group of `label.button` members wrapping radios that share one name, inside a `fieldset` whose `legend` names it. The checked one is filled, the arrow keys move the choice, and it submits with the form, all with no script. The fieldset is the named group here, so the div inside it needs no role or label of its own.

```html
<fieldset>
	<legend>Billing</legend>
	<div class="buttons" data-affix>
		<label class="button" data-emphasis="medium"><input type="radio" name="billing" value="monthly" checked> Monthly</label>
		<label class="button" data-emphasis="medium"><input type="radio" name="billing" value="yearly"> Yearly</label>
	</div>
</fieldset>
```

A row of real `<button aria-pressed>` members draws the same way; it suits a toolbar where each button acts at once, but moving `aria-pressed` from one member to the next is your script's job.

## Accessibility

The group carries `role="group"` and a name, so a screen reader announces the set once. A segmented control of radios inside a fieldset is named by its legend and announced as radio buttons, one checked; a toggle of buttons puts `aria-pressed` on each and the pressed look follows. Do not use an affixed group as tabs; tabs have their own roles and keyboard behaviour and are a separate component.
