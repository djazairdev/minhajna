// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking the working copy back from the other device (#250, answers 503,
// 514 and 515): a phone sends its copy to a PC through a transfer file and
// confirms it, the PC restores it and records a note, and sends it back.
// The phone's store keeps its own entries, its key among them, even with the
// PC's own key set, and gains the PC's after them, then the end of the
// handover, all in one write: one that fails stores nothing, and trying
// again works. A copy from another history, an export, and a copy when
// nothing was handed over are refused, and nothing is stored then. Made-up
// records only.

import { archiveOf, archiveText, deviceFacts, eventOf, parseDay, type Entry } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import { restoreFile, type RestoreInput } from '../src/restore/restore-run';
import { takeBackFile } from '../src/restore/take-back-run';
import { nativeDeps, openRecordBook, toRow } from '../src/storage/history';

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const PC_KEY = ['A1B2', 'C3D4', 'E5F6', 'G7H8', 'J9K0', 'M1N2'].join('');
const DAY = parseDay('2026-10-15');
const BACK = parseDay('2026-10-20');

const textOf = (
  data: Pick<TestData, 'profile' | 'calendarRelease' | 'packs'>,
  entries: readonly Entry[],
  state: TestData['book']['state'],
) =>
  archiveText(
    archiveOf(entries, state, {
      made: DAY,
      app: '0.5.0',
      country: data.profile.code,
      calendarRelease: data.calendarRelease,
      privateNotes: true,
      bundledPacks: data.packs,
    }),
  );

const input = (route: RestoreInput['route'], country: string): RestoreInput => ({
  route,
  token: '0011223344556677',
  secret: KEY,
  country,
  day: BACK,
});

async function stored(entries: readonly Entry[]): Promise<FakeStorage> {
  const storage = FakeStorage.unlocked();
  for (const entry of entries) await storage.asSpec().appendEntry(JSON.stringify(toRow(entry)));
  return storage;
}

/** A phone that sent its copy to a PC and confirmed it, the PC, which noted a session since, and the PC's copy. */
async function handed() {
  const phone = await withPupils();
  await phone.book.record(DAY, { kind: 'recovery.set', recovery: { key: KEY } });
  const sent = textOf(phone, phone.book.entries, phone.book.state);
  await phone.book.record(DAY, { kind: 'handover.sent', handover: { last: phone.book.entries.at(-1)!.hash } });
  const pc = FakeStorage.unlocked();
  const restored = await restoreFile(input('phone', phone.profile.code), {
    files: { readZip: () => Promise.resolve(sent) },
    storage: pc.asSpec(),
    deps: nativeDeps(pc.asSpec()),
  });
  expect(restored).toEqual({ ok: true });
  const book = await openRecordBook(pc.asSpec());
  await book.record(parseDay('2026-10-16'), { kind: 'recovery.set', recovery: { key: PC_KEY } });
  await book.record(parseDay('2026-10-16'), {
    kind: 'session.noted',
    note: { sessionKey: 'made-up-pc', note: 'Made-up PC note' },
  });
  return { phone, back: textOf(phone, book.entries, book.state) };
}

function takeBack(
  text: string,
  storage: FakeStorage,
  ours: readonly Entry[],
  route: RestoreInput['route'],
  country: string,
) {
  return takeBackFile(input(route, country), {
    files: { readZip: () => Promise.resolve(text) },
    storage: storage.asSpec(),
    deps: nativeDeps(storage.asSpec()),
    ours,
  });
}

test('adds what the PC recorded after the phone’s own entries, its key kept, then ends the handover', async () => {
  const { phone, back } = await handed();
  const storage = await stored(phone.book.entries);
  await expect(takeBack(back, storage, phone.book.entries, 'phone', phone.profile.code)).resolves.toEqual({ ok: true });
  const book = await openRecordBook(storage.asSpec());
  expect(book.entries.slice(0, phone.book.entries.length)).toEqual(phone.book.entries);
  expect(book.state.notes.has('made-up-pc')).toBe(true);
  const facts = deviceFacts(book.entries);
  expect(facts.handedOver).toBeNull();
  expect(facts.recovery?.key).toBe(KEY);
  expect(eventOf(book.entries.at(-1)!)).toEqual({ kind: 'handover.ended', handover: { how: 'back' } });
});

test('stores nothing when the write fails, and takes the copy when tried again', async () => {
  const { phone, back } = await handed();
  const storage = await stored(phone.book.entries);
  const failing = takeBackFile(input('phone', phone.profile.code), {
    files: { readZip: () => Promise.resolve(back) },
    storage: { appendEntries: () => Promise.reject(new Error('Made-up full disk')) },
    deps: nativeDeps(storage.asSpec()),
    ours: phone.book.entries,
  });
  await expect(failing).resolves.toEqual({ ok: false, problem: 'failed' });
  expect(storage.rows).toHaveLength(phone.book.entries.length);
  await expect(takeBack(back, storage, phone.book.entries, 'phone', phone.profile.code)).resolves.toEqual({ ok: true });
});

test('takes the PC’s copy as a backup too, and refuses an export', async () => {
  const { phone, back } = await handed();
  const storage = await stored(phone.book.entries);
  await expect(takeBack(back, storage, phone.book.entries, 'archive', phone.profile.code)).resolves.toEqual({
    ok: false,
    problem: 'not-continued',
  });
  expect(storage.rows).toHaveLength(phone.book.entries.length);
  await expect(takeBack(back, storage, phone.book.entries, 'backup', phone.profile.code)).resolves.toEqual({
    ok: true,
  });
});

test('refuses a copy of another history, and any copy when nothing was handed over, storing nothing', async () => {
  const { phone } = await handed();
  const other = await withPupils();
  const storage = await stored(phone.book.entries);
  const foreign = textOf(other, other.book.entries, other.book.state);
  await expect(takeBack(foreign, storage, phone.book.entries, 'phone', phone.profile.code)).resolves.toEqual({
    ok: false,
    problem: 'not-continued',
  });
  const here = await stored(other.book.entries);
  await expect(takeBack(foreign, here, other.book.entries, 'phone', other.profile.code)).resolves.toEqual({
    ok: false,
    problem: 'not-handed-over',
  });
  expect(storage.rows).toHaveLength(phone.book.entries.length);
  expect(here.rows).toHaveLength(other.book.entries.length);
});
