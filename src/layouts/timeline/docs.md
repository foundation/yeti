## When to use it

A history, a changelog, the steps of a process, a schedule: entries in order along a line. It is an ordered list with a rail, so it reads as a list and looks like a timeline.

## How it works

The list is a column of entries at the gap, with a rail down its start edge and a marker on the rail beside each entry. Add `data-alternate` and, once the list's content box is at least `lg` wide, the rail moves to the centre and the entries take turns on either side of it, markers still on the rail; narrower, they fall back to one side. The switch is the list's own width, so a timeline in a sidebar stays single-sided while the same one across a page alternates.

```html demo sm
<ol class="timeline" data-gap="md" role="list">
	<li><time datetime="2026-01-01">January</time><p>Started.</p></li>
	<li><time datetime="2026-06-01">June</time><p>Shipped.</p></li>
</ol>
```

## Why this name

It is a line of time. Foundation 6 had nothing for it; people reached for a snippet and a breakpoint.
