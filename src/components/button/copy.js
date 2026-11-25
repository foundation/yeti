// Copy button: a button carrying data-copy="<id>" puts that element's text on
// the clipboard. Only script can write to the clipboard, so this is the whole
// feature, and without it the button does nothing. Delegated on click, so
// buttons added after load work too, and safe on a page with none.
//
// The label the button shows after a copy is the author's own data-copied,
// so the words are theirs and in their language, and the button's
// aria-live is what has a screen reader say them.

// How long the data-copied label shows. Long enough to read, short enough
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

document.addEventListener('click', (event) => {
	const button = event.target?.closest?.('button[data-copy]');
	if (!button) return;
	const source = button.ownerDocument.getElementById(button.dataset.copy);
	if (!source) return;
	// The clipboard exists only in a secure context, and a browser may refuse
	// the write. Either way the button is left exactly as it was: a label
	// that says Copied over a failed copy would be worse than saying nothing.
	navigator.clipboard?.writeText?.(textOf(source))?.then(() => {
		button.dispatchEvent(new CustomEvent('yeti:copy', { bubbles: true, composed: true }));
		const label = button.dataset.copied;
		if (label?.trim()) showLabel(button, label);
	}, () => {});
});
