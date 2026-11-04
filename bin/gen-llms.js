#!/usr/bin/env node
// The API as plain text for a language model. Two files: llms.txt lists
// every component with its attributes, values and defaults; llms-full.txt
// adds each docs fragment, accessibility notes, children and the token
// catalogue and the guides an agent needs. Component strings come from the
// manifest or a docs fragment, so they cannot say something the validator
// does not enforce. The rules in the preamble are written by hand, because
// they are the mistakes agents make, and each was checked in a browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema, loadAndMerge, loadVocabulary } from './lib/manifest.js';
import { readPackage, cdnUrl } from './build.js';

// The guides an agent needs and the component pages do not say: how color and
// theming work across components, and what an entrance is for.
const GUIDES = [['color', 'Color'], ['theming', 'Theming'], ['animations', 'Animations']];

const KIND_ORDER = { layout: 0, recipe: 1, component: 2, utility: 3 };
const ordered = (merged) => Object.values(merged).sort((a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || a.name.localeCompare(b.name));

function attributeLine(a) {
	if (a.type === 'enum') {
		const values = a.values.map((v) => (v === a.default ? `${v} (default)` : v)).join(' | ');
		return `- ${a.name}: ${values} — ${a.description}`;
	}
	return `- ${a.name} (${a.type}) — ${a.description}`;
}

function markerLine(m) {
	const on = m.on ?? '> *';
	if (m.type === 'enum') return `- ${m.name} on ${on}: ${m.values.join(' | ')} — ${m.description}`;
	return `- ${m.name} on ${on} (${m.type}) — ${m.description}`;
}

function preamble(pkg) {
	return [
		`# Yeti ${pkg.version}`,
		'',
		`Yeti is a plain-CSS framework. Three rules cover every component: identity is a class (\`class="card"\`), configuration is a \`data-*\` attribute with a fixed value list (\`data-gap="md"\`), and state is native or ARIA (\`open\`, \`aria-current\`), never a class. Layouts arrange, recipes compose layouts, components are styled things. Every attribute below is validated: a value not in its list is an error. Rendered pages are checked with the same manifest by bin/validate-html.js in the Yeti repository (node bin/validate-html.js <dir> --manifest <path to yeti.manifest.json>); run it over built HTML before looking for a layout fault by hand. Docs: ${pkg.homepage}. Each component's guidance, every token's default and the color, theming and animation guides are in ${cdnUrl(pkg, 'llms-full.txt')}; it is large, so search it rather than reading it whole.`,
		'',
		'To begin a page, start from dist/starter/index.html, a complete and valid page (skip link, sticky nav, hero, card grid, prose, footer), and dist/starter/theme.css, the essential theme settings with their defaults, commented out. Copy both and delete what the page does not need.',
		'',
		'## Before you write CSS',
		'',
		'Most of what a page needs is an attribute or a token. Look here before writing a rule.',
		'',
		'- Tokens: set only the public `--yeti-*` tokens. Never set or read `--_yeti-*`: they are private and change without notice.',
		'- Where a rule goes: unlayered CSS beats everything in Yeti, so a stylesheet of your own needs no specificity tricks. `@layer yeti.theme` sits below the components, so use it for bare elements only. A rule on a component is unlayered, or goes in `@layer yeti.components`, loaded after Yeti, when `data-*` attributes such as `data-paint` must still win. Unlayered CSS beats those too.',
		'- Modules: every component works with no script, and a module adds to it. Load one with `<script type="module" src=".../js/enter.js"></script>`, or all of them with `yeti.js`. Each block below names its module.',
		'- Light and dark: nothing to switch on. The root declares `color-scheme: light dark`, so a page follows the reader with no meta tag, class or attribute. Pin it with `html { color-scheme: dark; }`.',
		'- A region that is always dark: `<section class="box band" data-surface="base">` with `.band { color-scheme: dark; }`. A surface sets its fill and its text. Any other element needs all three: `.band { color-scheme: dark; background-color: var(--yeti-color-surface); color: var(--yeti-color-text); }`, because the scheme alone flips links and buttons, but the text color is inherited already resolved. Use `light` the same way.',
		'- The site\'s colors: set the hues on `:root`, such as `--yeti-hue-primary: 55`. Hues only take effect there. A variant is one hue site-wide, so do not repurpose `secondary` for one element.',
		'- One element in another color: set the derived tokens on it, each a `light-dark()` pair: `.hero .button { --yeti-color-primary: light-dark(oklch(50% .13 55), oklch(75% .13 55)); --yeti-color-primary-strong: light-dark(oklch(42% .13 55), oklch(82% .13 55)); --yeti-on-primary: light-dark(#fff, #000); }`. Set these on any element and everything below it follows.',
		'- Links: `--yeti-link-color` and `--yeti-link-color-hover`, on `:root` for the site or on any element for everything below it. Do not remap primary for them. On `:root` use a token such as `var(--yeti-color-primary-text)`, because a plain color does not change in dark mode or a dark region. A token set on `:root` resolves there, so a region that re-points that token must set the link color too.',
		'- A nav bar: links read `--yeti-nav-link`. A bar with one dark color in both modes is `.nav { color-scheme: dark; --yeti-nav-surface: <color>; }`, which also gives dark-scheme hover and current tints, the toggle and the open panel. The open panel has its own pair: set `--yeti-nav-panel` and `--yeti-nav-panel-text` together, because `--yeti-nav-link` does not reach it.',
		'- Entrances: `class="enter" data-enter="rise"` with `data-stagger` on the row. To animate in as it scrolls into view, use `data-once`, which plays one time as it comes near and needs enter.js. `data-view` is the other choice, a scroll-linked effect that plays backwards on the way up.',
		'- Case and tracking on a button: no token; write `.button { text-transform: uppercase; letter-spacing: .08em; }`, unlayered.',
		'',
	];
}

function childLines(c) {
	if (!c.children.length) return [];
	return ['', 'Children:', ...c.children.map((ch) => `- ${ch.selector}: at least ${ch.min}${ch.max === null ? '' : `, at most ${ch.max}`}. ${ch.description}`)];
}

function block(c) {
	const lines = [`## ${c.name} (${c.kind}, class="${c.class}")`, '', c.description];
	if (c.attributes.length) { lines.push('', 'Attributes:'); for (const a of c.attributes) lines.push(attributeLine(a)); }
	if (c.markers?.length) { lines.push('', 'On children:'); for (const m of c.markers) lines.push(markerLine(m)); }
	for (const mod of c.js ?? []) {
		lines.push('', `module: ${mod.module}${mod.optional ? ' (optional)' : ''}`);
		for (const e of mod.events ?? []) lines.push(`- event ${e.name}${e.detail ? ` with detail ${e.detail}` : ''} — ${e.description}`);
	}
	return lines;
}

const stripFrontMatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '').trim();

