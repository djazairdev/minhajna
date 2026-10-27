// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The working copy handed to the other device and back (#250, answers 503,
// 513, 514 and 515), from a made-up class: a phone hands its copy to a PC,
// which records more; the phone, meanwhile, records only what never leaves
// it and its prints. What the PC recorded is added after the phone's own
// entries, which stay as they were, its key and backup with them, even when
// the PC has its own key; an erasure made on the PC applies on the phone; a
// copy that does not continue the phone's is refused, as is one when nothing
// was handed over, an export without the private notes, and one that erases
// what the phone recorded since; and the copy goes back and forth again.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HandoverError,
  MemoryStore,
  RecordBook,
  activityLog,
  archiveOf,
  archiveText,
  buildState,
  deviceFacts,
  readArchive,
  recordsWhileHandedOver,
  restoredHistory,
  takenBack,
  verifyHistory,
  type TakenBack,
  type ArchiveOptions,
  type Entry,
  type RecordEvent,
} from '../src/index.ts';
import { relinkedEntry } from '../src/history-entry.ts';
import { cemEvents, d, languagePack, mathPack, openBook } from './fixtures.ts';
import { deps } from './support.ts';

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const PC_KEY = ['A1B2', 'C3D4', 'E5F6', 'G7H8', 'J9K0', 'M1N2'].join('');
const options: ArchiveOptions = {
  made: d('2026-10-24'),
  app: '0.5.0',
  country: 'dz',
  calendarRelease: '2026.1',
  privateNotes: true,
  bundledPacks: [languagePack, mathPack],
};
const note = (sessionKey: string): RecordEvent => ({
  kind: 'session.noted',
  note: { sessionKey, note: 'Made-up note' },
});
const printed = (id: string): RecordEvent => ({
  kind: 'output.recorded',
  output: { id, document: 'week', period: '2026-10-05', how: 'print', blank: false },
});

async function bookOf(entries: readonly Entry[]): Promise<RecordBook> {
  const store = new MemoryStore();
  for (const entry of entries) await store.append(entry);
  return RecordBook.open(store, deps);
}

/** The phone's history once what a take-back adds is stored, and its content erased. */
function applied(ours: readonly Entry[], back: TakenBack, count = back.entries.length): Entry[] {
  const erased = new Set(back.erase);
  const kept = ours.map((entry) => (erased.has(entry.id) ? { ...entry, content: null } : entry));
  return [...kept, ...back.entries.slice(0, count)];
}

async function read(book: RecordBook, privateNotes = true) {
  const made = archiveText(archiveOf(book.entries, book.state, { ...options, privateNotes }));
  const opened = await readArchive(made, deps.digest);
  assert.ok(opened.ok);
  return opened;
}

/** A phone that handed its copy to a PC, and the PC, which recorded a note since. */
async function handed() {
  const phone = await openBook(cemEvents());
  await phone.record(d('2026-10-01'), { kind: 'recovery.set', recovery: { key: KEY } });
  await phone.record(d('2026-10-02'), { kind: 'backup.saved' });
  await phone.record(d('2026-10-03'), note('made-up-phone'));
  const sent = await read(phone);
  await phone.record(d('2026-10-04'), { kind: 'handover.sent', handover: { last: phone.entries.at(-1)!.hash } });
  const pc = await bookOf(await restoredHistory(sent, d('2026-10-04'), deps));
  await pc.record(d('2026-10-05'), note('made-up-pc'));
  await phone.record(d('2026-10-06'), printed('made-up-print'));
  return { phone, pc };
}

