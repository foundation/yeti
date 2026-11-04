#!/usr/bin/env node
// Release preparation. Stamps the version, builds dist/, regenerates docs/,
// and zips dist/. It never commits, tags, or publishes; those stay manual
// steps so a human reviews the diff first. A release merges back into
// develop, never master, which still holds Foundation 6, so git flow's own
// finish must not be used. Runs validate and both test suites first, so a
// red tree cannot be released.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './build.js';
import { generateDocs } from './gen-docs.js';
import { formatError } from './validate.js';

export const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function stampVersion(packageJsonText, version) {
	if (!VERSION_RE.test(version)) throw new Error(`invalid version "${version}"`);
	const pkg = JSON.parse(packageJsonText);
	pkg.version = version;
	return `${JSON.stringify(pkg, null, 2)}\n`;
}

export function checkGitState(root) {
	const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
	const problems = [];
	if (git('status', '--porcelain')) problems.push('working tree is not clean');
	const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
	if (!branch.startsWith('release/')) problems.push(`must run on a release/* branch (on ${branch})`);
	return problems;
}

// The checks a release runs before it stamps anything, in order, so a release
// cannot be cut from a red tree. There is no flag to skip them: the one
// mistake a script can prevent outright is this one.
export const CHECKS = [
	{ name: 'validate', command: ['npm', 'run', 'validate'] },
	{ name: 'test:tools', command: ['npm', 'run', 'test:tools'] },
	{ name: 'test:browser', command: ['npm', 'run', 'test:browser'] },
];

const defaultRunner = (command, cwd) => spawnSync(command[0], command.slice(1), { cwd, stdio: 'inherit' }).status ?? 1;

/** Runs each check with the runner; returns the first failing check's name, or null. */
export function runChecks(root, runner = defaultRunner) {
	for (const check of CHECKS) {
		if (runner(check.command, root) !== 0) return check.name;
	}
	return null;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const root = process.cwd();
	const version = process.argv[2];
	if (!version) {
		console.error('usage: node bin/release.js <version>');
		process.exit(2);
	}
	let problems;
	try {
		problems = checkGitState(root);
	} catch (e) {
		console.error(`release: ${e.message}`);
		process.exit(1);
	}
	for (const p of problems) console.error(`release: ${p}`);
	if (problems.length) process.exit(1);

	console.log('release: running the checks first');
	const failed = runChecks(root);
	if (failed) {
		console.error(`release: ${failed} failed; nothing stamped`);
		process.exit(1);
	}

	const pkgPath = path.join(root, 'package.json');
	fs.writeFileSync(pkgPath, stampVersion(fs.readFileSync(pkgPath, 'utf8'), version));

	const built = build({ root });
	for (const e of built.errors) console.error(formatError(root, e));
	if (built.errors.length) process.exit(1);

	const docs = generateDocs({ root });
	for (const e of docs.errors) console.error(formatError(root, e));
	if (docs.errors.length) process.exit(1);

	const zip = `yeti-${version}.zip`;
	fs.rmSync(path.join(root, zip), { force: true });
	try {
		execFileSync('zip', ['-qr', zip, 'dist'], { cwd: root });
	} catch (e) {
		console.error(`release: ${e.message}`);
		process.exit(1);
	}

	console.log(`release: ${version} stamped, dist/ built, ${docs.written.length} docs written, ${zip} created`);
	console.log('release: nothing committed. Review the diff, commit, publish, then merge into develop. Never merge into master or run git flow release finish: master is Foundation 6.');
}
