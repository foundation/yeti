// Nav, collapsible groups. Behind the toggle, every level of a submenu is
// already shown in place with no script, which is enough for a short tree.
// This module is for a long one: it gives each group in the open panel a
// toggle that folds it away, and starts the panel on the branch that holds the
// current page. Without it the panel still works; it is only fully open.
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
// covers an opening that something else cancelled.
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
	const button = event.target.closest?.('button[aria-expanded][popovertarget]');
	if (!button?.closest(`${panels}:popover-open`)) return;
	// The panel is open, so this button folds its group rather than opening one.
	event.preventDefault();
	const next = button.getAttribute('aria-expanded') !== 'true';
	button.setAttribute('aria-expanded', String(next));
	remembered.set(button, next);
});
