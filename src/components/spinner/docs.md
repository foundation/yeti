## When to use it

A wait with no known end: a page section still fetching, a search running. When the length is known, use `progress`. When the wait belongs to a button, set `aria-busy="true"` on the button and the ring appears there by itself.

## How it works

A one-em ring: a border in the hue's subtle step with the top edge in the hue, turning once per `--yeti-spinner-duration`. `data-size` sets the em through the text step, so a spinner sits in a line of text at that text's size. A button with `aria-busy="true"` draws the same ring after its label from its own text color, so it reads on a filled button and an outlined one alike.

```html demo sm
<button class="button" aria-busy="true" aria-disabled="true">Saving</button>
```

## Accessibility

Standing alone, give the spinner `role="status"` and an `aria-label` such as "Loading", so the wait is announced once and not again. Inside a busy button it needs nothing more: `aria-busy` on the button says it. Under reduced motion every animation duration collapses, so the ring stands still; a still ring with one bright edge still reads as "waiting".
