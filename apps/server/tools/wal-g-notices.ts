// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes the notices of what WAL-G's released binary has built in (#536): `node
// tools/wal-g-notices.ts <binary>... > container/wal-g-notices.txt`. The
// release has its Go and C libraries linked in and ships no notices of its own.
// The Go modules come from the binary's build information, so the list is the
// binary's and not a guess from go.mod, and every binary given must hold the
// same. Each module's licence, NOTICE and PATENTS files come from the Go module
// proxy at that version, nested ones too with their folder said, and the same
// text is printed once, under all the modules that carry it. Notices written
// only in source files are named by hand in IN_SOURCE and GO_SOURCES, and the C
// libraries in C_LIBRARIES, as a binary doesn't name their versions: PINNED
// says which release they were checked for, and a build tag with no entry stops
// the run. Only a maintainer runs it, when the Dockerfile's pin moves, reading
// WAL-G's Makefile and scripts at the new tag; the file it writes is committed.

import { readFileSync, realpathSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

export const PINNED = '3.0.9';

const MAGIC = Buffer.from('\xff Go buildinf:', 'latin1');
const TEXTS = /^(?:licen[cs]e|copying|notices?|patents)(?:[.-].*)?$|notices?(?:\.(?:txt|md|rst))?$/iu;
const CODE = /\.(?:go|s|c|h|json|ya?ml|proto)$/iu;
const RULE = `\n\n${'-'.repeat(72)}\n\n`;

export interface GoModule {
  readonly path: string;
  readonly version: string;
}

export interface BuildInfo {
  readonly go: string;
  readonly tags: readonly string[];
  readonly modules: readonly GoModule[];
}

interface CLibrary {
  readonly tag: string;
  readonly title: string;
  readonly said: string;
  readonly url: string;
}

const C_LIBRARIES: readonly CLibrary[] = [
  {
    tag: 'brotli',
    title: `Brotli, at the commit WAL-G ${PINNED} names, ab685df8343d`,
    said: 'MIT. Source: https://github.com/google/brotli/tree/ab685df8343d',
    url: 'https://raw.githubusercontent.com/google/brotli/ab685df8343d8046226ece980408e958c10f9085/LICENSE',
  },
  {
    tag: 'libsodium',
    title: `libsodium 1.0.22, the version WAL-G ${PINNED}'s build scripts name`,
    said: 'ISC. Source: https://github.com/jedisct1/libsodium/tree/1.0.22-RELEASE',
    url: 'https://raw.githubusercontent.com/jedisct1/libsodium/1.0.22-RELEASE/LICENSE',
  },
  {
    tag: 'lzo',
    title: "LZO 2.10, from the release's build system, Ubuntu 22.04",
    said: [
      'Copyright 1996-2017 Markus Franz Xaver Johannes Oberhumer, under the GNU General Public License, version 2',
      'or later, with the text below. WAL-G links it in statically. The binary names no LZO version: WAL-G builds on',
      'Ubuntu 22.04 with liblzo2-dev, whose release there is 2.10-2build3. Source: its package, at',
      'https://launchpad.net/ubuntu/+source/lzo2/2.10-2build3. WAL-G and the scripts that build it:',
      `https://github.com/wal-g/wal-g/tree/v${PINNED}.`,
    ].join('\n'),
    url: 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/GPL-2.0-only.txt',
  },
];

const IN_SOURCE: readonly { readonly module: string; readonly file: string }[] = [
  { module: 'github.com/ProtonMail/go-crypto', file: 'bitcurves/bitcurve.go' },
  { module: 'github.com/ProtonMail/go-crypto', file: 'openpgp/aes/keywrap/keywrap.go' },
  { module: 'github.com/klauspost/compress', file: 'fse/fse.go' },
  { module: 'github.com/prometheus/client_golang', file: 'prometheus/internal/almost_equal.go' },
];

const GO_SOURCES: readonly string[] = [
  'src/crypto/internal/fips140/edwards25519/scalar.go',
  'src/image/jpeg/idct.go',
  'src/math/exp.go',
  'src/math/log.go',
  'src/math/sqrt.go',
  'src/runtime/memmove_amd64.s',
];

const byTitle = (a: { title: string }, b: { title: string }) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);

function uvarint(bytes: Buffer, from: number): { value: number; next: number } {
  let value = 0;
  let scale = 1;
  let at = from;
  for (;;) {
    const byte = bytes[at];
    if (byte === undefined) throw new Error('the build information ends early');
    value += (byte & 0x7f) * scale;
    at += 1;
    if (byte < 0x80) return { value, next: at };
    scale *= 128;
  }
}

