// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A release's notes from CHANGELOG.md (docs/contributing/releases.md, answer
// 533), so the release workflow publishes what the release pull request
// wrote and nothing is typed twice: the version's dated section, its English
// introduction then its Arabic one, any further paragraph such as the
// thanks, and each section's entries, every English line with its Arabic
// line nested below it. A section out of order, an entry
// without its Arabic line or an undated version is refused, as checklist
// item 3 asks for both texts complete. The Arabic headings are written as
// escapes, as the code keeps no Arabic letters. Only Node's built-ins are used.

import assert from 'node:assert/strict';

/** The sections a release may have, in their order, with each one's Arabic heading. */
export const SECTIONS = [
  ['New', '\u062c\u062f\u064a\u062f'],
  ['Changed', '\u062a\u063a\u064a\u064a\u0631\u0627\u062a'],
  ['Going away', '\u064a\u064f\u0632\u0627\u0644 \u0644\u0627\u062d\u0642\u0627\u064b'],
  ['Removed', '\u0623\u064f\u0632\u064a\u0644'],
  ['Fixed', '\u0625\u0635\u0644\u0627\u062d\u0627\u062a'],
  ['Privacy', '\u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629'],
  ['Security', '\u0627\u0644\u0623\u0645\u0627\u0646'],
];

const WHATS_NEW = '\u0645\u0627 \u0627\u0644\u062c\u062f\u064a\u062f';
const HELP =
  '\u00ab\u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629 \u0648\u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629\u00bb';
const ADDRESS = 'https://minhajna.djazair.dev';
const SOURCE = 'https://github.com/djazairdev/minhajna';

/** A version's section of the changelog, or undefined while it has no dated heading. */
export function releaseSection(changelog, version) {
  const heading = `\n## ${version} (`;
  const start = changelog.indexOf(heading);
  if (start === -1) return undefined;
  const line = changelog.slice(start + 1, changelog.indexOf('\n', start + 1));
  const date = /^## \S+ \((\d{4}-\d{2}-\d{2})\)$/u.exec(line)?.[1];
  if (date === undefined) return undefined;
  const end = changelog.indexOf('\n## ', start + 1);
  const body = changelog.slice(start + 1 + line.length, end === -1 ? undefined : end).trim();
  const [head = '', ...parts] = body.split(/^### /mu);
  const intro = head.trim().split(/\n{2,}/u);
  assert.ok(intro.length >= 2, `${version}: an English introduction, then an Arabic one`);
  const names = SECTIONS.map(([name]) => name);
  const sections = parts.map((part) => {
    const [name = '', ...lines] = part.trimEnd().split('\n');
    assert.ok(names.includes(name), `${version}: no section is called ${name}`);
    return { name, entries: sectionEntries(version, name, lines) };
  });
  const order = sections.map(({ name }) => names.indexOf(name));
  assert.deepEqual(
    order,
    order.toSorted((a, b) => a - b),
    `${version}: the sections are out of order`,
  );
  assert.equal(new Set(order).size, order.length, `${version}: a section appears twice`);
  return { version, date, english: intro[0], arabic: intro[1], more: intro.slice(2), sections };
}

/** A section's entries, each English line with its Arabic line. */
function sectionEntries(version, name, lines) {
  const entries = [];
  for (const line of lines) {
    if (line.startsWith('- ')) entries.push({ english: line.slice(2), arabic: undefined });
    else if (line.startsWith('  - ') && entries.at(-1)?.arabic === undefined && entries.length > 0) {
      entries.at(-1).arabic = line.slice(4);
    } else assert.equal(line.trim(), '', `${version}, ${name}: a line that is no entry: ${line}`);
  }
  assert.ok(entries.length > 0, `${version}, ${name}: no entry`);
  for (const { english, arabic } of entries) assert.ok(arabic, `${version}, ${name}: no Arabic line for: ${english}`);
  return entries;
}

/** The published names of a release's files, in the order SHA256SUMS.txt lists them. */
export function releaseFiles(version) {
  return {
    universal: `minhajna-${version}.apk`,
    'armeabi-v7a': `minhajna-${version}-armeabi-v7a.apk`,
    'arm64-v8a': `minhajna-${version}-arm64-v8a.apk`,
    mapping: `minhajna-${version}-mapping.txt`,
    bundle: `minhajna-${version}-index.android.bundle.map`,
    web: `minhajna-web-${version}.zip`,
  };
}

/** The GitHub release's notes, from the version's section and the facts the workflow found. */
export function releaseNotes(section, facts) {
  const { version } = section;
  const files = releaseFiles(version);
  const { sums, certificate, webChecksum, commit, run, issue, rehearsal } = facts;
  const row = (name, use) => `| \`${name}\` | ${use} | \`${sums[name]}\` |`;
  const english = section.sections.map(
    ({ name, entries }) => `### ${name}\n\n${entries.map((entry) => `- ${entry.english}`).join('\n')}\n`,
  );
  const arabic = section.sections.map(({ name, entries }) => {
    const heading = SECTIONS.find(([known]) => known === name)?.[1];
    return `### ${heading}\n\n${entries.map((entry) => `- ${entry.arabic}`).join('\n')}\n`;
  });
  const checklist = issue ? ` Release checklist: #${issue}.` : '';
  return [
    ...(rehearsal
      ? ['> **A rehearsal:** these notes were made from unsigned files, and nothing was published.\n']
      : []),
    `${section.english}\n`,
    `${section.arabic}\n`,
    ...section.more.map((paragraph) => `${paragraph}\n`),
    '## Which file\n',
    '| File | For | SHA-256 |',
    '|---|---|---|',
    row(files.universal, '**Any phone with Android 8 or later.** Use this one if unsure.'),
    row(files['arm64-v8a'], '64-bit ARM phones only (smaller)'),
    row(files['armeabi-v7a'], '32-bit ARM phones only (smaller)'),
    `${row(files.web, `The PC web app's files, for its host. Teachers open ${ADDRESS} instead.`)}\n`,
    '**Signing certificate SHA-256** (the same for all three APKs, and for every release since 0.1.0): ' +
      `\`${certificate}\`\n`,
    `**The PC web app's build checksum:** \`${webChecksum}\`. ${HELP} on the PC shows it, to compare with this one.\n`,
    `${HELP} in the phone app shows the installed APK's checksum and its certificate's, to compare with these. ` +
      `\`SHA256SUMS.txt\` lists every file's checksum. \`${files.mapping}\` and \`${files.bundle}\` read crash ` +
      `reports from all three APKs ([how](${SOURCE}/blob/v${version}/docs/contributing/crash-reports.md)).\n`,
    `**Built from the source:** the tag \`v${version}\` (${commit.slice(0, 7)}), signed, ` +
      `by [the release workflow](${run}). ` +
      'Two builds at different paths gave the same unsigned APKs and the same two maps, byte for byte, and each ' +
      `signed APK differs from its build only by its signature. The web ZIP came out the same twice.${checklist}\n`,
    "## What's in it\n",
    ...english,
    `## ${WHATS_NEW}\n`,
    ...arabic,
  ].join('\n');
}
