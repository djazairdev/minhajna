// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// WAL-G's notices (tools/wal-g-notices.ts) on made-up binaries and made-up
// module zips: the build information read with a replaced module and a length
// over one byte, the inline flag required; licence, NOTICE and PATENTS files at
// any depth but test data, code with such names left out; notices found in
// source files; the proxy's spelling of capitals; a tag with no notice and
// binaries that differ stopping the run; a refused file failing at once and a
// server's failure tried again; each text once under all that carry it. The
// file the image holds names the version the Dockerfile pins and what it must
// say.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import {
  fetched,
  librariesFor,
  licenceTexts,
  noticesIn,
  PINNED,
  proxyUrl,
  readBuildInfo,
  render,
  sharedBuild,
} from '../tools/wal-g-notices.js';

function sized(text: string): Buffer {
  const length = [];
  let left = text.length;
  while (left >= 0x80) {
    length.push((left & 0x7f) | 0x80);
    left = Math.floor(left / 128);
  }
  return Buffer.concat([Buffer.from([...length, left]), Buffer.from(text, 'latin1')]);
}

function binary(go: string, info: string, flags = 2): Buffer {
  const head = Buffer.alloc(32);
  head.write('\xff Go buildinf:', 0, 'latin1');
  head[15] = flags;
  return Buffer.concat([
    Buffer.from('made-up start'),
    head,
    sized(go),
    sized(info),
    Buffer.from('dep\tmade.up/after\tv9'),
  ]);
}

const EXTRA = Buffer.from('made-up extra field');
const COMMENT = Buffer.from('made-up comment');

