## When to use it

The bar across the top of a site: the name, the main links, a button or two. It is a bar of links, not a menu system. Sections with their own submenus are the dropdown's job, and a column of links down the side of a page, with sections that open in place, is a [subnav](subnav.md).

## How it works

One list of links, two modes. The list carries `popover` and the button carries `popovertarget` naming it. When the bar is narrower than `data-threshold` (its own width, not the screen's, so a nav in a narrow column collapses while the same one across a page does not), the list is a closed popover and the button opens it; light dismiss, Escape, and the button's expanded state all come from the browser. At the threshold and above, the nav's own container query puts the list back in the bar and hides the button. The `popover` attribute is still there, so nothing changes in the markup and no link exists twice.

`data-panel` chooses the shape of the open list. `sheet`, the default, hangs under the bar at the full width. `drawer` slides in from the start edge as a column with the page dimmed behind it. `screen` fills the viewport with the links large and centred. Where anchor positioning exists the sheet sits exactly under the bar; elsewhere it starts at the top of the viewport and covers the bar, and Escape or a click outside still closes it. A close item, an `li` carrying `data-close` with a button that hides the popover, sits in the panel's top end corner and disappears in the bar; `screen` needs one, since there is no outside to click.

```html
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

`data-sticky` keeps the bar at the top of the scrollport as the page scrolls, flush with the edge. Everything else on the page that sticks stops at `--yeti-sticky-offset` and would slide under the bar, so set the token to the bar's own height plus the gap you want on whatever holds them — the shell's body row, say. The bar doesn't read the token; a bar that floats below the edge sets `inset-block-start` itself.

Links that point down the same page (`href="#pricing"`) turn on smooth scrolling for the page, through `--yeti-toc-scroll`, the same switch a `toc` uses; a bare `href="#"` placeholder does not count, and under reduced motion the page goes back to the browser's jump.

The brand is a wordmark, a logo or both, so it has tokens of its own: `--yeti-nav-brand-weight`, `--yeti-nav-brand-size` and `--yeti-nav-logo-size`. An `svg` or `img` straight inside the brand sits beside the name, centered on it, at the height of the bar's controls, with its width following the drawing:

```html
<a href="/" data-brand><svg aria-hidden="true" viewBox="0 0 24 24">…</svg>The Copper Pan</a>
```

The name is the link's text, so the logo beside it is decoration: `aria-hidden` on an `svg`, an empty `alt` on an `img`. A brand that is only a logo has no text, so give the logo the name: `alt="The Copper Pan"`, or `aria-label` on the link. A name too long for a narrow bar wraps beside the logo. A short name you would rather keep on one line takes `white-space: nowrap` on the brand, at the risk of pushing a narrow bar past its edge.

Plain links take `--yeti-nav-link`, the bar's own color by default; set it when only the links should change. A link under the pointer takes `--yeti-nav-hover` as its background, and the current link takes `--yeti-nav-current` as its color. Neither is set by default, so they fall back to the variant's subtle tint and its text color, and `data-variant` picks the hue. All three are for the bar. The open panel resets `--yeti-nav-link` to its own text color, and keeps the variant's tints for the hover and the current page, whatever `--yeti-nav-hover` and `--yeti-nav-current` say.

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

## Submenus

A nav item may hold a `dropdown`. Its panel is in the top layer, so the bar's own containment cannot clip it. A section that is a page in its own right is a split parent: the item's link, then an empty button with an `aria-label` that opens the submenu. A section that is not a page has no link, and its button is the label. Submenus can hold submenus, to any depth. The dropdown page covers both shapes and the nesting in full.

```html
<nav class="nav" aria-label="Site" data-panel="drawer">
	<a href="/" data-brand>Yeti</a>
	<button type="button" popovertarget="menu" aria-label="Menu"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
	<ul id="menu" popover role="list">
		<li><a href="/">Home</a></li>
		<li class="dropdown">
			<a href="/about/">About</a>
			<button type="button" popovertarget="menu-about" aria-label="About pages"></button>
			<ul id="menu-about" popover role="list">
				<li><a href="/about/history/">History</a></li>
				<li class="dropdown">
					<a href="/about/team/">Team</a>
					<button type="button" popovertarget="menu-about-team" aria-label="Team pages"></button>
					<ul id="menu-about-team" popover role="list">
						<li><a href="/about/team/joe/" aria-current="page">Joe</a></li>
					</ul>
				</li>
			</ul>
		</li>
		<li class="dropdown">
			<button type="button" popovertarget="menu-more">More</button>
			<ul id="menu-more" popover role="list">
				<li><a href="/changelog/">Changelog</a></li>
			</ul>
		</li>
	</ul>
</nav>
<script type="module" src="…/js/nav.js"></script>
```

In the bar a split parent is its link followed by a compact button with a chevron, and a label button carries a chevron after its text. The first level opens under its item as the dropdown's usual card, and a submenu inside it flies out to the side. The current page's `aria-current="page"` is the only mark to write: each parent above it, in the bar and in every panel, takes the current color at the normal weight. A grouped dropdown's heading keeps its strong weight and only changes color.

The nav and the dropdown each color their own links. In the bar, the nav's link, hover and current rules reach the list's links and each top-level dropdown's own link and button, and stop at the edge of the dropdown's panel. Everything inside that panel, at every depth, takes the dropdown's tokens: `--yeti-dropdown-surface`, `--yeti-dropdown-text` and `--yeti-dropdown-hover`. So a theme that sets a light `--yeti-nav-link` for a dark bar does not also turn the links on a light dropdown panel light. The current page's link inside that panel, and each parent above it there, take `--yeti-dropdown-current`, which falls back to the variant's text color, rather than `--yeti-nav-current`, which colors only the bar's own links and the top-level parent that holds the page. Once the links are behind the toggle it is the other way round in the nav's open panel: a submenu shown in place is part of the panel, so its links take the panel's text, `--yeti-nav-panel-text`, and not the dropdown's tokens. The open panel has its own surface, so the bar's `--yeti-nav-hover` and `--yeti-nav-current` do not reach it either. Every link in it, a submenu's included, takes the variant's subtle tint under the pointer, and the current page and each parent that holds it take the variant's text color.

## Submenus in the panel

Once the links are behind the toggle, a split parent's pages are shown in the nav's open panel itself, in place, each level indented one step further than the one above it. They look like the panel's own links: the panel's text color, and the variant's tints for the hover and the current page. With no script every level of a split parent is open and the small buttons are hidden, so every page under it is one tap away and Tab walks the links in the order they are shown. A label-only section is the exception, even when it sits inside a split parent's pages: it opens as described below. That is enough for a short tree.

For a long one, load `nav.js` once, with `<script type="module" src="…/js/nav.js">`. Each group in the nav's open panel then gets its button back and can be opened and closed in place. The branch that holds the current page starts open and the others start closed. What the reader opens or closes is remembered until they leave the page, so closing the panel and opening it again shows the same groups. Opening one group leaves its siblings as they are, so a reader comparing two sections can keep both open. The links of a closed group are skipped by Tab. A group grows open over `--yeti-duration-base`, so under reduced motion it simply appears. Where the panel has a close item and its first link is a group, the close button takes a row of its own above it, since the group's button sits in the same corner.

The module marks each button with `aria-expanded` while the nav's open panel is shown. That attribute is what folds the group and what a screen reader announces. Do not write `aria-expanded` yourself. The module takes it off again when the nav's panel closes, because in the bar the same button opens its popover, and the browser reports that state itself. `nav.js` does nothing while the links are in the bar.

A section with no page of its own, a label button such as More, works the same way with the module: its button opens and closes its group in place. Without the module it opens differently. A split parent can hide its button because its link names the section; a label-only parent cannot, since its button is its name, and its own panel opens as a full-width block docked to the foot of its button and squared off against the edges of the nav's open panel, so a sheet, a drawer and a screen each keep it inside them. The block keeps the dropdown's own surface and text tokens, not the nav panel's. It is still a popover, so it covers the items below rather than pushing them down, and Escape or a click outside closes it before the nav's panel it sits in. Where anchor positioning is missing the block docks to the foot of the viewport, which is still full width and still within reach.

In a `screen` panel everything is centred, so a submenu has no indent. Each level steps down in size instead, to 0.875 times the size of the one above it.

## Accessibility

Give the `nav` an `aria-label`, since a page often has more than one. The toggle needs a name, from `aria-label` or visible text; the browser sets its expanded state. Mark the current page's link with `aria-current="page"`. Put `role="list"` on the `ul`, and on each submenu's: Yeti's reset only removes list markers where that role says the list is decorative. A split parent's button has no text, so give it an `aria-label` that names its pages, such as "About pages". The open panel follows the toggle in the tab order, so Tab from the toggle reaches the first link; Escape closes the panel and returns focus to the toggle.
