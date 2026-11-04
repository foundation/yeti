## When to use it

The bar across the top of a site: the name, the main links, a button or two. It is a bar of links, not a menu system. Sections with their own submenus are the dropdown's job, and a column of links down the side of a page is a `stack` inside a `sidebar`, which needs no component.

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

A nav item may hold a `dropdown` for a section with children of its own: the item becomes a button rather than a link, since the dropdown brings its own trigger. Its panel is in the top layer, so the bar's own containment cannot clip it.

The panel changes shape with the nav. In the bar it is the dropdown's usual card, anchored under its trigger. Once the links are behind the toggle it becomes a full-width block instead, docked to the foot of its trigger and squared off against the panel's own edges, so a sheet, a drawer and a screen each keep their submenu inside them. It is still a popover, so it covers the items below rather than pushing them down, and Escape or a click outside closes it before the panel it sits in. Where anchor positioning is missing the block docks to the foot of the viewport, which is still full width and still within reach.

`data-sticky` keeps the bar at the top of the scrollport as the page scrolls, flush with the edge. Everything else on the page that sticks stops at `--yeti-sticky-offset` and would slide under the bar, so set the token to the bar's own height plus the gap you want on whatever holds them — the shell's body row, say. The bar doesn't read the token; a bar that floats below the edge sets `inset-block-start` itself.

Links that point down the same page (`href="#pricing"`) turn on smooth scrolling for the page, through `--yeti-toc-scroll`, the same switch a `toc` uses; a bare `href="#"` placeholder does not count, and under reduced motion the page goes back to the browser's jump.

The brand is a wordmark, a logo or both, so it has tokens of its own: `--yeti-nav-brand-weight`, `--yeti-nav-brand-size` and `--yeti-nav-logo-size`. An `svg` or `img` straight inside the brand sits beside the name, centered on it, at the height of the bar's controls, with its width following the drawing:

```html
<a href="/" data-brand><svg aria-hidden="true" viewBox="0 0 24 24">…</svg>The Copper Pan</a>
```

The name is the link's text, so the logo beside it is decoration: `aria-hidden` on an `svg`, an empty `alt` on an `img`. A brand that is only a logo has no text, so give the logo the name: `alt="The Copper Pan"`, or `aria-label` on the link. A name too long for a narrow bar wraps beside the logo. A short name you would rather keep on one line takes `white-space: nowrap` on the brand, at the risk of pushing a narrow bar past its edge.

Plain links take `--yeti-nav-link`, the bar's own color by default; set it when only the links should change. The current link and a hovered link keep the variant's tints, and the open panel resets it to its own text color.

A bar with one dark color in both modes takes a scheme, not a list of colors. `color-scheme: dark` flips the bar, its links, the hover and current tints, the toggle and the open panel together, and `--yeti-nav-surface` gives the bar its color:

```css
.nav { color-scheme: dark; --yeti-nav-surface: oklch(30% 0.05 40); }
```

The hover and current tints are the dark scheme's own. A design with its own colors for them, or a bar whose color differs between light and dark, keeps its own rules for the bar and its states instead.

The open panel has its own pair, `--yeti-nav-panel` and `--yeti-nav-panel-text`. Set them together: the panel's links and close button follow the text token, and `--yeti-nav-link` does not reach them.

A long wordmark in a narrow bar breaks into two balanced lines rather than pushing the bar past its edge.

The actions slot takes anything, not only buttons: a running head, a version, a phone number. It inherits the bar's type, so quiet text is the page's two declarations:

```css
.nav > [data-actions] { font-size: var(--yeti-text-sm); color: var(--yeti-color-text-muted); }
```

## Accessibility

Give the `nav` an `aria-label`, since a page often has more than one. The toggle needs a name, from `aria-label` or visible text; the browser sets its expanded state. Mark the current page's link with `aria-current="page"`. Put `role="list"` on the `ul`: Yeti's reset only removes list markers where that role says the list is decorative. The open panel follows the toggle in the tab order, so Tab from the toggle reaches the first link; Escape closes the panel and returns focus to the toggle.
