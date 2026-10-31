// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a new version of the timetable changes for a teacher, and which part
// applies on a day (#578, answer 606): two sessions that swap their hours are
// each moved, a room change is said as one, a session only in the new version
// is added and one only in the old removed, two sessions of the same class and
// subject that move pair in order, a move that also changes room is one move,
// two removals with one addition are a move and a removal, and the same
// sessions change nothing; on a day a one-day part for it applies whatever
// standing version came after, and otherwise the latest standing part in force,
// not before its first day; and on a channel the standing part read back is the
// latest not for one day, while every part is listed. Every school, teacher and
// key is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  channelParts,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  partChanges,
  partOn,
  partSessions,
  readPart,
  sealPart,
  signPart,
  startKeyring,
  type ImportedSession,
  type SignedPart,
  type TimetablePart,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';

const session = (klass: string, subject: string, day: 0 | 1 | 2 | 3 | 4, start: number, room = 'ق1') =>
  ({
    row: 2,
    class: klass,
    group: '',
    subject,
    teacher: 'بلعيد محمد',
    room,
    day,
    start,
    end: start + 60,
    week: 'both',
  }) as ImportedSession;

const made = (sessions: readonly ImportedSession[]) => partSessions(SCHOOL, sessions, mac);
const kinds = (changes: ReturnType<typeof partChanges>) =>
  changes.map((one) => [
    one.kind,
    one.before && `${one.before.day} ${one.before.start}`,
    one.after && `${one.after.day} ${one.after.start}`,
  ]);

describe('what a version changes', () => {
  it('says each move, a room change, an addition and a removal, in the order they end in or left', async () => {
    const before = await made([
      session('4م2', 'العربية', 1, 600),
      session('4م2', 'الرياضيات', 1, 540),
      session('4م3', 'العربية', 4, 600),
      session('4م1', 'الفرنسية', 2, 480),
    ]);
    const after = await made([
      session('4م2', 'العربية', 1, 540),
      session('4م2', 'الرياضيات', 1, 600),
      session('4م3', 'العربية', 4, 600, 'ق7'),
      session('4م4', 'العربية', 3, 480),
    ]);
    assert.deepEqual(kinds(partChanges(before, after)), [
      ['moved', '1 600', '1 540'],
      ['moved', '1 540', '1 600'],
      ['removed', '2 480', null],
      ['added', null, '3 480'],
      ['room', '4 600', '4 600'],
    ]);
    const room = partChanges(before, after).find((one) => one.kind === 'room')!;
    assert.deepEqual([room.before?.room, room.after?.room], ['ق1', 'ق7']);
    assert.deepEqual(partChanges(after, after), []);
    assert.deepEqual(partChanges([], []), []);
  });

  it('pairs two moves of the same class and subject in order, and keeps a room that only changed case', async () => {
    const before = await made([session('4م2', 'math', 0, 480), session('4م2', 'math', 2, 480, 'Q1')]);
    const after = await made([session('4م2', 'math', 1, 480), session('4م2', 'math', 3, 480, 'q1')]);
    assert.deepEqual(kinds(partChanges(before, after)), [
      ['moved', '0 480', '1 480'],
      ['moved', '2 480', '3 480'],
    ]);
    const roomed = await made([session('4م2', 'math', 1, 480, 'Q9')]);
    const [move] = partChanges(before.slice(0, 1), roomed);
    assert.deepEqual([move?.kind, move?.before?.room, move?.after?.room], ['moved', 'ق1', 'Q9']);
    assert.deepEqual(kinds(partChanges(before, roomed)), [
      ['moved', '0 480', '1 480'],
      ['removed', '2 480', null],
    ]);
    const same = await made([session('4م2', 'math', 2, 480, ' q1 ')]);
    assert.deepEqual(partChanges(before.slice(1), same), []);
  });
});

describe('the part that applies on a day', () => {
  const at = (version: number, from: string, once = false) =>
    ({ part: { version, from: parseDay(from), once } }) as unknown as SignedPart;
  const on = (parts: readonly SignedPart[], day: string) => partOn(parts, parseDay(day))?.part.version ?? null;

  it('takes a one-day part on its day, whatever came after, and otherwise the latest standing part in force', () => {
    const parts = [at(1, '2026-12-06'), at(2, '2026-12-10', true), at(3, '2026-12-13')];
    assert.equal(on(parts, '2026-12-05'), null);
    assert.equal(on(parts, '2026-12-06'), 1);
    assert.equal(on(parts, '2026-12-10'), 2);
    assert.equal(on(parts, '2026-12-11'), 1);
    assert.equal(on(parts, '2026-12-13'), 3);
    const later = [...parts, at(4, '2026-12-06')];
    assert.equal(on(later, '2026-12-10'), 2);
    assert.equal(on(later, '2026-12-11'), 4);
    assert.equal(on([...later, at(5, '2026-12-10', true)], '2026-12-10'), 5);
    assert.equal(on([], '2026-12-10'), null);
  });

  it('reads back the latest standing part from a channel, and lists the one-day part with the others', async () => {
    const director = await device();
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
    const ca = keySigner();
    const signer = keySigner();
    const request = await certificateRequest(WORLD, newId(random), signer);
    const certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca);
    const sessions = await made([session('4م2', 'math', 0, 480)]);
    const part = (version: number, once: boolean): TimetablePart => ({
      world: WORLD,
      school: SCHOOL,
      schoolName: 'متوسطة المختلقة',
      assignment: code.assignment,
      issue: code.issue,
      teacher: 'بلعيد محمد',
      version,
      from: parseDay('2026-12-06'),
      once,
      sessions,
      bells: [],
    });
    const batches = [];
    for (const [version, once] of [
      [1, false],
      [2, true],
    ] as const) {
      const signed = await signPart(part(version, once), certificate, signer);
      batches.push(...(await sealPart(code, signed, batches.length, cipher, mac)).batches);
    }
    const checker = { key: ca.publicKey, checker: ca };
    assert.equal((await readPart(code, batches, checker, null, cipher, mac))?.part.version, 1);
    const all = await channelParts(code, batches, checker, null, cipher, mac);
    assert.deepEqual(
      all.map((one) => [one.part.version, one.part.once]),
      [
        [1, false],
        [2, true],
      ],
    );
  });
});
