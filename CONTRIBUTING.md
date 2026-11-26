# Contributing to Yeti

Thanks for helping. Yeti is small on purpose, so most of this document is about what we do not add.

## Running things

```bash
npm ci                   # install the four dev dependencies
npx playwright install   # once, for the browser tests
npm run validate         # manifests, examples, spacing rule, layer contract
npm run test:tools       # node:test suite for the tooling
npm run test:browser     # Playwright in Chromium: the everyday browser run
npm run test:browser:all # Chromium, Firefox and WebKit: once per branch, before merge
npm run test:screenshots # screenshot comparisons, Chromium: before a release, or after base or token changes
npm run build            # writes dist/ (gitignored)
npm run docs             # regenerates docs/ from the manifests and src/guides/
npm test                 # validate, tools, browser (Chromium)
```

Node 24 or later. There is nothing to compile.

### Screenshots

Screenshot comparisons are opt-in. `npm run test:screenshots` compares every fixture, and the starter page, in light and dark against the baselines in `test/browser/screenshots/`, in Chromium. Run it before a release, and after a change to the base layer or the tokens, where a few pixels can move on every page without any assertion noticing. The everyday runs leave it out: the functional specs already assert geometry, contrast and behaviour, and a screenshot failure after a deliberate change is only a re-bless.

When a change to how something looks is deliberate, re-bless and say why in the commit message:

```bash
npm run screenshots:update
```

Baselines are captured on the machine that runs them and depend on its fonts; on another machine the first run fails and you re-bless locally before you start. CI does not compare screenshots. `bin/runtests.sh` runs everything, screenshots included.

### What to test where

A test should prove its point in the fewest seconds that can prove it. Twenty lines of JavaScript should not take three browsers and forty minutes.

1. **Logic gets a Node unit test.** Tooling, validators, generators, and the decisions inside a JavaScript module are tested with `node:test`. A module keeps its DOM wiring thin and puts any real decision in a small pure function, which the test loads with `node:vm` (no dependency, and the module stays a plain script with no `import` or `export`). If a module has no decision worth testing, it needs no unit test.
2. **CSS behaviour gets Playwright in Chromium.** Computed styles, geometry, contrast and axe run in one engine by default.
3. **All three engines only where engines differ.** Native form controls, focus and keyboard behaviour, scroll timelines and animation timing, popovers. A spec that needs all three says why in a comment at its top; `npm run test:browser:all` runs them, once per branch before merge, and CI runs them on every push.
4. **Assert where things end up, never how long they took.** "Every card ends visible", "it arrives once", "the column collapses at 390px". No `waitForTimeout` to catch a state mid-animation, no polling a play state. If a browser test does not settle in two attempts, stop and cover the logic with a unit test instead.
5. **Budgets.** While working, run only the spec you are changing, in Chromium. `--repeat-each` only to chase a named flake, three times at most. The full suite once, before merge.
6. **Before any script, state the need in one sentence and pick the simplest mechanism that meets it.** The play-once entrance needed "start the CSS animation when the element is near, never restart it", which is one attribute removed by an observer; a first attempt that paused and resumed running animations raced the browser for rounds.

## The rules that shape every change

**The frozen surface stays frozen.** `node bin/frozen.js develop` before merging a branch that touches a manifest, a vocabulary or the token catalogue: additions are fine, a break is a stop. The stability guide is the list it checks.

**No build step, ever.** Nothing a user needs can depend on Node, Sass, or a bundler. The source tree under `src/` must load in a browser as-is; the build concatenates it, writes a minified copy of the result beside it, and does nothing else to it.

**No new dependencies.** The dev dependencies are Playwright, axe, parse5, and lightningcss. lightningcss is the single exception to this rule and was taken deliberately: minifying CSS correctly means parsing it, that is not a job to hand-roll, and it runs only here — it produces `dist/yeti.min.css` and never touches the source a user loads. A pull request that adds another dependency needs an issue first explaining why the job cannot be done without it.

**Manifest first.** Every layout or component lands in one pull request with its `manifest.json`, its CSS, its `example.html`, a browser fixture, and the generated docs page. `npm run validate` must pass. If the manifest and the CSS disagree, the manifest is right and the CSS is wrong.

**Docs are generated.** Nothing under `docs/` is written by hand. A component page comes from its `manifest.json`, `example.html` and `docs.md`; a guide comes from `src/guides/<name>.md`, which is where its prose lives. Run `npm run docs` and commit what it writes — CI regenerates and fails on a diff. In a guide or a component's `docs.md`, a fenced block written ```` ```html demo ```` renders as the live demo figure as well as the code, and takes an optional height (`sm md lg xl`), a width (`2xs` … `2xl`) `both` to let the reader drag the box taller as well as wider, and `nocode` to show the frame without its View Code button: ```` ```html demo md lg both ````. A plain ```` ```html ```` block stays a code block.

**Spacing belongs to layouts.** A component never sets its own outer margin. Layouts own the gaps between their children. The validator enforces this on the identity selector.

**Naming.** Identity is a plain class (`.card`). Configuration is a `data-` attribute with a short shared vocabulary (`data-variant`, `data-size`, `data-gap`). State is native or ARIA (`[open]`, `[aria-current]`), never invented. Boolean attributes are bare. Anything not in the manifest is the user's and is ignored.

**Progressive enhancement, no polyfills.** Baseline 2025 is the floor. Newer features go behind `@supports` with a fallback that works.

**Accessibility is part of the contract.** Every component's manifest states its role, required attributes, and keyboard behaviour, and the fixture tests them.

## When a token earns its place

Tokens are the essential settings a designer reaches for to build a site: they guide, not just expose. Every public token is catalogue weight and, from beta, permanent API, so a new one has to pass at least one of three tests:

- **(A) A theme must set it and could not otherwise.** A component's skin is token-only, so a component value a theme should reach is a token. Bare-element typography is not a reason on its own: a theme styles bare elements with rules in its `yeti.theme` layer.
- **(B) The framework must coordinate it.** It is read by several components, or reset where it would otherwise break something.
- **(C) A designer would expect it as part of a standard set.** Link color, and the font controls (family, weight, width, tracking), are what anyone customizing a site looks for first; a set missing one of its members feels broken. A set stands or falls as a whole.

A value that passes none of them, a pass-through to one property on one element, is a literal declaration in the base, and a theme that wants it different writes an element rule.

## Branches

We use git-flow. Work happens on `feature/*` branches cut from `develop` and merged back by pull request. Releases go through `release/*` to `master` and are tagged `v7.x.y`. Foundation for Sites 6 maintenance happens on `v6`.

## Commit messages

Conventional commits, short and specific: `feat(tools): add the validator`, `fix(reset): keep dialog centering`, `docs: explain the token scale`.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
