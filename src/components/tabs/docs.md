## When to use it

Alternative views of one thing: a profile and its billing, a chart and its table. Not for steps in a sequence, which want a form, and not for hiding content a reader needs to compare against something else. For a row of links to other pages that looks like tabs, use `tabnav`.

## How it works

A tab list of buttons over their panels. The CSS styles the list and marks the selected tab with the hue on its edge, and it never hides a panel. That is deliberate: a page that does not load `tabs.js`, or where the script fails, shows every panel under its own tab, so nothing a reader came for is locked away.

Load the module and it pairs every tab with the panel its `aria-controls` names, shows one, hides the rest, and takes over the keyboard: arrows move selection, Home and End jump to the ends, and only the selected tab is in the tab order, so Tab leaves the list rather than walking it. A link into a hidden panel opens its tab: on load and on every `hashchange` the module looks for the URL's fragment inside a panel and, if it finds one, selects that panel's tab and brings the target into view, without moving keyboard focus to the tab. Tabs may nest inside another tab's panel: each set keeps its own selection and its own arrow keys, and a link into the inner set opens every enclosing panel on the way. `data-emphasis="high"` fills the selected tab with the variant instead of underlining it, its top corners (or, in a vertical list, the corners away from the divider) rounded like any other filled control.

```html demo sm
<div class="tabs" data-emphasis="high">
	<div role="tablist" aria-label="Report">
		<button type="button" role="tab" id="t-summary" aria-controls="p-summary" aria-selected="true">Summary</button>
		<button type="button" role="tab" id="t-detail" aria-controls="p-detail">Detail</button>
	</div>
	<section role="tabpanel" id="p-summary" aria-labelledby="t-summary"><p>Summary panel.</p></section>
	<section role="tabpanel" id="p-detail" aria-labelledby="t-detail" hidden><p>Detail panel.</p></section>
</div>
```

```html demo sm
<div class="tabs" data-orientation="vertical">
	<div role="tablist" aria-label="Settings">
		<button type="button" role="tab" id="t-general" aria-controls="p-general">General</button>
		<button type="button" role="tab" id="t-keys" aria-controls="p-keys">API keys</button>
	</div>
	<section role="tabpanel" id="p-general" aria-labelledby="t-general"><p>General settings.</p></section>
	<section role="tabpanel" id="p-keys" aria-labelledby="t-keys"><p>Your API keys.</p></section>
</div>
```

## Accessibility

Name the tablist, since a page may have more than one. Each tab's `aria-controls` names its panel and each panel's `aria-labelledby` names its tab; the module reads that pairing rather than guessing from document order, so the markup stays the source of truth. The module also maintains `aria-selected` and the roving `tabindex`, which is what makes a tab list feel like one control rather than a row of buttons. Without the module the markup is still valid: the roles are right and every panel is readable.
