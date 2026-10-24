// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Minhajna archive written and read back (#248, answer 472), from a
// made-up class: what it leaves out, and the files it refuses.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ARCHIVE_FILE,
  archiveOf,
  archiveText,
  buildState,
  readArchive,
  type ArchiveOptions,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, d, languagePack, mathPack, openBook } from './fixtures.ts';
import { deps } from './support.ts';

const options: ArchiveOptions = {
  made: d('2026-10-24'),
  app: '0.5.0',
  country: 'dz',
  calendarRelease: '2026.1',
  privateNotes: false,
  bundledPacks: [languagePack, mathPack],
};

/** A made-up class with a private note, the teacher's personal fields, and one erased note. */
async function book(): Promise<RecordBook> {
  const opened = await openBook(cemEvents());
  await opened.record(d('2026-09-14'), {
    kind: 'teacher.personal.set',
    personal: { name: 'Made-up Teacher', signatureOn: false },
  });
  await opened.record(d('2026-09-20'), {
    kind: 'session.noted',
    note: { sessionKey: 'made-up-session', note: 'Made-up private note' },
  });
  const gone = await opened.record(d('2026-09-21'), {
    kind: 'session.noted',
    note: { sessionKey: 'other-session', note: 'Made-up note, later erased' },
  });
  await opened.erase(d('2026-09-22'), [gone.id]);
  return opened;
}

function find(text: string, pattern: string): boolean {
  return text.includes(pattern);
}

