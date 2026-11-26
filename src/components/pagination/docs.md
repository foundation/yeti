## When to use it

Under a list that is split into pages: search results, an archive, a table too long for one screen. It is for pages a reader may want to jump between; a feed that only ever goes forward needs one Next link, not this.

## How it works

A row of links, each at least a control's width and height so it is easy to hit, the current page filled with the hue. An ellipsis in a `span` stands for skipped pages. Below `data-threshold`, the pagination's own width, everything but Previous, the current page, and Next is hidden, so the same markup is a full row in a wide column and three targets in a narrow one, with no breakpoint. `data-justify` places the row.

```html demo sm sm
<nav class="pagination" aria-label="Pagination" data-justify="center" data-threshold="md">
	<ol role="list">
		<li><a href="#" rel="prev">Previous</a></li>
		<li><a href="#" aria-current="page">1</a></li>
		<li><a href="#">2</a></li>
		<li><a href="#" rel="next">Next</a></li>
	</ol>
</nav>
```

## Accessibility

Label the `nav` `aria-label="Pagination"`. The current page's link carries `aria-current="page"`, which is also what the fill follows. Previous and Next carry `rel="prev"` and `rel="next"` with visible text, or an `aria-label` if they are icons; they are what remains when the row is narrow, so they must make sense alone. The ellipsis is a `span`, not a link. `role="list"` on the `ol` keeps it a list where the reset removes the markers.
