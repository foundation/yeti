## When to use it

A price with its currency, a distance with its unit, a search box with its button, a URL with a fixed domain after it, a country code beside a phone number. Whatever is joined shares one border and one height, so the parts read as one thing. A row of buttons joined the same way is `buttons` with `data-affix`.

## How it works

A flex row. Every control grows; a `span` becomes a labelled box on the sunken surface; a `button` keeps its own colors. Inner corners are squared and each border overlaps the next by one width, so the seam is a single line. The group sets no size of its own: it reads the field around it, so `data-size` on the field scales the whole row. A focused member rises above its neighbours and draws its focus ring inside its own border rather than outside it, where the ring would cross the seam onto the next member; a text control shows that ring on a click as well as on a Tab, by the browser's own rule for `:focus-visible`.

```html demo sm
<div class="field" data-size="lg">
	<label for="site">Site</label>
	<div class="affix">
		<input id="site" type="text" aria-describedby="site-domain">
		<span id="site-domain">.foundationcss.com</span>
	</div>
</div>
```

## Accessibility

The prefix is not part of the control, so a screen reader will not read it with the value unless you connect them: give the `span` an id and put it in the control's `aria-describedby`, or include the unit in the label ("Price in dollars"). The field's label still points at one control with `for`; when the affix joins two controls, the other one needs its own `aria-label`.

```html demo sm
<div class="field">
	<label for="phone">Phone</label>
	<div class="affix">
		<select aria-label="Country code"><option>+1</option><option>+44</option></select>
		<input id="phone" type="tel">
	</div>
</div>
```
