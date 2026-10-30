// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Checks a host of the PC web app once a build is deployed (answer 528), as a
// teacher's browser will see it: `node scripts/check-host.ts [address]
// [checksum]`, by default the address teachers open. Every file build.json
// lists must come back whole, by its SHA-256, with its media type and the
// host's headers (scripts/host.ts), straight, with no redirect, no cookie and
// no header that has the browser report to anyone; the address itself must
// give the page; a file the build does not hold must not be found, so the
// host answers nothing but the build; the page's policy may name no address
// but its own and the demo server's. And build.json must name the release's
// build checksum, which only a check on this computer may leave out, as any
// build passes the rest. Plain HTTP is refused but on this computer. Prints
// each problem; exits 1 if there are.

import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checksum } from './hashes.ts';
import { addressProblems, ADDRESS, hostHeaders, pagePolicy, typeOf } from './host.ts';

type Built = { version: string; sha256: string; files: Record<string, string> };

/** Headers that would have the browser send reports, such as Cloudflare's Network Error Logging. */
const REPORTING = ['NEL', 'Report-To', 'Reporting-Endpoints'];

/** The problems found with the build served at `address`, none when it is served as it should be. */
export async function checkHost(address: string, expected?: string): Promise<string[]> {
  const base = new URL(address.endsWith('/') ? address : `${address}/`);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
  if (base.protocol !== 'https:' && !(local && base.protocol === 'http:')) return [`${base.href} is not HTTPS`];
  if (expected === undefined && !local) return [`${base.href}: give the release's build checksum to check against`];
  const problems: string[] = [];
  const get = (path: string) => fetch(new URL(path, base), { redirect: 'manual' });
  const listed = await get('build.json');
  if (listed.status !== 200) return [`build.json: status ${listed.status}`];
  const built = (await listed.json()) as Built;
  if (checksum(built.files) !== built.sha256) problems.push('build.json: its checksum does not match its files');
  if (expected !== undefined && built.sha256 !== expected) {
    problems.push(`build.json: checksum ${built.sha256}, the release's is ${expected}`);
  }
  const page = await (await get('index.html')).text();
  const headers = hostHeaders(pagePolicy(page), base.protocol === 'https:');
  problems.push(...addressProblems(pagePolicy(page)).map((problem) => `index.html: ${problem}`));
  const names = Object.keys(built.files).sort();
  for (const path of ['', 'build.json', ...names]) {
    const name = path === '' ? 'index.html' : path;
    const response = await get(path);
    const label = path === '' ? base.href : path;
    if (response.status !== 200) {
      problems.push(`${label}: status ${response.status}`);
      continue;
    }
    const wanted = { 'Content-Type': typeOf(name) ?? '', ...headers };
    for (const [header, value] of Object.entries(wanted)) {
      const got = response.headers.get(header);
      if (got !== value) problems.push(`${label}: ${header} is ${got ?? 'missing'}, not ${value}`);
    }
    if (response.headers.has('Set-Cookie')) problems.push(`${label}: sets a cookie`);
    for (const header of REPORTING) if (response.headers.has(header)) problems.push(`${label}: sends ${header}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (name !== 'build.json' && hash !== built.files[name]) problems.push(`${label}: not the build's file`);
  }
  const stray = await get(`not-in-the-build-${built.sha256.slice(0, 8)}.html`);
  if (stray.status !== 404) problems.push(`a file outside the build: status ${stray.status}, not 404`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [address = ADDRESS, expected] = process.argv.slice(2);
  const problems = await checkHost(address, expected);
  for (const problem of problems) process.stdout.write(`${problem}\n`);
  process.stdout.write(problems.length === 0 ? `${address}: served as built\n` : `${problems.length} problems\n`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
