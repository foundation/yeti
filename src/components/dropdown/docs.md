## When to use it

A short list of things to go to or to do, hung off one button: an account menu, a row of secondary actions, the children of a nav item. For choosing a value in a form, use a `select` inside a field instead.

## How it works

The panel carries `popover` and the button carries `popovertarget`, so the browser opens it, puts it in the top layer, closes it on Escape or a click outside, and keeps the button's expanded state current. Yeti adds the surface, the shadow, and the placement. Because the panel is in the top layer, nothing on the page can clip it, which is why a dropdown inside a nav works even though the bar is a query container.

Where anchor positioning exists the panel hangs under its own trigger, and `data-side="end"` lines it up with the trigger's end edge instead. A [split parent's](#a-parent-with-its-own-page) panel hangs under its whole row, the link and the button together, so it starts under the link and not under the small button. The anchor name is scoped to each dropdown, so a page full of them behaves. Where anchor positioning is missing the browser centres the panel, which is plainer but still opens, closes, and reads correctly.

```html
<div class="dropdown" data-side="end">
	<button class="button" type="button" popovertarget="row-actions" data-emphasis="low">More</button>
	<div id="row-actions" popover>
		<a href="#">Duplicate</a>
		<button type="button">Archive</button>
	</div>
</div>
```

The panel's background is `--yeti-dropdown-surface`, its text is `--yeti-dropdown-text`, and an item under the pointer takes `--yeti-dropdown-hover`. The current page's link, and each parent in the panel that holds it, takes `--yeti-dropdown-current`, which falls back to the variant's text color. Set the four together for a dark or tinted panel.

## A parent with its own page

A menu often hangs off a section that is a page in its own right: About has a page, and History and Team sit under it. Write the parent's link first, then an empty button, then the panel. This is a split parent. The link goes to the parent's page, and the button beside it opens the panel. The button has no text, so give it an `aria-label` that names what it opens, such as "About pages". Yeti draws a chevron in it.

```html
<ul role="list">
	<li class="dropdown">
		<a href="/about/">About</a>
		<button type="button" popovertarget="menu-about" aria-label="About pages"></button>
		<ul id="menu-about" popover role="list">
			<li><a href="/about/history/">History</a></li>
			<li><a href="/about/team/">Team</a></li>
		</ul>
	</li>
</ul>
```

The panel can be a `ul` of `li`s, as here, or a `div` of bare links, as above. Use a list once a menu has more than one level, because each `li` can hold a dropdown of its own.

A parent that is not a page has no link. Its button is the label, as in the first example on this page, and the whole row opens the panel. Do not give such a parent a link that goes nowhere, such as `href="javascript:void(0)"` or an empty `href`. A screen reader announces it as a link, and Enter on it does nothing. A button is announced as a button and already reports whether its panel is open.

## Submenus

Any item in a list panel can be a dropdown itself, a split parent or a label, and the same shape repeats at every depth. A submenu flies out beside its own row, toward the inline end (the right in a left-to-right page, the left in a right-to-left one), level with the row's top. Where it would run off the screen it flips to the other side. Where anchor positioning is missing the browser centres every panel, as it does for one level.

```html
<ul role="list">
	<li class="dropdown">
		<a href="/about/">About</a>
		<button type="button" popovertarget="menu-/about/" aria-label="About pages"></button>
		<ul id="menu-/about/" popover role="list">
			<li><a href="/about/history/">History</a></li>
			<li class="dropdown">
				<a href="/about/team/">Team</a>
				<button type="button" popovertarget="menu-/about/team/" aria-label="Team pages"></button>
				<ul id="menu-/about/team/" popover role="list">
					<li><a href="/about/team/joe/" aria-current="page">Joe</a></li>
					<li><a href="/about/team/ana/">Ana</a></li>
				</ul>
			</li>
		</ul>
	</li>
</ul>
```

Escape closes the innermost open panel and returns focus to its button. A click outside closes the whole chain. Opening a submenu closes any sibling submenu that was open. All three are the browser's own handling of nested popovers, so there is no script to load for them.

Each button's `popovertarget` names its panel's id, so every id has to be unique on the page. An id can be any string without whitespace. `popovertarget` is an id reference, not a CSS selector, so an id built from the page's path, such as `menu-/about/team/` above, works as it is and needs no escaping. That makes ids easy for a template to write.

The chevron shows that a row opens something, and which way. A split parent's button always has one. A label button has one only where it marks a submenu: inside another dropdown's panel, and inside a nav's list. A standalone dropdown's button, such as the Account button above, is left as it is. A first-level chevron points down and turns up while its panel is open. A nested one points to the inline end and turns back while its panel is open, and mirrors in a right-to-left page. The exception is a nav's open panel with `nav.js`, where every group opens below its own row, so every group's chevron points down and turns up while the group is open.

Mark the page being read with `aria-current="page"` on its link, and nothing else. That link takes the current color and the strong weight. Every dropdown that holds it shows its own link and button in the same color at the normal weight, so the way down to the page can be followed without a second page looking current. A grouped panel's heading, described below, keeps its strong weight and only changes color. The color is `--yeti-dropdown-current`, which falls back to the variant's text color, or the primary color's outside a variant scope. A button that is a `.button`, such as the Account button above, keeps its own colors, because its text is drawn for its own fill.

## Grouped

`data-grouped` on a dropdown lays its panel out as columns instead of flyouts. Each second-level item that is a split parent becomes a small, strong heading, still a link to its own page, with its pages listed under it, and its button is hidden. Use it for a section with a few groups of pages that a reader should see at once.

```html
<ul role="list">
	<li class="dropdown" data-grouped>
		<a href="/products/">Products</a>
		<button type="button" popovertarget="menu-products" aria-label="Products pages"></button>
		<ul id="menu-products" popover role="list">
			<li class="dropdown">
				<a href="/products/design/">Design</a>
				<button type="button" popovertarget="menu-products-design" aria-label="Design pages"></button>
				<ul id="menu-products-design" popover role="list">
					<li><a href="/products/design/sketch/">Sketch</a></li>
					<li><a href="/products/design/print/">Print</a></li>
				</ul>
			</li>
			<li class="dropdown">
				<a href="/products/build/">Build</a>
				<button type="button" popovertarget="menu-products-build" aria-label="Build pages"></button>
				<ul id="menu-products-build" popover role="list">
					<li><a href="/products/build/code/">Code</a></li>
					<li><a href="/products/build/deploy/">Deploy</a></li>
				</ul>
			</li>
		</ul>
	</li>
</ul>
```

Each heading still has its button and its panel's id, although the grouped panel hides the button. Write them anyway: the manifest requires both, and a nav's open panel shows the same sections as groups, where the button opens and closes each one.

Each column is at least `--yeti-dropdown-min` wide, and the columns wrap onto further rows on a narrow screen. The panel keeps its full width wherever its trigger sits. Where it would pass the edge of the screen, it moves back in to fit, against the margin on that side: toward the start for the default side, toward the end with `data-side="end"`. That needs `position-try-fallbacks`; a browser without it keeps the panel lined up with its trigger. The grouped panel shows three levels: its own trigger, the headings, and the pages under them. A page under a heading keeps its link, and anything below that page is not shown. A label-only item at that third level is not shown at all. Its pages have no parent page, so they cannot be reached from that panel; give such a section a page, or move its pages up a level.

A second-level item with no page of its own, a label button, does not become a heading. It keeps its button and opens its ordinary flyout card, because CSS cannot stop a button from opening its popover. Put such an item last in the panel, or its card opens over the column beside it.

Once a nav's links are behind its toggle, a grouped dropdown in its open panel behaves like any other.

## Opening on hover

Click is the default and never changes. `data-trigger="hover"` adds opening under the pointer on top of it, and needs `hover.js`, loaded once with `<script type="module" src="…/js/hover.js">`. The module is optional: without it the attribute does nothing and the dropdown still works by click.

Write the attribute once, on the outermost dropdown. Every submenu inside it opens under the pointer too, with no attribute of its own. The exception is a grouped panel's sections, which are already shown, so there is nothing to open.

Hover is added only where the pointer can actually hover, so a touch screen keeps the tap. Opening waits for `--yeti-dropdown-open-delay` so a pointer crossing the trigger on its way somewhere else does not flash the panel open, and closing waits for `--yeti-dropdown-close-delay` so the gap between the trigger and the panel is forgiving. Hovering the panel itself keeps it open.

The module closes only a panel it opened itself. A panel you opened with Enter or a click stays open when the pointer wanders off it, because the deliberate act should outrank the accidental one. Pressing the trigger while hover has the panel open closes it, and a press always cancels an opening that has not happened yet, so the same gesture never does opposite things depending on how long you lingered.

With submenus the same rules hold at every level. Leaving the menu for the page closes every level the module opened. Crossing the small gap from a row to its flyout keeps the panels above it open. A press on any level's button is never raced by an opening that is still waiting. Hover leaves alone a submenu that is already shown in place, such as a section of a grouped panel, so it is never lifted out of its column.

```html
<div class="dropdown" data-trigger="hover">
	<button class="button" type="button" popovertarget="products" data-emphasis="low">Products</button>
	<div id="products" popover>
		<a href="#">Overview</a>
		<a href="#">Pricing</a>
	</div>
</div>
<script type="module" src="…/js/hover.js"></script>
```

This module is a stopgap and says so. The `interestfor` attribute is this feature standardised, and it is in one engine today. When it reaches Baseline the module goes and the attribute maps to it instead.

## Accessibility

The items are ordinary links and buttons, on purpose. `role="menu"` and `role="menuitem"` promise a full application menu, arrow keys and all, and a half-built one is worse than none; a disclosure panel of links is announced clearly by every screen reader and needs no script. Give the trigger a name, and let the browser handle the expanded state rather than setting `aria-expanded` yourself. A split parent's button has no text, so its `aria-label` is its name. Escape closes the panel and returns focus to the trigger, which is the browser's doing; with submenus open it closes the innermost one first.

Opening on hover changes none of that. The module never touches focus, ARIA, or the keyboard; it only opens and closes the same popover the button already opens, and a reader who cannot use a pointer is unaffected either way.
