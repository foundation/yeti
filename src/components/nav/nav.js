// Nav, collapsible groups. Behind the toggle, every level of a submenu is
// already shown in place with no script, which is enough for a short tree.
// This module is for a long one: it gives each group in the open panel a
// toggle that folds it away, and starts the panel on the branch that holds the
// current page. Without it the panel still works; it is only fully open. Its
// second job, the More menu for links that do not fit the bar, is further down.
//
// The module's one visible mark is aria-expanded on a group's button. The
// stylesheet reads it to show the toggle and to fold the group, and assistive
// technology reads it to announce the state, so there is no class and no
// second attribute to keep in step. The attribute exists only while the panel
// is open. In the bar the same button opens its popover, whose state the
// browser reports itself, and an author's own aria-expanded would fight it.
//
// A click on the button is stopped before it reaches the popover, so a group
// that folds is never also opened as a card. The button keeps its popovertarget
// for the bar.
const panels = '.nav > ul[popover]';
const buttons = '.dropdown > button[popovertarget]';
// What the reader chose, per button, until the page is left. Closing the panel
// takes the attribute off; opening it again puts the choice back.
const remembered = new WeakMap();

// The one decision. A choice the reader made wins; otherwise a group starts
// open only when it holds the page they are on.
function startsOpen(choice, holdsCurrent) {
	return typeof choice === 'boolean' ? choice : holdsCurrent;
}

// Neither event bubbles, so this listens in the capture phase, and they fire
// for every popover on the page, so only a nav's own list is acted on.
// beforetoggle runs in the same task as the change, so the attribute is there
// before the panel's first frame (a group that was folded on open would
// otherwise be seen folding) and gone as soon as the panel closes. toggle
// follows a task later and repeats the same work, which costs nothing and
// leaves the final state right if a script changed the attribute in between.
const sync = (event) => {
	const panel = event.target;
	if (!panel.matches?.(panels)) return;
	for (const button of panel.querySelectorAll(buttons)) {
		if (event.newState === 'open') {
			const holdsCurrent = !!button.closest('.dropdown').querySelector('[aria-current="page"]');
			button.setAttribute('aria-expanded', String(startsOpen(remembered.get(button), holdsCurrent)));
		} else {
			button.removeAttribute('aria-expanded');
		}
	}
};
document.addEventListener('beforetoggle', sync, true);
document.addEventListener('toggle', sync, true);

document.addEventListener('click', (event) => {
	const button = event.target.closest?.('.dropdown > button[aria-expanded][popovertarget]');
	if (!button?.closest(`${panels}:popover-open`)) return;
	// The panel is open, so this button folds its group rather than opening one.
	event.preventDefault();
	const next = button.getAttribute('aria-expanded') !== 'true';
	button.setAttribute('aria-expanded', String(next));
	remembered.set(button, next);
});

// More. While the links are in the bar, as many as fit on one line stay
// there, in their order, and the rest move from the end into the panel of the
// author's own More item, which is shown only while it holds something. Below
// the threshold every link goes back to the list, so the open panel is the one
// it always was. A bottom bar keeps four links and More once it has more than
// five, because it shares its row by count, not by width.
//
// The only state written is hidden on the More item. A link is moved, never
// copied, so its id, its listeners and a group's remembered choice go with it.
// An item in the bar is always read at its natural width; one in More is read
// as it was when it was last in the bar.
const widths = new WeakMap();
const moved = new WeakSet();
// Room for a rounding error in a sum of fractional widths, far below a pixel.
const slack = 0.01;
const bottomBarSlots = 5;

// How many items stay in the bar: all of them when they fit, otherwise the most
// that fit with the More button after them. More takes room of its own, so a
// count that fits only without it is never chosen while More shows, and the
// bar cannot swing between the two.
function inBar(sizes, gap, more, room) {
	const all = sizes.reduce((sum, size) => sum + size, 0) + gap * Math.max(sizes.length - 1, 0);
	if (all <= room + slack) return sizes.length;
	let used = 0;
	let count = 0;
	for (const size of sizes) {
		if (used + size + gap + more > room + slack) break;
		used += size + gap;
		count += 1;
	}
	return count;
}

// How many items stay in a bottom bar: all of them up to its slots, otherwise
// one fewer, so that More takes the last slot.
function inBottomBar(count, slots = bottomBarSlots) {
	return count <= slots ? count : slots - 1;
}

