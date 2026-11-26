## When to use it

The bar across the top of a site: the name, the main links, a button or two. It is a bar of links, not a menu system. Sections with their own submenus are the dropdown's job, and a column of links down the side of a page, with sections that open in place, is a [subnav](subnav.md).

## How it works

One list of links, two modes. The list carries `popover` and the button carries `popovertarget` naming it. When the bar is narrower than `data-threshold` (its own width, not the screen's, so a nav in a narrow column collapses while the same one across a page does not), the list is a closed popover and the button opens it; light dismiss, Escape, and the button's expanded state all come from the browser. At the threshold and above, the nav's own container query puts the list back in the bar and hides the button. The `popover` attribute is still there, so nothing changes in the markup and no link exists twice.

`data-panel` chooses the shape of the open list. `sheet`, the default, hangs under the bar at the full width. `drawer` slides in from the start edge as a column with the page dimmed behind it. `screen` fills the viewport with the links large and centred. `bar` is not a panel that opens: it puts the links in a row along the bottom of the screen, and has a section of its own below. Where anchor positioning exists the sheet sits exactly under the bar; elsewhere it starts at the top of the viewport and covers the bar, and Escape or a click outside still closes it. A close item, an `li` carrying `data-close` with a button that hides the popover, sits in the panel's top end corner and disappears in the bar; `screen` needs one, since there is no outside to click.

```html demo md sm
<nav class="nav" aria-label="Site" data-threshold="sm" data-panel="drawer">
	<a href="#" data-brand>Yeti</a>
	<button type="button" popovertarget="menu" aria-label="Menu"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
	<ul id="menu" popover role="list">
		<li data-close><button type="button" popovertarget="menu" popovertargetaction="hide" aria-label="Close">×</button></li>
		<li><a href="#">Docs</a></li>
		<li><a href="#">Blog</a></li>
	</ul>
</nav>
```

A panel that is open stays a panel until it is dismissed, whatever the nav's width; widening past the threshold does not return the links to the bar on its own. Escape or a click outside closes the panel, and only then do the links return to the bar. `data-threshold` is the attribute `columns` uses, so a nav and the columns under it can switch at the same width.

A nav item may hold a `dropdown` for a section with pages of its own; the Submenus section below shows how.

`data-justify` says where the links sit in the bar. By default they sit beside the brand, and an element carrying `data-actions` takes the end. `data-justify="end"` moves the links to the end of the bar, with the actions straight after them: a brand on one side and everything else on the other. `data-justify="center"` puts the links in the middle of the room between the brand and the actions. That is the middle of the bar only when the brand and the actions are the same width. Below the threshold the toggle stands in for the links, and with either value it sits at the end of the bar. The open panel is not affected.

`data-sticky` keeps the bar at the top of the scrollport as the page scrolls, flush with the edge. Everything else on the page that sticks stops at `--yeti-sticky-offset` and would slide under the bar, so set the token to the bar's own height plus the gap you want on whatever holds them — the shell's body row, say. The bar doesn't read the token; a bar that floats below the edge sets `inset-block-start` itself.

Links that point down the same page (`href="#pricing"`) turn on smooth scrolling for the page, through `--yeti-toc-scroll`, the same switch a `toc` uses; a bare `href="#"` placeholder does not count, and under reduced motion the page goes back to the browser's jump.

The brand is a wordmark, a logo or both, so it has tokens of its own: `--yeti-nav-brand-weight`, `--yeti-nav-brand-size` and `--yeti-nav-logo-size`. An `svg` or `img` straight inside the brand sits beside the name, centered on it, at the height of the bar's controls, with its width following the drawing:

```html
<a href="/" data-brand><svg aria-hidden="true" viewBox="0 0 24 24">…</svg>The Copper Pan</a>
```

The name is the link's text, so the logo beside it is decoration: `aria-hidden` on an `svg`, an empty `alt` on an `img`. A brand that is only a logo has no text, so give the logo the name: `alt="The Copper Pan"`, or `aria-label` on the link. A name too long for a narrow bar wraps beside the logo. A short name you would rather keep on one line takes `white-space: nowrap` on the brand, at the risk of pushing a narrow bar past its edge.

Plain links take `--yeti-nav-link`, the bar's own color by default; set it when only the links should change. A link under the pointer takes `--yeti-nav-hover` as its background, and the current link takes `--yeti-nav-current` as its color. Neither is set by default, so they fall back to the variant's subtle tint and its text color, and `data-variant` picks the hue. For a filled current link, the pill many bars use, set `--yeti-nav-current-surface`: it is the background of the current link and of the top-level parent that holds the current page, and it is off until you set it. A link under the pointer still shows the hover fill, the current one included. All four are for the bar. The open panel resets `--yeti-nav-link` to its own text color, and keeps the variant's tints for the hover and the current page, whatever `--yeti-nav-hover` and `--yeti-nav-current` say, and it does not take the current fill.

A bar with one dark color in both modes takes a scheme, not a list of colors. `color-scheme: dark` flips the bar, its links, the hover and current tints, the toggle and the open panel together, and `--yeti-nav-surface` gives the bar its color:

```css
.nav { color-scheme: dark; --yeti-nav-surface: oklch(30% 0.05 40); }
```

The hover and current tints are the dark scheme's own. A design with its own colors for them, or a bar whose color differs between light and dark, keeps its own rules for the bar and its states instead.

The open panel has its own pair, `--yeti-nav-panel` and `--yeti-nav-panel-text`. Set them together: the panel's links and close button follow the text token, and `--yeti-nav-link` does not reach them. Nor do the bar's hover and current tokens, so a dark bar with light ones can sit over a light panel, which keeps the variant's tints.

A long wordmark in a narrow bar breaks into two balanced lines rather than pushing the bar past its edge.

The actions slot takes anything, not only buttons: a running head, a version, a phone number. It inherits the bar's type, so quiet text is the page's two declarations:

```css
.nav > [data-actions] { font-size: var(--yeti-text-sm); color: var(--yeti-color-text-muted); }
```

## A bar at the bottom of the screen

Many phone designs keep the main links in a row along the bottom of the screen, in reach of a thumb, instead of behind a menu button. `data-panel="bar"` does that. Below the threshold the links leave the top bar and sit in a row fixed to the bottom of the screen, where they stay as the page scrolls. The brand and the actions stay in the top bar. At the threshold and above, the nav is the same bar as any other.

Give each link an icon and a short label. The icon is an `svg` or `img` straight inside the link, and it sits above the label. A link with no icon shows its label alone. At the threshold and above, in the top bar, an `svg` icon sits beside its label, before it, at the size of the text, as it does in a row of a dropdown's panel such as More's. An `img` keeps its own size there, so give it a `width` and a `height` that suit both places. There is no toggle in this mode, so you can leave it out:

```html demo md sm
<nav class="nav" aria-label="Site" data-panel="bar">
	<a href="#" data-brand>Yeti</a>
	<ul id="bar-menu" popover role="list">
		<li><a href="#" aria-current="page"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 8l6-6 6 6M4 7v7h8V7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>Home</a></li>
		<li><a href="#"><svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="1.5"/></svg>Search</a></li>
		<li><a href="#"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 9l2-6h8l2 6v4H2zM2 9h4l1 2h2l1-2h4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>Inbox</a></li>
		<li><a href="#"><svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 15c0-3 3-5 6-5s6 2 6 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>Account</a></li>
	</ul>
</nav>
```

Drag the demo's frame wider and the links go back to the top bar.

The label is the link's name, so the icon is decoration: `aria-hidden` on an `svg`, an empty `alt` on an `img`. The current page's link is marked as it is in the top bar, with the same color and weight.

Every link gets an equal share of the row. The row never wraps and never scrolls sideways, so a label that does not fit is cut off with an ellipsis. That is why the bar suits five links or fewer. With more, each one gets too narrow for its label, unless the list ends with [a More menu](#links-that-do-not-fit-a-more-menu). A split parent gives part of its share to its toggle, so its label has even less room; a short label, or a dropdown with no link of its own, suits the bar better.

A link that is a `dropdown` opens its panel upward, as a card above the bar. Where anchor positioning is missing, the browser centres the panel on the screen instead, as it does for any dropdown.

The bar covers the bottom of the page, and the nav cannot make room for it from inside itself. So the page needs one rule that leaves room under its last line, the bar's height plus the phone's safe area, at the screen widths where the bar shows:

```css
@media (width < 36rem) {
	body { padding-block-end: calc(2 * var(--yeti-leading-sm) * var(--yeti-text-sm) + 2 * var(--yeti-space-xs) + var(--yeti-border-width) + env(safe-area-inset-bottom)); }
}
```

The bar's height is worked out from the tokens it uses: two lines of the label, an icon being one line tall, plus its padding and its top edge. The safe area is only reported to a page whose viewport meta tag includes `viewport-fit=cover`.

The threshold is the nav's own width, not the screen's, while the rule above follows the screen. The two agree only while the nav is as wide as the screen. That is the usual place for a site's nav, and it is where this mode belongs. Even then the nav measures its own content box, the room inside its padding, so it switches when the screen is a little wider than the threshold. That is why the rule's width is a little wider than md's 32rem: room the page does not need does no harm, but a bar over the last line does. For another threshold, or a nav with more padding, take the threshold plus the nav's inline padding on both sides, and round up.

A fixed bar is placed against the screen only while no ancestor of the nav has a `transform`, a `filter`, a `backdrop-filter`, or a `contain` that includes layout or paint. Such an ancestor traps it, and the bar then sits at the foot of that ancestor instead of the screen, so keep the nav outside a wrapper like that.

## Submenus

A nav item may hold a `dropdown`. Its panel is in the top layer, so the bar's own containment cannot clip it. A section that is a page in its own right is a split parent: the item's link, then an empty button with an `aria-label` that opens the submenu. A section that is not a page has no link, and its button is the label. Submenus can hold submenus, to any depth. The dropdown page covers both shapes and the nesting in full.

```html demo md
<nav class="nav" aria-label="Site" data-panel="drawer">
	<a href="#" data-brand>Yeti</a>
	<button type="button" popovertarget="sub-menu" aria-label="Menu"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
	<ul id="sub-menu" popover role="list">
		<li><a href="#">Home</a></li>
		<li class="dropdown">
			<a href="#">About</a>
			<button type="button" popovertarget="sub-menu-about" aria-label="About pages"></button>
			<ul id="sub-menu-about" popover role="list">
				<li><a href="#">History</a></li>
				<li class="dropdown">
					<a href="#">Team</a>
					<button type="button" popovertarget="sub-menu-about-team" aria-label="Team pages"></button>
					<ul id="sub-menu-about-team" popover role="list">
						<li><a href="#" aria-current="page">Joe</a></li>
					</ul>
				</li>
			</ul>
		</li>
		<li class="dropdown">
			<button type="button" popovertarget="sub-menu-more">More</button>
			<ul id="sub-menu-more" popover role="list">
				<li><a href="#">Changelog</a></li>
			</ul>
		</li>
	</ul>
</nav>
```

In the bar a split parent is its link followed by a compact button with a chevron, and a label button carries a chevron after its text. The first level opens under its item as the dropdown's usual card, and a submenu inside it flies out to the side. The current page's `aria-current="page"` is the only mark to write: each parent above it, in the bar and in every panel, takes the current color at the normal weight. A grouped dropdown's heading keeps its strong weight and only changes color.

The nav and the dropdown each color their own links. In the bar, the nav's link, hover and current rules reach the list's links and each top-level dropdown's own link and button, and stop at the edge of the dropdown's panel. Everything inside that panel, at every depth, takes the dropdown's tokens: `--yeti-dropdown-surface`, `--yeti-dropdown-text` and `--yeti-dropdown-hover`. So a theme that sets a light `--yeti-nav-link` for a dark bar does not also turn the links on a light dropdown panel light. The current page's link inside that panel, and each parent above it there, take `--yeti-dropdown-current`, which falls back to the variant's text color, rather than `--yeti-nav-current`, which colors only the bar's own links and the top-level parent that holds the page. Once the links are behind the toggle it is the other way round in the nav's open panel: a submenu shown in place is part of the panel, so its links take the panel's text, `--yeti-nav-panel-text`, and not the dropdown's tokens. The open panel has its own surface, so the bar's `--yeti-nav-hover` and `--yeti-nav-current` do not reach it either. Every link in it, a submenu's included, takes the variant's subtle tint under the pointer, and the current page and each parent that holds it take the variant's text color.

## Submenus in the panel

Once the links are behind the toggle, a split parent's pages are shown in the nav's open panel itself, in place, each level indented one step further than the one above it. They look like the panel's own links: the panel's text color, and the variant's tints for the hover and the current page. With no script every level of a split parent is open and the small buttons are hidden, so every page under it is one tap away and Tab walks the links in the order they are shown. A label-only section is the exception, even when it sits inside a split parent's pages: it opens as described below. That is enough for a short tree.

For a long one, load `nav.js` once, with `<script type="module" src="…/js/nav.js">`. Each group in the nav's open panel then gets its button back and can be opened and closed in place. The branch that holds the current page starts open and the others start closed. What the reader opens or closes is remembered until they leave the page, so closing the panel and opening it again shows the same groups. Opening one group leaves its siblings as they are, so a reader comparing two sections can keep both open. The links of a closed group are skipped by Tab. A group grows open over `--yeti-duration-base`, so under reduced motion it simply appears. Where the panel has a close item and its first link is a group, the close button takes a row of its own above it, since the group's button sits in the same corner.

The module marks each button with `aria-expanded` while the nav's open panel is shown. That attribute is what folds the group and what a screen reader announces. Do not write `aria-expanded` yourself. The module takes it off again when the nav's panel closes, because in the bar the same button opens its popover, and the browser reports that state itself. The folding does nothing while the links are in the bar.

A section with no page of its own, a label button such as Resources, works the same way with the module: its button opens and closes its group in place. Without the module it opens differently. A split parent can hide its button because its link names the section; a label-only parent cannot, since its button is its name, and its own panel opens as a full-width block docked to the foot of its button and squared off against the edges of the nav's open panel, so a sheet, a drawer and a screen each keep it inside them. The block keeps the dropdown's own surface and text tokens, not the nav panel's. It is still a popover, so it covers the items below rather than pushing them down, and Escape or a click outside closes it before the nav's panel it sits in. Where anchor positioning is missing the block docks to the foot of the viewport, which is still full width and still within reach.

In a `screen` panel everything is centred, so a submenu has no indent. Each level steps down in size instead, to 0.875 times the size of the one above it.

## Links that do not fit: a More menu

A bar with many links runs out of room before it reaches its threshold, and its links would squeeze together or run past its edge. A More menu fixes that. As the bar narrows, the last links move into a dropdown at the end of the list, and they come back as the bar widens again. It is what most large sites do.

You write the More item yourself, as the last item of the list, hidden. A close item, if the nav has one, may come after it:

```html demo md lg
<nav class="nav" aria-label="Site">
	<a href="#" data-brand>Yeti</a>
	<button type="button" popovertarget="more-list" aria-label="Menu"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
	<ul id="more-list" popover role="list">
		<li><a href="#">Docs</a></li>
		<li><a href="#">Guides</a></li>
		<li><a href="#">Components</a></li>
		<li><a href="#">Layouts</a></li>
		<li><a href="#">Examples</a></li>
		<li><a href="#">Blog</a></li>
		<li><a href="#">Pricing</a></li>
		<li><a href="#">Changelog</a></li>
		<li><a href="#">Community</a></li>
		<li class="dropdown" data-more hidden>
			<button type="button" popovertarget="more-list-more">More</button>
			<ul id="more-list-more" popover role="list"></ul>
		</li>
	</ul>
</nav>
```

The label and the id are yours, so you can write the label in your page's language. The script creates no markup. It needs `nav.js`. Without it the More item stays hidden and the nav works exactly as it does without one.

With the module, while the links are in the bar, as many as fit on one line stay there, in their order. The rest move into the More panel, from the end, and the More item shows. Read together, the links in the bar and the links in More are always in the order you wrote them, and a link that comes back returns to the place it left. The decision counts the room the More button takes, so the bar never flips back and forth between the two. It is made again when the nav changes size, when its brand or its actions change size, such as a logo that loads late, and once the page's fonts have loaded. A link you add to the list later is placed the next time the nav changes size.

A link that moves is a row of the More panel, like any link in a dropdown. A dropdown that moves, in either of its shapes, becomes a submenu that flies out beside its row. When the page being read is one of the links in More, the More button takes the current color, as any dropdown does that holds the current page. If the link with focus moves into More while More is closed, focus goes to the More button. If More is hidden while it has focus, on its button or in its panel, focus goes to the last link in the bar.

Below the threshold every link goes back to the list and More is hidden, so the open panel is the same as it is without More. The links return to the bar when the panel has closed and the nav is wide enough again.

A bottom bar, `data-panel="bar"`, shares its row by count, not by width. With five links or fewer they all show and More is hidden. With more than five, the first four show, the rest go into More, and More takes the fifth place, with its panel opening upward like any dropdown in the bottom bar. Keep any dropdown among the first four links: on a phone there is no room beside More's panel, so a dropdown that moves into More opens its submenu over that panel.

The module finds each nav once, when it runs. A nav added to the page later, such as one in a page that a script swaps into place without a full load, gets no More menu, and its More item stays hidden. The folding of its groups still works. On such a site, keep the nav outside the part of the page that is swapped, so it is the same nav from page to page.

## Accessibility

Give the `nav` an `aria-label`, since a page often has more than one. The toggle needs a name, from `aria-label` or visible text; the browser sets its expanded state. Mark the current page's link with `aria-current="page"`. Put `role="list"` on the `ul`, and on each submenu's: Yeti's reset only removes list markers where that role says the list is decorative. A split parent's button has no text, so give it an `aria-label` that names its pages, such as "About pages". The open panel follows the toggle in the tab order, so Tab from the toggle reaches the first link; Escape closes the panel and returns focus to the toggle.