/** The Go version, build tags and modules a binary was built with, each module as its replacement if it has one. */
export function readBuildInfo(binary: Buffer): BuildInfo {
  const start = binary.indexOf(MAGIC);
  if (start < 0 || ((binary[start + 15] ?? 0) & 2) === 0) throw new Error('no inline Go build information');
  const size = uvarint(binary, start + 32);
  const go = binary.toString('latin1', size.next, size.next + size.value).split(' ')[0] ?? '';
  const info = uvarint(binary, size.next + size.value);
  const lines = binary.toString('latin1', info.next, info.next + info.value).split('\n');
  const modules: GoModule[] = [];
  for (const line of lines) {
    const [kind, path, version] = line.split('\t');
    if (path === undefined || version === undefined) continue;
    if (kind === 'dep') modules.push({ path, version });
    if (kind === '=>') modules[modules.length - 1] = { path, version };
  }
  const tags = lines.find((line) => line.startsWith('build\t-tags='))?.slice('build\t-tags='.length) ?? '';
  return { go, tags: tags === '' ? [] : tags.split(','), modules };
}

/** The files of a zip under a prefix that `keep` accepts, named from the prefix on. */
function zipFiles(zip: Buffer, prefix: string, keep: (name: string) => boolean): { name: string; text: string }[] {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error(`${prefix} is not a zip`);
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const found: { name: string; text: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    const method = zip.readUInt16LE(at + 10);
    const compressed = zip.readUInt32LE(at + 20);
    const nameSize = zip.readUInt16LE(at + 28);
    const extra = zip.readUInt16LE(at + 30);
    const comment = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const full = zip.toString('utf8', at + 46, at + 46 + nameSize);
    at += 46 + nameSize + extra + comment;
    const name = full.startsWith(prefix) ? full.slice(prefix.length) : '';
    if (name === '' || !keep(name)) continue;
    const data = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(data, data + compressed);
    const text = (method === 0 ? raw : inflateRawSync(raw)).toString('utf8').replace(/\r\n/gu, '\n').trim();
    found.push({ name, text });
  }
  return found.sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Every licence, NOTICE and PATENTS file of a module's zip, in order of name, test data left out. */
export function licenceTexts(zip: Buffer, module: GoModule): { name: string; text: string }[] {
  return zipFiles(zip, `${module.path}@${module.version}/`, (name) => {
    const base = name.split('/').at(-1) ?? '';
    return TEXTS.test(base) && !CODE.test(base) && !name.split('/').includes('testdata');
  });
}

/** The comments of a source file that hold someone's copyright, other than the Go Authors' own line. */
export function noticesIn(source: string): string {
  const blocks = source.match(/\/\*[\s\S]*?\*\/|(?:^[ \t]*\/\/.*\n?)+/gmu) ?? [];
  const kept = blocks.filter(
    (block) =>
      /copyright|based on work/iu.test(block) &&
      !/^\/\/ Copyright \d+ The Go Authors[^\n]*\n\/\/ Use of[^\n]*\n\/\/ license[^\n]*\n?$/u.test(block),
  );
  return kept.map((block) => block.trim()).join('\n\n');
}

/** A module's address at the proxy, each capital spelt as `!` and the small letter. */
export function proxyUrl(module: GoModule): string {
  const escaped = (text: string) => text.replace(/[A-Z]/gu, (letter) => `!${letter.toLowerCase()}`);
  return `https://proxy.golang.org/${escaped(module.path)}/@v/${escaped(module.version)}.zip`;
}

/** The C libraries of a binary's build tags; a tag with no entry stops the run rather than go unsaid. */
export function librariesFor(tags: readonly string[]): readonly CLibrary[] {
  return tags.map((tag) => {
    const library = C_LIBRARIES.find((one) => one.tag === tag);
    if (library === undefined) throw new Error(`no notice for the build tag ${tag}`);
    return library;
  });
}

/** The one build information every binary shares; binaries that differ stop the run. */
export function sharedBuild(builds: readonly BuildInfo[]): BuildInfo {
  const [first, ...more] = builds;
  if (first === undefined) throw new Error('no binary given');
  if (more.some((other) => JSON.stringify(other) !== JSON.stringify(first))) {
    throw new Error('the binaries hold different things');
  }
  return first;
}

/** The notices, each text once, under all that carry it. */
export function render(
  head: string,
  libraries: readonly { title: string; said: string; text: string }[],
  modules: readonly { title: string; text: string }[],
): string {
  const titled = new Map<string, string[]>();
  for (const { title, text } of [...modules].sort(byTitle)) {
    titled.set(text, [...(titled.get(text) ?? []), title]);
  }
  const groups = [...titled.entries()].map(([text, titles]) => `${titles.join('\n')}\n\n${text}`);
  const native = libraries.map(({ title, said, text }) => `${title}\n${said}\n\n${text}`);
  return `${[head.trim(), ...native, ...groups].join(RULE)}\n`;
}

/** A file from the network: a server's own failure or a dropped connection is tried again, a refusal isn't. */
export async function fetched(url: string, get: typeof fetch = fetch, pause = 2000): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    let refused: Error | null = null;
    try {
      const answer = await get(url, { signal: AbortSignal.timeout(60_000) });
      if (answer.ok) return Buffer.from(await answer.arrayBuffer());
      refused = new Error(`${url}: ${answer.status}`);
      if (answer.status < 500) throw refused;
    } catch (problem) {
      if (problem === refused || attempt === 4) throw problem;
    }
    if (refused !== null && attempt === 4) throw refused;
    await new Promise((done) => setTimeout(done, pause * attempt));
  }
}