// The bar is measured with the list out of the flow and as wide as its
// content, so no item is squeezed and the brand and the actions have their
// own widths, and with More shown, so its button's width is known. Everything
// is put back before the browser draws.
function measure(nav, list, more, bar) {
	const style = list.getAttribute('style');
	const hidden = more.hidden;
	list.style.setProperty('position', 'absolute');
	list.style.setProperty('inline-size', 'max-content');
	more.hidden = false;
	for (const item of bar) widths.set(item, item.getBoundingClientRect().width);
	const navStyle = getComputedStyle(nav);
	const navGap = parseFloat(navStyle.columnGap) || 0;
	let room = nav.getBoundingClientRect().width;
	for (const side of ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']) room -= parseFloat(navStyle[side]) || 0;
	for (const part of nav.children) {
		if (part === list || !part.getClientRects().length || /^(absolute|fixed)$/.test(getComputedStyle(part).position)) continue;
		room -= part.getBoundingClientRect().width + navGap;
	}
	const sizes = { gap: parseFloat(getComputedStyle(list).columnGap) || 0, more: more.getBoundingClientRect().width, room };
	if (style === null) list.removeAttribute('style');
	else list.setAttribute('style', style);
	more.hidden = hidden;
	return sizes;
}

// The one decision, from every trigger. It reports whether anything changed,
// and whether any item came back to the bar: one that did was trusted at the
// width it had when it left, so the caller decides once more with it measured
// where it now is.
function arrange(nav, list, more, panel) {
	const bar = [...list.children].filter((item) => item !== more && !item.matches('[data-close]'));
	const out = [...panel.children].filter((item) => moved.has(item));
	const items = [...bar, ...out];
	let keep = items.length;
	if (getComputedStyle(list).position === 'static') {
		const { gap, more: button, room } = measure(nav, list, more, bar);
		keep = inBar(items.map((item) => widths.get(item) ?? 0), gap, button, room);
	} else if (nav.matches('[data-panel="bar"]')) {
		keep = inBottomBar(items.length);
	}
	const leaving = bar.slice(keep);
	const returning = out.slice(0, Math.max(keep - bar.length, 0));
	const empty = keep === items.length;
	if (!leaving.length && !returning.length && more.hidden === empty) return { changed: false, back: false };
	const active = document.activeElement;
	const holder = [...leaving, ...returning].find((item) => item.contains(active));
	if (empty && panel.matches(':popover-open')) panel.hidePopover();
	if (leaving.length) panel.prepend(...leaving);
	if (returning.length) {
		if (bar.length) bar.at(-1).after(...returning);
		else more.before(...returning);
	}
	for (const item of leaving) moved.add(item);
	for (const item of returning) moved.delete(item);
	more.hidden = empty;
	// A moved node loses focus, and so does a button that is hidden. Focus goes
	// back where it was if that can still hold it; a link in More's closed
	// panel cannot, so it goes to the More button; and if More itself has gone,
	// to the last link in the bar. It never falls to the page.
	if (active && active !== document.body && document.activeElement !== active) {
		const last = [...list.children].filter((item) => item !== more && !item.matches('[data-close]')).at(-1);
		const choices = [active, holder?.querySelector('a[href], button'), more.hidden ? null : more.querySelector(':scope > button'), last?.querySelector('a[href], button')];
		for (const choice of choices) {
			choice?.focus({ preventScroll: true });
			if (document.activeElement === choice) break;
		}
	}
	return { changed: true, back: returning.length > 0 };
}

// Returns whether anything moved.
function update(nav) {
	const list = nav.querySelector(':scope > ul[popover]');
	const more = list?.querySelector(':scope > li[data-more]');
	const panel = more?.querySelector(':scope > [popover]');
	// While the nav's own panel is open nothing moves; its closing decides again.
	if (!panel || !nav.getClientRects().length || list.matches(':popover-open')) return false;
	let changed = false;
	for (let pass = 0; pass <= list.children.length + panel.children.length; pass += 1) {
		const result = arrange(nav, list, more, panel);
		changed ||= result.changed;
		if (!result.back) break;
	}
	return changed;
}

// Without ResizeObserver nothing moves and More stays hidden, which is the nav
// as it is without this module.
if (typeof ResizeObserver === 'function') {
	// A bar that was too narrow has already squeezed its links, and perhaps
	// wrapped them, when this runs, so moving them can change the nav's height
	// in the same frame. The browser reports a change to an element it has
	// just reported on as an error, so a nav whose links moved is left out of
	// view until the next frame, which then reports its size afresh.
	const observer = new ResizeObserver((entries) => {
		for (const { target } of entries) {
			if (!update(target)) continue;
			observer.unobserve(target);
			requestAnimationFrame(() => observer.observe(target));
		}
	});
	for (const nav of document.querySelectorAll('.nav')) observer.observe(nav);
	// A web font that arrives late changes every width.
	document.fonts?.ready.then(() => {
		for (const nav of document.querySelectorAll('.nav')) update(nav);
	});
	document.addEventListener('toggle', (event) => {
		if (event.newState === 'closed' && event.target.matches?.(panels)) update(event.target.parentElement);
	}, true);
}