describe('the Minhajna archive', () => {
  it('keeps every entry as stored, less the personal fields and the private notes', async () => {
    const opened = await book();
    const archive = archiveOf(opened.entries, opened.state, options);
    const text = archiveText(archive);
    assert.equal(ARCHIVE_FILE, 'minhajna-archive.json');
    assert.equal(archive.entries.length, opened.entries.length);
    assert.equal(find(text, 'Made-up Teacher'), false);
    assert.equal(find(text, 'Made-up private note'), false);
    assert.equal(find(text, 'later erased'), false);
    const personal = opened.entries.filter((entry) => entry.kind === 'teacher.personal.set');
    const note = opened.entries.find((entry) => entry.kind === 'session.noted' && entry.content !== null)!;
    assert.ok(personal.length > 0);
    assert.deepEqual(archive.leftOut, [...personal.map((entry) => entry.id), note.id]);
    const kept = archive.entries.find((entry) => entry.kind === 'class.set')!;
    assert.deepEqual(kept.body, opened.entries.find((entry) => entry.id === kept.id)!.content!.body);
  });

  it('carries the private notes when the teacher includes them', async () => {
    const opened = await book();
    const archive = archiveOf(opened.entries, opened.state, { ...options, privateNotes: true });
    assert.equal(find(archiveText(archive), 'Made-up private note'), true);
    assert.deepEqual(
      archive.leftOut,
      opened.entries.filter((entry) => entry.kind === 'teacher.personal.set').map((entry) => entry.id),
    );
    assert.equal(archive.privateNotes, true);
  });

  it('carries the bundled releases the classes are pinned to, and only those', async () => {
    const opened = await book();
    const archive = archiveOf(opened.entries, opened.state, options);
    assert.deepEqual(
      archive.packs.map((pack) => pack.id),
      [mathPack.id],
    );
    assert.deepEqual(archiveOf(opened.entries, opened.state, { ...options, bundledPacks: [] }).packs, []);
  });

  it('reads back what it wrote, with a chain that still checks', async () => {
    const opened = await book();
    const archive = archiveOf(opened.entries, opened.state, options);
    const read = await readArchive(archiveText(archive), deps.digest);
    assert.ok(read.ok);
    assert.deepEqual(read.archive, JSON.parse(archiveText(archive)));
    assert.equal(read.entries.length, opened.entries.length);
    const state = buildState(read.entries);
    assert.equal(state.classes.size, opened.state.classes.size);
    assert.equal(state.pupils.size, opened.state.pupils.size);
    assert.equal(state.personal, null);
  });

  it('reads an archive made with an erased personal field, its erasure kept', async () => {
    const opened = await book();
    const personal = opened.entries.filter((entry) => entry.kind === 'teacher.personal.set').map((entry) => entry.id);
    await opened.erase(d('2026-09-23'), personal);
    const archive = archiveOf(opened.entries, opened.state, options);
    assert.equal(
      archive.leftOut.some((id) => personal.includes(id)),
      false,
    );
    assert.ok((await readArchive(archiveText(archive), deps.digest)).ok);
  });

  it('refuses a changed entry, a broken chain, or content left out without saying so', async () => {
    const opened = await book();
    const archive = JSON.parse(archiveText(archiveOf(opened.entries, opened.state, options))) as {
      entries: { kind: string; body: unknown; salt: string | null; seq: number }[];
      leftOut: string[];
    };
    const changed = structuredClone(archive);
    const target = changed.entries.find((entry) => entry.kind === 'class.set')!;
    target.body = { ...(target.body as object), made: 'up' };
    assert.deepEqual(await readArchive(JSON.stringify(changed), deps.digest), { ok: false, problem: 'chain' });

    const dropped = structuredClone(archive);
    dropped.entries.splice(3, 1);
    assert.deepEqual(await readArchive(JSON.stringify(dropped), deps.digest), { ok: false, problem: 'invalid' });

    const hidden = structuredClone(archive);
    const quiet = hidden.entries.find((entry) => entry.kind === 'class.set')!;
    quiet.body = null;
    quiet.salt = null;
    assert.deepEqual(await readArchive(JSON.stringify(hidden), deps.digest), { ok: false, problem: 'chain' });

    const twice = structuredClone(archive) as unknown as { entries: { id: string }[] };
    twice.entries[2]!.id = twice.entries[1]!.id;
    assert.deepEqual(await readArchive(JSON.stringify(twice), deps.digest), { ok: false, problem: 'invalid' });

    const claimed = structuredClone(archive);
    const named = claimed.entries.find((entry) => entry.kind === 'class.set')! as unknown as { id: string };
    claimed.leftOut = [...claimed.leftOut, named.id];
    assert.deepEqual(await readArchive(JSON.stringify(claimed), deps.digest), { ok: false, problem: 'invalid' });
  });

  it('reads a newer minor version as far as it knows, and refuses a newer major one or an unknown field', async () => {
    const opened = await book();
    const archive = JSON.parse(archiveText(archiveOf(opened.entries, opened.state, options))) as Record<
      string,
      unknown
    >;
    const extra = { ...archive, comment: 'Made-up field' };
    assert.deepEqual(await readArchive(JSON.stringify(extra), deps.digest), { ok: false, problem: 'invalid' });
    const newer = { ...extra, version: { major: 1, minor: 4 } };
    const read = await readArchive(JSON.stringify(newer), deps.digest);
    assert.ok(read.ok);
    assert.equal(Object.hasOwn(read.archive, 'comment'), false);
    const major = { ...archive, version: { major: 2, minor: 0 } };
    assert.deepEqual(await readArchive(JSON.stringify(major), deps.digest), { ok: false, problem: 'version' });
  });

  it('refuses what is not an archive', async () => {
    for (const input of ['', 'not json', '[]', '{"format":"minhajna.signed"}', JSON.stringify({ format: 1 })])
      assert.equal((await readArchive(input, deps.digest)).ok, false);
    const opened = await book();
    const archive = JSON.parse(archiveText(archiveOf(opened.entries, opened.state, options))) as Record<
      string,
      unknown
    >;
    const badPack = { ...archive, packs: [{ id: 'not a pack' }] };
    assert.deepEqual(await readArchive(JSON.stringify(badPack), deps.digest), { ok: false, problem: 'invalid' });
    const badDay = { ...archive, made: '24/10/2026' };
    assert.deepEqual(await readArchive(JSON.stringify(badDay), deps.digest), { ok: false, problem: 'invalid' });
  });
});
