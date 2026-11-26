## When to use it

A row of links to sibling pages, with the current one marked. Think of a repository's Code, Issues and Pull requests, or the sections of an account area. Each tab is its own page, so the row is navigation and every tab has a URL.

Use `tabs` instead when the panels are all on one page and a tab only switches which one shows. That component has the tab roles, the arrow keys and a script. `tabnav` has none of them: it is a list of links that looks like tabs. For a column of links in a sidebar, use `subnav`.

## How it works

A `nav` holding one list, one link per item. The current page's link carries `aria-current="page"`. A tab for a section that holds the current page may carry `aria-current="true"`. Any value but `false` marks the link.

```html
<nav class="tabnav" aria-label="Repository">
	<ul role="list">
		<li><a href="/code/" aria-current="page">Code</a></li>
		<li><a href="/issues/">Issues</a></li>
		<li><a href="/pulls/">Pull requests</a></li>
	</ul>
</nav>
```

The links sit in one row and their text never wraps. A rule in `--yeti-tabs-border` runs along the bottom. The marked link takes the variant's text color, and its edge in the variant's color covers the rule. A link under the pointer takes the variant's subtle tint. The look is the same as `tabs`: the same spacing between tabs, the same transition, and the same two tokens, `--yeti-tabs-border` and `--yeti-tabs-padding`, so a theme that restyles one restyles both. A tab that is taller than the rest, with an icon or a badge, does not lift the others off the rule: every link fills its item's height.

`data-variant` picks the hue, primary by default. `data-emphasis="high"` fills the marked link with the variant, as a solid chip with rounded top corners.

```html demo sm
<nav class="tabnav" aria-label="Account" data-variant="secondary" data-emphasis="high">
	<ul role="list">
		<li><a href="#" aria-current="page">Profile</a></li>
		<li><a href="#">Keys</a></li>
		<li><a href="#">Billing</a></li>
	</ul>
</nav>
```

When the links do not fit, the row scrolls sideways inside itself. The page does not, even when the `tabnav` sits in a flex or grid row. The rule stays put while the links move.

The reader needs a sign that there is more. The browser's own scrollbar is always there. Where it is a classic one it is thin, and it sits inside the row, between the links and the rule. Where it is an overlay one, as on a phone, it shows nothing at rest. Where the browser supports scroll timelines, the row also fades out at whichever edge has more links beyond it. At the start only the end fades, at the end only the start fades, and a row that fits does not fade at all. Each fade grows over the first tenth of the scroll and shrinks over the last tenth, so on a row that overflows by only a few pixels it appears at once. The fade follows the reader's own scrolling and does not move on its own, so it stays under `prefers-reduced-motion`.

Where the browser supports `scroll-initial-target`, the row opens scrolled so the marked link is in view, stopped just clear of the faded edge. That matters on a phone, where the current tab is often past the edge. A browser without it starts the row at its start.

There is no script. Nothing to load, and no ids to wire up.

## Accessibility

Label the `nav`, with `aria-label="Repository"` or similar, because the page has at least one other nav and they have to be told apart. Put `role="list"` on the `ul`, which keeps WebKit announcing it as a list once its markers are gone.

These are links, not tabs. Do not add `role="tablist"` or `role="tab"`: a screen reader would then promise arrow keys and panels that are not there. Tab moves through the links in order, and Enter follows one. The row scrolls to bring each focused link into view.

The current page's `aria-current="page"` is what a screen reader announces; the color and the edge are the visible half of the same fact. The row clips what overflows it, so focus rings are drawn inside each link and are never cut off.
