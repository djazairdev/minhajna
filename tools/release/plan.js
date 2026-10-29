// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether a commit is a release (answer 535): its app's versionName has no
// `v<version>` tag yet and CHANGELOG.md has that version's dated section,
// complete in both languages. Run by the release workflow as
// `node tools/release/plan.js <event> <file>`, the file holding what `git
// ls-remote --tags --refs origin` lists, it prints the plan as `name=value`
// lines for GITHUB_OUTPUT. A pull request only rehearses, whatever its
// version. A release is the latest when no newer release, beta aside, is
// tagged, and only the latest is deployed to the PC web app's host, which
// never goes back to an older build. Only Node's built-ins are used.

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { releaseSection } from './changelog.js';

/** The app's version name and code, from its build.gradle. */
export function appVersion(gradle) {
  const name = /^\s*versionName "([^"]+)"$/mu.exec(gradle)?.[1];
  const code = /^\s*versionCode (\d+)$/mu.exec(gradle)?.[1];
  if (name === undefined || code === undefined) throw new Error('build.gradle has no versionName or versionCode');
  if (!/^\d+\.\d+\.\d+(-beta\.\d+)?$/u.test(name)) throw new Error(`versionName ${name} is not a release version`);
  return { name, code: Number(code) };
}

/** The app's release versions tagged so far, from `git ls-remote --tags --refs` lines. */
export function taggedVersions(listing) {
  return listing
    .split('\n')
    .map((line) => /\trefs\/tags\/v(\d+\.\d+\.\d+(?:-beta\.\d+)?)$/u.exec(line)?.[1])
    .filter((version) => version !== undefined);
}

/** Below zero when `a` is older than `b`, above when newer; a beta comes before its release. */
export function compareVersions(a, b) {
  const parts = (version) => {
    const [core = '', beta] = version.split('-beta.');
    return [...core.split('.').map(Number), beta === undefined ? Infinity : Number(beta)];
  };
  const [x, y] = [parts(a), parts(b)];
  const index = x.findIndex((part, at) => part !== y[at]);
  return index === -1 ? 0 : Math.sign(x[index] - y[index]);
}

/** What the workflow does with this commit. */
export function releasePlan({ gradle, changelog, listing, event }) {
  const { name: version } = appVersion(gradle);
  const tagged = taggedVersions(listing);
  const pending = event === 'pull_request' || !tagged.includes(version);
  const section = pending ? releaseSection(changelog, version) : undefined;
  const prerelease = version.includes('-');
  const newer = tagged.some((other) => !other.includes('-') && compareVersions(other, version) > 0);
  const release = event === 'push' && !tagged.includes(version) && section !== undefined;
  return {
    version,
    build: event === 'pull_request' || release,
    release,
    prerelease,
    latest: !prerelease && !newer,
    note:
      event === 'pull_request'
        ? `A rehearsal of ${version}: nothing is signed, tagged or published`
        : tagged.includes(version)
          ? `v${version} is already tagged: no release`
          : section === undefined
            ? `${version} has no dated heading in CHANGELOG.md: no release`
            : `${version} is released once the release manager approves it`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../../', import.meta.url);
  const plan = releasePlan({
    gradle: readFileSync(new URL('apps/android/android/app/build.gradle', root), 'utf8'),
    changelog: readFileSync(new URL('CHANGELOG.md', root), 'utf8'),
    listing: readFileSync(process.argv[3] ?? '', 'utf8'),
    event: process.argv[2],
  });
  process.stderr.write(`::notice title=Release::${plan.note}\n`);
  for (const key of ['version', 'build', 'release', 'prerelease', 'latest'])
    process.stdout.write(`${key}=${plan[key]}\n`);
}
