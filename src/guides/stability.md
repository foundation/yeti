---
raw: true
title: "What is stable"
description: "What 7.0.0-beta means: the names that will not change before 7.0.0, and the things that still may."
nav_group: "Guides"
nav_order: 11
---

# What is stable

<p class="lede">From `7.0.0-beta.0`, the surface a page depends on is frozen. This page is the list. Anything on it that changes between beta and `7.0.0` is a bug, and you should report it as one.</p>

## Frozen

- **Component class names.** `card` is `card`. The forty-nine names in the manifest.
- **Attribute names and their value lists.** `data-gap` takes the values it takes today; a value may be added, none will be removed or renamed.
- **Vocabularies.** The named value lists attributes draw from, `gap`, `width`, `height` and the rest; a value may be added, none removed.
- **Marker names and values.** `data-span` on a column, `data-numeric` on a cell, and the rest.
- **Public token names.** Every `--yeti-*` in the catalogue. Their default values may still be tuned; their names and meanings will not change.
- **Module file names.** `alert.js`, `tabs.js`, `dialog.js`, `hover.js`, `carousel.js`, `demo.js`, `range.js`, `validate.js`, `toc.js`, `enter.js`, and that each is optional.
- **Event names.** `yeti:close`, `yeti:open`, `yeti:select`, `yeti:slide`, `yeti:invalid`, `yeti:current`, what each is dispatched on, and the keys in its `detail`. An event may be added; none will be renamed or lose a key.
- **The manifest and token catalogue schemas**, and the package `exports` map, so tooling built on `@foundation/yeti/manifest` and `@foundation/yeti/tokens` keeps working.

## Not frozen

- Private tokens, the `--_yeti-*` ones. They are implementation.
- The default value of a public token. A theme may already change these; so may we, before `7.0.0`, where a measurement says a default is wrong.
- The internal layout of generated files: the exact text of the docs pages, `llms.txt`, the editor data, the types file. Their content follows the manifest.
- Test fixtures, baselines, and everything under `bin/`.
- Browser support minimums, which track Baseline.

## What a breaking change would look like

Renaming a class, removing an attribute value, changing what a value does, renaming a public token, or making a module required. None of these happens before `7.0.0`. After `7.0.0`, any of them is a major version.

## Checking it

The list above is checked by a script, not by reading. `node bin/frozen.js <ref>` reads every frozen name at a git ref and at the current tree and prints each addition and each break; it exits non-zero on a break, so it can gate a release the way the validator does. Before a release it runs against the previous tag; before merging anything that touches a manifest, against `develop`.

## Screenshots

The screenshot baselines are part of how this is kept. A change to how something looks is re-blessed in the same commit that causes it, with the reason in the message. A re-bless with no visible reason is a review question.
