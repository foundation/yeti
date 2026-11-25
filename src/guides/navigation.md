---
raw: true
title: "Navigation"
description: "Which of Yeti's navigation parts to use when, from the site's bar to a page's own contents, and a footer of link columns built from the layouts."
nav_group: "Guides"
nav_order: 13
---

# Navigation

<p class="lede">Yeti has seven parts for getting around a site, and each one does one job. This page says which part to reach for and which to leave alone. It also shows patterns that need no component of their own, built from the parts that already exist.</p>

## Which part when

<div class="scroller" role="region" aria-label="Which navigation part to use" tabindex="0" markdown="1">

| Part | For | Not for |
| --- | --- | --- |
| [nav](../nav.md) | The site's main bar: the name, the main links, a button or two. As a rule there is one per page. When the bar is too narrow, the links fold behind a toggle and open as a panel. | A tree of pages down a sidebar, which is `subnav`, or a row of tabs, which is `tabnav`. |
| [dropdown](../dropdown.md) | A short menu of links or actions on one button: the pages under a nav item, an account menu, a row's secondary actions. | A panel of other content beside a button, such as a quick form or a short explanation, which is [popover](../popover.md). Choosing a value in a form, which is a `select` in a field. |
| [subnav](../subnav.md) | A sidebar: a column of a site's pages, whose sections open in place on `details`. It stays a column at every width. | The bar across the top of the site, which is `nav` with dropdowns. |
| [tabnav](../tabnav.md) | Links to sibling pages, drawn as tabs, with the current one marked. Each tab is its own page with its own URL, so following one loads that page. | Switching panels inside one page, which is [tabs](../tabs.md). |
| [breadcrumbs](../breadcrumbs.md) | Where this page sits in the hierarchy, with one click to each level above it. | A menu. It only goes up, one level at a time. |
| [toc](../toc.md) | Links to the headings of the page being read, with the reader's current section marked. | Links to other pages. |
| [pagination](../pagination.md) | Stepping through a list split into numbered pages: search results, an archive, a long table. | The sections of a site. |

</div>

Three of these get confused. On a phone, the nav's open panel looks like a subnav, but it is the same nav in its narrow mode: the same list of links, shown as a panel below the nav's threshold and back in the bar above it. A subnav is a column at every width. A tabnav looks like a nav, since both are a row of links, but it marks the sibling pages of one section. It usually sits under the page heading, below the site's nav, not in its place.

## A footer of link columns

Many sites end with a footer of links in columns, each under a short heading, and a line of small print below. Yeti has no footer component, because the layouts already make one: a sunken `box` for the band, a `container` so that what sits inside can answer to the footer's width, a `grid` for the columns, a `stack` for each column, and a `cluster` for the small print.

```html demo lg sm
<footer class="box" data-surface="sunken">
	<div class="container stack" data-gap="xl">
		<nav class="grid" data-min="2xs" data-gap="lg" aria-label="Footer">
			<div class="stack" data-gap="sm">
				<h5>Product</h5>
				<ul class="stack" data-gap="xs" role="list">
					<li><a href="#">Features</a></li>
					<li><a href="#">Pricing</a></li>
					<li><a href="#">Changelog</a></li>
					<li><a href="#">Roadmap</a></li>
				</ul>
			</div>
			<div class="stack" data-gap="sm">
				<h5>Company</h5>
				<ul class="stack" data-gap="xs" role="list">
					<li><a href="#">About</a></li>
					<li><a href="#">Careers</a></li>
					<li><a href="#">Press</a></li>
					<li><a href="#">Contact</a></li>
				</ul>
			</div>
			<div class="stack" data-gap="sm">
				<h5>Resources</h5>
				<ul class="stack" data-gap="xs" role="list">
					<li><a href="#">Docs</a></li>
					<li><a href="#">Guides</a></li>
					<li><a href="#">Blog</a></li>
				</ul>
			</div>
			<div class="stack" data-gap="sm">
				<h5>Legal</h5>
				<ul class="stack" data-gap="xs" role="list">
					<li><a href="#">Privacy</a></li>
					<li><a href="#">Terms</a></li>
					<li><a href="#">Cookies</a></li>
				</ul>
			</div>
		</nav>
		<div class="cluster" data-justify="between">
			<p><small>© 2026 Acme Ltd.</small></p>
			<ul class="cluster" data-gap="sm" role="list">
				<li><a href="#"><small>Status</small></a></li>
				<li><a href="#"><small>Accessibility</small></a></li>
				<li><a href="#"><small>Sitemap</small></a></li>
			</ul>
		</div>
	</div>
</footer>
```