function zipOf(files: Record<string, string>, stored = false): Buffer {
  const locals: Buffer[] = [];
  const entries: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = stored ? Buffer.from(text) : deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(Buffer.byteLength(name), 26);
    local.writeUInt16LE(EXTRA.length, 28);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(EXTRA.length, 30);
    entry.writeUInt16LE(COMMENT.length, 32);
    entry.writeUInt16LE(stored ? 0 : 8, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt16LE(Buffer.byteLength(name), 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, Buffer.from(name), EXTRA, data);
    entries.push(entry, Buffer.from(name), EXTRA, COMMENT);
    offset += local.length + Buffer.byteLength(name) + EXTRA.length + data.length;
  }
  const central = Buffer.concat(entries);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

describe("WAL-G's notices", () => {
  it('reads the Go version, tags and modules, a replaced one as its replacement', () => {
    const info = [
      'path\tmade.up/tool',
      'mod\tmade.up/tool\t(devel)',
      'dep\tmade.up/one\tv1.0.0\th1:a',
      'dep\tmade.up/old\tv2.0.0',
      '=>\tmade.up/new\tv2.1.0\th1:b',
      'build\t-tags=brotli,lzo',
    ].join('\n');
    assert.ok(info.length >= 0x80);
    assert.deepEqual(readBuildInfo(binary('go1.25.11 X:jsonv2', info)), {
      go: 'go1.25.11',
      tags: ['brotli', 'lzo'],
      modules: [
        { path: 'made.up/one', version: 'v1.0.0' },
        { path: 'made.up/new', version: 'v2.1.0' },
      ],
    });
  });

  it('reads no tags when there are none, and refuses a file without inline build information', () => {
    assert.deepEqual(readBuildInfo(binary('go1.25.11', 'path\tmade.up/tool')).tags, []);
    assert.throws(() => readBuildInfo(Buffer.from('nothing here')), /no inline Go build information/u);
    assert.throws(() => readBuildInfo(binary('go1.25.11', 'x', 0)), /no inline Go build information/u);
  });

  it('takes the licence, NOTICE and PATENTS files of a module, nested ones too, in order', () => {
    const module = { path: 'made.up/one', version: 'v1.0.0' };
    const top = 'made.up/one@v1.0.0/';
    const files = {
      [`${top}main.go`]: 'code',
      [`${top}license.go`]: 'code with the name of a licence',
      [`${top}NOTICE`]: 'Made-up\r\nnotice\r\n',
      [`${top}LICENCE.txt`]: 'Made-up licence\n',
      [`${top}COPYING`]: 'Made-up copying',
      [`${top}THIRD-PARTY-NOTICES`]: 'Made-up others',
      [`${top}PATENTS`]: 'Made-up patents',
      [`${top}inner/LICENSE`]: 'A vendored one',
      [`${top}testdata/LICENSE`]: 'A test file',
      'made.up/other@v1.0.0/LICENSE': 'Another module',
    };
    const found = [
      { name: 'COPYING', text: 'Made-up copying' },
      { name: 'LICENCE.txt', text: 'Made-up licence' },
      { name: 'NOTICE', text: 'Made-up\nnotice' },
      { name: 'PATENTS', text: 'Made-up patents' },
      { name: 'THIRD-PARTY-NOTICES', text: 'Made-up others' },
      { name: 'inner/LICENSE', text: 'A vendored one' },
    ];
    assert.deepEqual(licenceTexts(zipOf(files), module), found);
    assert.deepEqual(licenceTexts(zipOf(files, true), module), found);
    assert.throws(() => licenceTexts(Buffer.from('not a zip'), module), /is not a zip/u);
  });

  it("finds the notices in a source file, not the Go Authors' own line", () => {
    const authors = '// Copyright 2009 The Go Authors. All rights reserved.\n// Use of this\n// license here\n';
    const notices = '// Copyright (C) 2004 by Made Up, Inc.\n// Keep this.\n\n/* Copyright 1996 Other. */';
    const source = `${authors}\npackage made\n\n// A comment\nfunc a() {}\n\n${notices}\n`;
    assert.equal(noticesIn(source), notices);
    assert.equal(noticesIn(`${authors}package made\n`), '');
    const more = `${authors}// Copyright 2011 Someone Else.\n`;
    assert.equal(noticesIn(`${more}package made\n`), more.trim());
    const leading = `// A first line.\n${authors}`;
    assert.equal(noticesIn(`${leading}package made\n`), leading.trim());
    const two = 'code()\n/* Copyright 1 One. */\nmore()\n/* Plain words. */\n';
    assert.equal(noticesIn(two), '/* Copyright 1 One. */');
    assert.equal(noticesIn('func a() {\n  // Copyright 2 Indented.\n}\n'), '// Copyright 2 Indented.');
    assert.equal(noticesIn('// Based on work of Someone.\npackage made\n'), '// Based on work of Someone.');
  });

  it("spells a module's capitals as the proxy does, in its version too", () => {
    assert.equal(
      proxyUrl({ path: 'github.com/Azure/go-AUTH', version: 'v1.0.0-RC' }),
      'https://proxy.golang.org/github.com/!azure/go-!a!u!t!h/@v/v1.0.0-!r!c.zip',
    );
  });

  it('stops on a tag with no notice, and on binaries that differ', () => {
    assert.deepEqual(
      librariesFor(['lzo', 'brotli']).map((one) => one.tag),
      ['lzo', 'brotli'],
    );
    assert.throws(() => librariesFor(['made-up']), /no notice for the build tag made-up/u);
    const one = { go: 'go1', tags: [], modules: [{ path: 'a', version: 'v1' }] };
    assert.equal(sharedBuild([one, { ...one }]).go, 'go1');
    assert.throws(() => sharedBuild([one, { ...one, modules: [] }]), /hold different things/u);
    assert.throws(() => sharedBuild([]), /no binary given/u);
  });

  it("fails at once on a refused file, and tries a server's failure and a dropped connection again", async () => {
    let asked = 0;
    const answers =
      (make: () => Response): typeof fetch =>
      () => {
        asked += 1;
        return Promise.resolve(make());
      };
    await assert.rejects(
      fetched(
        'made://up',
        answers(() => new Response('', { status: 404 })),
        0,
      ),
      /made:\/\/up: 404/u,
    );
    assert.equal(asked, 1);
    asked = 0;
    await assert.rejects(
      fetched(
        'made://up',
        answers(() => new Response('', { status: 503 })),
        0,
      ),
      /503/u,
    );
    assert.equal(asked, 4);
    let tries = 0;
    const dropped: typeof fetch = () => {
      tries += 1;
      return tries < 3 ? Promise.reject(new Error('dropped')) : Promise.resolve(new Response('the text'));
    };
    assert.equal((await fetched('made://up', dropped, 0)).toString(), 'the text');
    let cut = 0;
    const midway: typeof fetch = () => {
      cut += 1;
      if (cut > 1) return Promise.resolve(new Response('whole'));
      const body = new ReadableStream({ pull: (stream) => stream.error(new Error('cut off')) });
      return Promise.resolve(new Response(body));
    };
    assert.equal((await fetched('made://up', midway, 0)).toString(), 'whole');
    const never: typeof fetch = () => Promise.reject(new Error('dropped for good'));
    await assert.rejects(fetched('made://up', never, 0), /dropped for good/u);
  });

  it('prints each text once, under all that carry it, after the C libraries', () => {
    const text = render(
      'The head',
      [{ title: 'A library', said: 'ISC', text: 'Its text' }],
      [
        { title: 'zeta v1', text: 'Same text' },
        { title: 'alpha v1', text: 'Same text' },
        { title: 'beta v1', text: 'Other text' },
      ],
    );
    assert.ok(text.startsWith('The head\n'));
    const library = text.indexOf('A library\nISC\n\nIts text');
    assert.ok(library >= 0);
    assert.ok(library < text.indexOf('alpha v1\nzeta v1\n\nSame text'));
    assert.equal(text.split('Same text').length, 2);
    assert.ok(text.includes('beta v1\n\nOther text'));
  });

  it('holds the version the Dockerfile pins, and what it must say', () => {
    const file = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    assert.equal(/releases\/download\/v(\d+\.\d+\.\d+)\/wal-g-pg/u.exec(file('Dockerfile'))?.[1], PINNED);
    const notices = file('container/wal-g-notices.txt');
    assert.ok(notices.startsWith(`What WAL-G ${PINNED}'s released binary has built in\n`));
    const count = /build information: (\d+) Go modules/u.exec(notices)?.[1];
    assert.equal(notices.match(/^[^\s/]+\.\S* v\d\S*$/gmu)?.length, Number(count));
    const said = [
      'GNU GENERAL PUBLIC LICENSE',
      '2.10-2build3',
      'libsodium 1.0.22',
      'https://github.com/google/brotli/tree/ab685df8343d',
      'Dave Collins',
      'Joshua Tacoma',
      'Matthew Endsley',
      'Björn Rabenstein',
      'Yann Collet',
      'ThePiachu',
      'Copyright (C) 2004 by Sun Microsystems',
      'Copyright (C) 1993 by Sun Microsystems',
      'Markus Franz Xaver Johannes Oberhumer',
      'Frank Denis',
      'by the Brotli Authors',
      'Mozilla Public License',
      'https://github.com/jedisct1/libsodium/tree/1.0.22-RELEASE',
      'github.com/aws/aws-sdk-go v1.55.8',
      'internal/spew/LICENSE:',
      'internal/third_party/uritemplates/LICENSE:',
      'fiat-crypto',
      'Lucent Technologies',
      'MPEG Software Simulation Group',
      'link_brotli.sh',
      'LDFLAGS',
    ];
    for (const text of said) assert.ok(notices.includes(text), text);
  });
});
