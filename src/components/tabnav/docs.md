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

The links sit in one row and their text never wraps. A rule in `--yeti-tabs-border` runs along the bottom. The marked link takes the variant's text color, and its edge in the variant's color covers the rule. A link under the pointer takes the variant's subtle tint. The look is the same as `tabs`, and it reads the same two tokens, `--yeti-tabs-border` and `--yeti-tabs-padding`, so a theme that restyles one restyles both.

`data-variant` picks the hue, primary by default. `data-emphasis="high"` fills the marked link with the variant, as a solid chip with rounded top corners.

```html
<nav class="tabnav" aria-label="Account" data-variant="secondary" data-emphasis="high">
	<ul role="list">
		<li><a href="/account/profile/" aria-current="page">Profile</a></li>
		<li><a href="/account/keys/">Keys</a></li>
		<li><a href="/account/billing/">Billing</a></li>
	</ul>
</nav>
```

When the links do not fit, the row scrolls sideways inside itself. The page does not. The rule stays put while the links move.

The reader needs a sign that there is more. Where the browser supports scroll timelines, the scrollbar is hidden and the row fades out at whichever edge has more links beyond it. At the start only the end fades, at the end only the start fades, and a row that fits does not fade at all. Elsewhere the browser's own thin scrollbar is the sign. The fade follows the reader's own scrolling and does not move on its own, so it stays under `prefers-reduced-motion`.

Where the browser supports `scroll-initial-target`, the row opens scrolled so the marked link is in view. That matters on a phone, where the current tab is often past the edge. A browser without it starts the row at its start.

There is no script. Nothing to load, and no ids to wire up.

## Accessibility

Label the `nav`, with `aria-label="Repository"` or similar, because the page has at least one other nav and they have to be told apart. Put `role="list"` on the `ul`, which keeps it a list where the reset removes the markers.

These are links, not tabs. Do not add `role="tablist"` or `role="tab"`: a screen reader would then promise arrow keys and panels that are not there. Tab moves through the links in order, and Enter follows one. The row scrolls to bring each focused link into view.

The current page's `aria-current="page"` is what a screen reader announces; the color and the edge are the visible half of the same fact. The row clips what overflows it, so focus rings are drawn inside each link and are never cut off.
