// Dropdown, opening on hover. Nothing but script can open a popover, so a menu
// that wants to open under the pointer needs this. It is opt in per instance
// through data-trigger="hover"; every other dropdown keeps its click, and the
// click path here is untouched in either case. Delegated on pointerover and
// pointerout, which bubble where pointerenter and pointerleave do not, so
// dropdowns added after load work too.
//
// The module keys off the attribute rather than off .dropdown, so any later
// component built on a popover gets this for free by declaring data-trigger.
//
// It is also a stopgap with a stated end. The interestfor attribute is exactly
// this feature, standardised, and it is in one engine today. When it reaches
// Baseline this file is deleted and data-trigger="hover" maps to it instead.
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const timers = new WeakMap();
// Only a panel this module opened is a panel this module may close. Otherwise a
// stray sweep of the pointer shuts a menu someone opened with Enter, while
// their focus is still sitting on the trigger.
const opened = new WeakSet();
// Panels that already carry the listener below, so it is attached once each.
const wired = new WeakSet();

const partsOf = (wrapper) => {
	// The declared relationship is the source of truth, as tabs.js does with
	// aria-controls: find the panel the trigger names, never just any popover.
	const trigger = wrapper.querySelector(':scope > [popovertarget]');
	const panel = trigger && document.getElementById(trigger.getAttribute('popovertarget'));
	return panel?.showPopover ? { trigger, panel } : null;
};

// A theme tunes the feel without touching script, the way alert.js reads its
// duration. An absent token means no wait, which is the sane default.
const delay = (el, name) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;

const schedule = (wrapper, ms, run) => {
	clearTimeout(timers.get(wrapper));
	timers.set(wrapper, setTimeout(run, ms));
};

// A wrapper is any element that owns a trigger for a panel, inside an element
// that opted in. data-trigger="hover" is written once, on the outermost
// dropdown, and every level nested inside it follows.
const isWrapper = (el) => !!el.querySelector(':scope > [popovertarget]') && !!el.closest('[data-trigger="hover"]');

// Every wrapper that holds the node, innermost first. The panel is a DOM child
// of its wrapper even while it paints in the top layer, so the pointer on a
// submenu's leaf is inside the submenu's wrapper and each wrapper above it.
const wrappersOf = (node) => {
	const found = [];
	for (let el = node?.closest?.('*'); el; el = el.parentElement) {
		if (isWrapper(el)) found.push(el);
	}
	return found;
};

// A closed panel that is already rendered is a group shown in flow, such as a
// section of a nav panel. Opening it would lift it into the top layer.
const shownInFlow = (panel) => !panel.matches(':popover-open') && getComputedStyle(panel).display !== 'none';

document.addEventListener('pointerover', (event) => {
	// Read at event time, not at load: a tablet that gains a mouse is handled.
	if (!fine.matches) return;
	// Only the innermost wrapper opens. The ones above it are already open,
	// because the pointer had to cross them to get here.
	const wrapper = wrappersOf(event.target)[0];
	const parts = wrapper && partsOf(wrapper);
	if (!parts) return;
	schedule(wrapper, delay(wrapper, '--yeti-dropdown-open-delay'), () => {
		// showPopover throws when the popover is already open.
		if (parts.panel.matches(':popover-open') || shownInFlow(parts.panel)) return;
		parts.panel.showPopover();
		opened.add(parts.panel);
		// However it closes next, from here, Escape, or a click outside, it
		// stops being ours, so a later click-open is not ours to undo. The
		// listener is persistent, not once: showPopover queues its own open
		// toggle, which fires after this line runs and would consume a
		// once-listener before the close it was waiting for ever arrived.
		if (!wired.has(parts.panel)) {
			wired.add(parts.panel);
			parts.panel.addEventListener('toggle', (change) => {
				if (change.newState === 'closed') opened.delete(parts.panel);
			});
		}
	});
});

// A press cancels any open this module has scheduled but not yet performed.
// Leaving an open panel and coming straight back schedules another open while
// the panel is still up; without this the press that follows closes the panel
// and the stale timer springs it open again a moment later.
document.addEventListener('pointerdown', (event) => {
	const wrapper = event.target?.closest?.('[data-trigger="hover"]');
	if (wrapper) clearTimeout(timers.get(wrapper));
}, { capture: true });

document.addEventListener('pointerout', (event) => {
	if (!fine.matches) return;
	// A move that stays inside a wrapper is not a crossing for it. Leaving the
	// page from a leaf crosses every level, so every level schedules its close;
	// moving between two rows of one panel crosses only the row's own level.
	for (const wrapper of wrappersOf(event.target)) {
		if (wrapper.contains(event.relatedTarget)) continue;
		const parts = partsOf(wrapper);
		if (!parts) continue;
		schedule(wrapper, delay(wrapper, '--yeti-dropdown-close-delay'), () => {
			// hidePopover throws when the popover is already closed.
			if (!opened.has(parts.panel) || !parts.panel.matches(':popover-open')) return;
			parts.panel.hidePopover();
		});
	}
});
