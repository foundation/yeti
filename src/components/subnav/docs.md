## When to use it

A sidebar: the pages of a docs site, a section of a large site, a settings area. Use `subnav` for any navigation that stays a column and never becomes a desktop top bar. Its sections open in place and push the rest of the list down, which suits a column and would break a bar.

For a site's main navigation, the row across the top that folds into a panel on a phone, use a `nav` with dropdowns instead. A dropdown opens as a panel over the page, which suits a bar.

## How it works

A list of links. A parent page is its link followed by a `details` that holds its pages. The link goes to the parent's own page, and the `summary` is only the toggle, a control-sized square at the end of the link's row showing the chevron. The parent's pages open below both, one indent further in. The browser does the opening, the keyboard and the announcing, so the component needs no ids and no script.

```html
<nav class="subnav" aria-label="Docs">
	<ul role="list">
		<li><a href="/docs/">Overview</a></li>
		<li>
			<a href="/docs/layouts/">Layouts</a>
			<details open>
				<summary aria-label="Layouts pages"></summary>
				<ul role="list">
					<li><a href="/docs/layouts/stack/" aria-current="page">Stack</a></li>
					<li><a href="/docs/layouts/grid/">Grid</a></li>
				</ul>
			</details>
		</li>
		<li>
			<details>
				<summary>Reference</summary>
				<ul role="list">
					<li><a href="/docs/tokens/">Tokens</a></li>
				</ul>
			</details>
		</li>
	</ul>
</nav>
```

A parent that is not a page has no link. It is a plain `details` with the section's name in its `summary`, so the whole row is the toggle, as any disclosure on the page is.

The same shape nests. A list inside a `details` can hold another parent with its own `details`, and each level steps in by `--yeti-subnav-indent`. A title that wraps onto a second line keeps its toggle beside the first line.

The page the reader is on carries `aria-current="page"` and takes the current color in the strong weight. Each parent that holds it shows its own row in the same color at the normal weight, so the reader can see which section they are in. The color is `--yeti-subnav-current`, read with a fallback to the variant's text color, and `data-variant` picks the hue.

Open the way to the current page in the template: write `open` on each `details` above it. CSS cannot open a `details`, and the component adds no script to do it, so a page that leaves `open` off arrives with its own section shut.

A section grows open rather than appearing, with the same transition as every other `details` in Yeti. Under `prefers-reduced-motion` it simply appears.

To keep one section open at a time, give sibling `details` the same `name`. That is the browser's own exclusive disclosure, and it needs nothing from Yeti.

A link or a toggle under the pointer takes `--yeti-subnav-hover`, read with a fallback to the variant's subtle tint, so setting it to `transparent` turns the fill off without touching the variant.

```html
<nav class="subnav" aria-label="Settings" data-variant="secondary">
	<ul role="list">
		<li>
			<details name="settings" open>
				<summary>Account</summary>
				<ul role="list">
					<li><a href="/settings/profile/" aria-current="page">Profile</a></li>
					<li><a href="/settings/password/">Password</a></li>
				</ul>
			</details>
		</li>
		<li>
			<details name="settings">
				<summary>Billing</summary>
				<ul role="list">
					<li><a href="/settings/plan/">Plan</a></li>
				</ul>
			</details>
		</li>
	</ul>
</nav>
```

## Accessibility

Label the `nav`, with `aria-label="Docs"` or similar, because a page with a sidebar has at least two navs and they have to be told apart. Put `role="list"` on every `ul`, which keeps each one a list where the reset removes the markers.

A toggle beside a link has no text, so give its `summary` an `aria-label` that names the section's pages, such as "Layouts pages". The `summary` is the browser's own disclosure button: Tab reaches it, Enter or Space opens and closes its section, and its open state is announced. The pages of a closed section are skipped by Tab.

Never put the link inside the `summary`. A `summary` is a button, and a link inside a button is lost to screen readers.

The current page's `aria-current="page"` is what a screen reader announces; the color and the weight are the visible half of the same fact. Focus rings are drawn inside each row, so an opening section or a scrolling sidebar never cuts their edges.