describe('the working copy handed over', () => {
  it('records only what never leaves the device, and the prints, while the copy is away', () => {
    assert.equal(recordsWhileHandedOver(printed('made-up')), true);
    assert.equal(recordsWhileHandedOver({ kind: 'backup.saved' }), true);
    assert.equal(recordsWhileHandedOver({ kind: 'recovery.set', recovery: { key: KEY } }), true);
    assert.equal(recordsWhileHandedOver(note('made-up')), false);
  });

  it('is kept in the device facts until it ends, and a malformed one is ignored', async () => {
    const { phone } = await handed();
    assert.equal(deviceFacts(phone.entries).handedOver?.day, d('2026-10-04'));
    await phone.record(d('2026-10-07'), { kind: 'handover.ended', handover: { how: 'taken' } });
    assert.equal(deviceFacts(phone.entries).handedOver, null);
    await phone.record(d('2026-10-08'), { kind: 'handover.sent', handover: { last: 'made-up' } });
    assert.equal(deviceFacts(phone.entries).handedOver, null);
  });

  it('adds what the other device recorded after the device’s own entries, which stay as they were', async () => {
    const { phone, pc } = await handed();
    const back = await takenBack(phone.entries, await read(pc), d('2026-10-09'), deps);
    const history = applied(phone.entries, back);
    assert.deepEqual(await verifyHistory(deps.digest, history), []);
    assert.deepEqual(history.slice(0, phone.entries.length), phone.entries);
    assert.deepEqual(back.erase, []);
    const notes = buildState(history).notes;
    assert.ok(notes.has('made-up-pc') && notes.has('made-up-phone'));
    const facts = deviceFacts(history);
    assert.equal(facts.handedOver, null);
    assert.deepEqual(facts.recovery, { key: KEY, day: d('2026-10-01') });
    assert.equal(facts.lastBackup, d('2026-10-02'));
    assert.equal(back.entries.at(-1)?.kind, 'handover.ended');
    const kinds = activityLog(history).flatMap((day) => day.items.map((item) => item.line.kind));
    assert.ok(kinds.includes('handover-sent') && kinds.includes('handover-ended'));
    assert.equal((await bookOf(history)).entries.length, history.length);
  });

  it('applies an erasure made on the other device, and erases the content it names here', async () => {
    const { phone, pc } = await handed();
    const noted = pc.entries.find((entry) => entry.kind === 'session.noted' && entry.content !== null)!;
    await pc.erase(d('2026-10-05'), [noted.id]);
    const back = await takenBack(phone.entries, await read(pc), d('2026-10-09'), deps);
    assert.deepEqual(back.erase, [noted.id]);
    const history = applied(phone.entries, back);
    assert.deepEqual(await verifyHistory(deps.digest, history), []);
    assert.equal(buildState(history).notes.has('made-up-phone'), false);
  });

  it('refuses a copy that does not continue this one, and any copy when nothing was handed over', async () => {
    const { phone } = await handed();
    const other = await read(await openBook(cemEvents()));
    const refused = (problem: string) => (error: unknown) =>
      error instanceof HandoverError && error.problem === problem;
    await assert.rejects(takenBack(phone.entries, other, d('2026-10-09'), deps), refused('not-continued'));
    const plain = await openBook(cemEvents());
    await assert.rejects(takenBack(plain.entries, other, d('2026-10-09'), deps), refused('not-handed-over'));
  });

  it('keeps this device’s own key when the other device set its own', async () => {
    const { phone, pc } = await handed();
    await pc.record(d('2026-10-05'), { kind: 'recovery.set', recovery: { key: PC_KEY } });
    const back = await takenBack(phone.entries, await read(pc), d('2026-10-09'), deps);
    const history = applied(phone.entries, back);
    assert.deepEqual(back.erase, []);
    assert.ok(back.entries.every((entry) => entry.layer !== 'device' || entry.kind === 'handover.ended'));
    assert.deepEqual(deviceFacts(history).recovery, { key: KEY, day: d('2026-10-01') });
  });

  it('refuses an export without the private notes, and a copy that erases what was recorded here since', async () => {
    const { phone, pc } = await handed();
    const refused = (error: unknown) => error instanceof HandoverError && error.problem === 'not-continued';
    await assert.rejects(takenBack(phone.entries, await read(pc, false), d('2026-10-09'), deps), refused);
    const print = phone.entries.at(-1)!;
    const crafted = await bookOf([...pc.entries, await relinkedEntry(deps, pc.entries.at(-1)!, print)]);
    await crafted.erase(d('2026-10-07'), [print.id]);
    await assert.rejects(takenBack(phone.entries, await read(crafted), d('2026-10-09'), deps), refused);
  });

  it('goes back and forth: the PC hands the copy back, then takes it again', async () => {
    const { phone, pc } = await handed();
    const sent = await read(pc);
    await pc.record(d('2026-10-07'), { kind: 'handover.sent', handover: { last: pc.entries.at(-1)!.hash } });
    const first = await bookOf(applied(phone.entries, await takenBack(phone.entries, sent, d('2026-10-08'), deps)));
    await first.record(d('2026-10-09'), note('made-up-again'));
    const again = await read(first);
    await first.record(d('2026-10-10'), { kind: 'handover.sent', handover: { last: first.entries.at(-1)!.hash } });
    const back = await takenBack(pc.entries, again, d('2026-10-11'), deps);
    const history = applied(pc.entries, back);
    assert.deepEqual(await verifyHistory(deps.digest, history), []);
    assert.deepEqual(history.slice(0, pc.entries.length), pc.entries);
    const notes = buildState(history).notes;
    assert.ok(['made-up-phone', 'made-up-pc', 'made-up-again'].every((key) => notes.has(key)));
    const print = phone.entries.find((entry) => entry.kind === 'output.recorded')!;
    assert.ok(history.some((entry) => entry.id === print.id));
    assert.equal(deviceFacts(history).handedOver, null);
    const third = await bookOf(await restoredHistory(again, d('2026-10-11'), deps));
    await assert.rejects(takenBack(third.entries, sent, d('2026-10-11'), deps), HandoverError);
  });
});