export function renderCompact(merged, pkg, tokens = [], guides = []) {
	const lines = preamble(pkg);
	if (guides.length) {
		lines.push('## Guides', '', 'The reasoning behind the rules above. llms-full.txt carries these in full.', '');
		for (const g of guides) lines.push(`- ${g.title}: ${new URL(`guides/${g.name}/`, pkg.homepage)}`);
		lines.push('');
	}
	for (const c of ordered(merged)) lines.push(...block(c), ...childLines(c), '');
	if (tokens.length) lines.push('## Tokens', '', 'Every public custom property. llms-full.txt gives each one\'s default and meaning.', '', tokens.map((t) => t.name).join(' '));
	return `${lines.join('\n').trimEnd()}\n`;
}

export function renderFull(merged, tokens, docsByName, pkg, guides = []) {
	const lines = preamble(pkg);
	for (const c of ordered(merged)) {
		lines.push(...block(c));
		const docs = (docsByName[c.name] ?? '').trim();
		if (docs) lines.push('', docs.replace(/^## /gm, '### '));
		lines.push(...childLines(c));
		if (c.tokens.some((t) => t.public)) { lines.push('', 'Tokens:'); for (const t of c.tokens.filter((t) => t.public)) lines.push(`- ${t.name} — ${t.description}`); }
		const a = c.a11y;
		if (a.requiredAttributes.length || a.keyboard.length || a.notes) {
			// "contract", because a fragment may carry its own ### Accessibility prose
			// just above this: that is the reasoning, this is what the validator enforces.
			lines.push('', 'Accessibility contract:');
			if (a.requiredAttributes.length) lines.push(`Required: ${a.requiredAttributes.join(', ')}`);
			for (const k of a.keyboard) lines.push(`- ${k.key}: ${k.action}`);
			if (a.notes) lines.push(a.notes);
		}
		lines.push('');
	}
	lines.push('## Tokens', '', 'Every public custom property, with its group and default. A theme is a file that sets some of these after yeti.css.', '');
	for (const t of tokens) lines.push(`- ${t.name} (${t.group}): ${t.default} — ${t.description}`);
	for (const g of guides) lines.push('', `## Guide: ${g.title}`, '', stripFrontMatter(g.body).replace(/^# .*\n+/, '').replace(/^(#+) /gm, '#$1 '));
	return `${lines.join('\n').trimEnd()}\n`;
}

export function writeLlms({ root, merged, entries, pkg }) {
	const distDir = path.join(root, 'dist');
	const docsDir = path.join(root, 'docs');
	fs.mkdirSync(distDir, { recursive: true });
	fs.mkdirSync(docsDir, { recursive: true });
	const docsByName = {};
	for (const e of entries) {
		const f = path.join(e.dir, 'docs.md');
		docsByName[e.name] = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
	}
	const catalogueFile = path.join(root, 'src', 'tokens', 'tokens.json');
	const tokens = fs.existsSync(catalogueFile) ? JSON.parse(fs.readFileSync(catalogueFile, 'utf8')) : [];
	const guideFile = (name) => path.join(root, 'src', 'guides', `${name}.md`);
	const guides = GUIDES.filter(([name]) => fs.existsSync(guideFile(name))).map(([name, title]) => ({ name, title, body: fs.readFileSync(guideFile(name), 'utf8') }));
	const files = { 'llms.txt': renderCompact(merged, pkg, tokens, guides), 'llms-full.txt': renderFull(merged, tokens, docsByName, pkg, guides) };
	for (const [name, content] of Object.entries(files)) {
		fs.writeFileSync(path.join(distDir, name), content);
		fs.writeFileSync(path.join(docsDir, name), content);
	}
	return Object.keys(files);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const root = process.cwd();
	const schema = loadSchema(path.join(root, 'schema', 'manifest.schema.json'));
	const vocabulary = loadVocabulary(path.join(root, 'schema', 'vocabulary.json'));
	const { merged, entries, errors } = loadAndMerge(path.join(root, 'src'), schema, vocabulary);
	if (errors.length) { for (const e of errors) console.error(`${e.file}: ${e.message}`); process.exit(1); }
	console.log(`gen-llms: wrote ${writeLlms({ root, merged, entries, pkg: readPackage(root) }).join(', ')}`);
}