The grid fits as many columns as its width allows, so the four columns sit in a row on a wide screen and drop to fewer in each row as the footer narrows, down to one. The small print wraps the same way.

One `nav`, labelled "Footer", holds all four columns. A `nav` for each column would add four more landmarks, and for someone moving through the page by landmark with a screen reader, that is four more stops that say little.

The column headings are real headings, so a screen reader can list them and jump between them. Yeti sizes a heading by its level and nothing else: `data-size` is for controls and does not change a heading. So the example uses `h5`, the level drawn at body size, the same size as the links under it. On a page whose outline stops at `h2`, an `h5` skips two levels, and some checkers flag that. Use the level that follows your own page's outline, usually `h2` for a footer, and set its size in your own CSS. Each list carries `role="list"`, which keeps it a list for a screen reader after the reset removes the markers.

The links keep the look every plain link has, the link color and an underline. For a quieter footer, give the footer a grey with `data-text`, such as `data-text="grey-70"`. The footer's words take that grey, and a plain link inside it takes the same grey instead of the link color, under the pointer too. The underline stays, so a link still looks like a link. A link with a class, such as a `.button`, keeps its own colors.

This is an example, not a recipe. It adds no CSS: every rule it uses belongs to a part with its own page. Change the columns, the headings and the small print to suit the site.

## A mega menu

A mega menu is a wide panel under one item of the site's nav: columns of links, each under a short heading, and often a card that points to something new. Yeti has no mega menu component, because a plain `dropdown` already makes one. Its panel holds a `grid` of `stack`s, one for each column of links, and a `card`.

```html demo lg
<nav class="nav" aria-label="Site">
	<a href="#" data-brand>Acme</a>
	<button type="button" popovertarget="mega-site" aria-label="Menu"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
	<ul id="mega-site" popover role="list">
		<li class="dropdown" style="--yeti-dropdown-min: min(56rem, calc(100vw - 2rem))">
			<button type="button" popovertarget="mega-products">Products</button>
			<div id="mega-products" popover>
				<div class="grid" data-min="2xs" data-gap="md">
					<div class="stack" data-gap="none">
						<h5 class="box" data-gap="none" data-gap-inline="sm">Build</h5>
						<a href="#">Editor</a>
						<a href="#">Components</a>
						<a href="#">Themes</a>
					</div>
					<div class="stack" data-gap="none">
						<h5 class="box" data-gap="none" data-gap-inline="sm">Ship</h5>
						<a href="#">Hosting</a>
						<a href="#">Domains</a>
						<a href="#">Analytics</a>
					</div>
					<div class="stack" data-gap="none">
						<h5 class="box" data-gap="none" data-gap-inline="sm">Learn</h5>
						<a href="#">Guides</a>
						<a href="#">Templates</a>
						<a href="#">Community</a>
					</div>
					<div class="card">
						<h5>New this month</h5>
						<p>Publish straight from the editor, with a preview link for every change.</p>
						<footer><a class="button" href="#">Take the tour</a></footer>
					</div>
				</div>
			</div>
		</li>
		<li><a href="#">Pricing</a></li>
		<li><a href="#">Docs</a></li>
		<li><a href="#">Blog</a></li>
	</ul>
</nav>
```

The panel's width comes from the dropdown's own token, `--yeti-dropdown-min`, set on the dropdown. Here it is `min(56rem, calc(100vw - 2rem))`: wide on a large screen, and never wider than the screen less a margin. Where the panel would pass the edge of the screen, it moves back in and keeps a margin from that edge.

The links in the columns become menu rows, with the dropdown's padding and hover fill, as they would in any panel. The `.button` in the card keeps its own look, its fill and its corners, so the call to action still reads as one.

A row's padding keeps its label in from the edge of its hover fill, so a plain heading above the links would sit further out than they do. Each column heading here is a `box` with `data-gap="none"` and `data-gap-inline="sm"`, which pads it in by the same step, so the heading and its links line up.

Below the nav's threshold the same panel shows inside the nav's open panel, and the grid drops to one column, so the columns and the card read down the page in order.

Leave `data-grouped` off. It is for a section whose own pages sit in columns under their parent pages, and it lays the panel out in its own way: a grid inside it loses its columns.

Give the card a plain heading, not a link. Every link in a panel is drawn as a menu row, and that includes a link inside a heading. The button below the heading is the card's link.
