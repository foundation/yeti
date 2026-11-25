// Button actions: a button carrying data-action does one thing the browser
// keeps for script. "copy" puts the text of the element data-target names on
// the clipboard. "share" opens the browser's share sheet for the page, or for
// the link data-target names, and where the browser has no share sheet it
// copies the link instead. Without this module such a button does nothing.
// Delegated on click, so buttons added after load work too, and safe on a
// page with none.
//
// The label the button shows once something is on the clipboard is the
// author's own data-done, so the words are theirs and in their language, and
// the button's aria-live is what has a screen reader say them.

// How long the data-done label shows. Long enough to read, short enough
// that the button is back before the next copy is likely.
const SHOWN_FOR = 2000;
// What each button held before its label was swapped, its own inline
// min-inline-size, and the timer that puts both back. Present only while the
// label shows, which is how a second click knows not to save the label.
const swapped = new WeakMap();

// A form field's text is its value, which follows what was typed; anything
// else's is its text. Trailing line breaks go because a pasted shell command
// that ends in one runs before the reader has looked at it. Nothing else is
// trimmed: leading spaces in a snippet are its indentation.
const textOf = (el) => (el.matches('input, textarea, select') ? el.value : el.textContent).replace(/[\r\n]+$/, '');

// The button's size along the line, which is its width unless the writing
// mode turns it.
const inlineSize = (el) => {
	const box = el.getBoundingClientRect();
	return getComputedStyle(el).writingMode.startsWith('horizontal') ? box.width : box.height;
};

const restore = (button) => {
	const saved = swapped.get(button);
	if (!saved) return;
	swapped.delete(button);
	button.replaceChildren(...saved.nodes);
	button.style.minInlineSize = saved.minInlineSize;
	// A button that had no inline style before the swap is left with none,
	// rather than an empty style attribute the author never wrote.
	if (!button.getAttribute('style')) button.removeAttribute('style');
};

const showLabel = (button, label) => {
	let saved = swapped.get(button);
	if (saved) {
		clearTimeout(saved.timer);
	} else {
		// The very nodes, not their markup, so an icon or a listener on a child
		// is still there when they come back. min-inline-size is the one inline
		// style the module writes: a label shorter than the original would make
		// the button narrower and shift whatever sits beside it on the line.
		// The reset makes every box border-box, so the measured size is the
		// right minimum.
		saved = { nodes: [...button.childNodes], minInlineSize: button.style.minInlineSize };
		button.style.minInlineSize = `${inlineSize(button)}px`;
		swapped.set(button, saved);
	}
	button.replaceChildren(label);
	saved.timer = setTimeout(() => restore(button), SHOWN_FOR);
};

const emit = (button, name) => button.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));

// The clipboard exists only in a secure context, and a browser may refuse
// the write. Either way the button is left exactly as it was: a label
// that says Copied over a failed copy would be worse than saying nothing.
const write = (button, text) => {
	navigator.clipboard?.writeText?.(text)?.then(() => {
		emit(button, 'yeti:copy');
		const label = button.dataset.done;
		if (label?.trim()) showLabel(button, label);
	}, () => {});
};

// What a share button shares: the link data-target names, by its address
// and its text, or with no data-target the page, by the canonical address
// its head declares when it declares one. A data-target that names nothing,
// or something with no address, shares nothing rather than the page: the
// author asked for one link, and another would be a wrong answer.
const shareData = (button) => {
	const doc = button.ownerDocument;
	if (!button.hasAttribute('data-target')) {
		return { title: doc.title, url: doc.querySelector('link[rel~="canonical"][href]')?.href || doc.location.href };
	}
	const link = doc.getElementById(button.dataset.target);
	return link?.href ? { title: link.textContent.trim() || doc.title, url: link.href } : null;
};

const actions = {
	copy(button) {
		const source = button.ownerDocument.getElementById(button.dataset.target);
		if (source) write(button, textOf(source));
	},
	share(button) {
		const data = shareData(button);
		if (!data) return;
		// No share sheet in this browser: the link on the clipboard is the
		// next best thing, and data-done is how the visitor learns it is there.
		if (typeof navigator.share !== 'function') return write(button, data.url);
		// A sheet the visitor dismisses rejects, and so does one the browser
		// refuses to open. Neither is a share, so neither says anything.
		navigator.share(data).then(() => emit(button, 'yeti:share'), () => {});
	},
};

document.addEventListener('click', (event) => {
	const button = event.target?.closest?.('button[data-action]');
	// A disabled button never gets the click. One marked aria-disabled does,
	// and the button's own docs promise that it ignores presses.
	if (!button || button.getAttribute('aria-disabled') === 'true') return;
	// Own names only: data-action="constructor" must not find a function. An
	// action this module does not know belongs to someone else's script.
	const name = button.dataset.action;
	if (Object.hasOwn(actions, name)) actions[name](button);
});