async function moduleNotice(module: GoModule): Promise<{ title: string; text: string }> {
  const zip = await fetched(proxyUrl(module));
  const parts = licenceTexts(zip, module).map(({ name, text }) => (name.includes('/') ? `${name}:\n\n${text}` : text));
  const named = IN_SOURCE.filter((one) => one.module === module.path).map(({ file }) => {
    const [source] = zipFiles(zip, `${module.path}@${module.version}/`, (name) => name === file);
    const text = source === undefined ? '' : noticesIn(source.text);
    if (text === '') throw new Error(`no notice in ${module.path}/${file}`);
    return `${file}:\n\n${text}`;
  });
  const text = [...parts, ...named].join('\n\n');
  return { title: `${module.path} ${module.version}`, text: text === '' ? 'It ships no licence file.' : text };
}

async function goRuntime(go: string): Promise<{ title: string; said: string; text: string }> {
  const raw = async (file: string) =>
    (await fetched(`https://raw.githubusercontent.com/golang/go/${go}/${file}`)).toString('utf8').trim();
  const sources = await Promise.all(
    GO_SOURCES.map(async (file) => {
      const text = noticesIn(await raw(file));
      if (text === '') throw new Error(`no notice in ${file}`);
      return `${file}:\n\n${text}`;
    }),
  );
  const text = [await raw('LICENSE'), await raw('PATENTS'), ...sources].join('\n\n');
  return { title: `Go ${go.slice(2)}`, said: `Source: https://github.com/golang/go/tree/${go}`, text };
}

async function write(binaries: readonly string[]): Promise<string> {
  const build = sharedBuild(binaries.map((path) => readBuildInfo(readFileSync(path))));
  const libraries = await Promise.all(
    librariesFor(build.tags).map(async ({ title, said, url }) => ({
      title,
      said,
      text: (await fetched(url)).toString('utf8').trim(),
    })),
  );
  const modules: { title: string; text: string }[] = [];
  for (const module of build.modules) modules.push(await moduleNotice(module));
  const head = [
    `What WAL-G ${PINNED}'s released binary has built in`,
    '',
    `Written by tools/wal-g-notices.ts from the binary's own build information: ${build.modules.length} Go modules,`,
    `the Go ${build.go.slice(2)} standard library and runtime, and C libraries for the tags ${build.tags.join(', ')}.`,
    'The source of each Go module is at its version on https://proxy.golang.org, apart from two that WAL-G alters as',
    `it builds, by the scripts at https://github.com/wal-g/wal-g/tree/v${PINNED}: its link_brotli.sh replaces`,
    "github.com/google/brotli/go/cbrotli with Brotli's commit below and rewrites its cgo.go, and its Makefile",
    "overwrites Brotli's CMakeLists.txt and patches the LDFLAGS line of github.com/cyberdelia/lzo's lzo.go. The",
    'source of the C libraries is named under each. Some nested licences cover parts the binary does not link:',
    'they are kept, as more notices do no harm and fewer might.',
  ].join('\n');
  return render(head, [await goRuntime(build.go), ...libraries], modules);
}

if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const binaries = process.argv.slice(2);
  if (binaries.length === 0) {
    process.stderr.write('usage: node tools/wal-g-notices.ts <binary>...\n');
    process.exit(2);
  }
  process.stdout.write(await write(binaries));
}
