// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's records in a demo world's store (#570, answer 596): the school key
// this device holds, the latest that reads, in the device layer only; each
// assignment's current code or security key, the highest issue, even when a
// lower one is recorded later, and the first that reads of each; the teachers
// by subject then name, by phone or by key, with no code yet, waiting seven
// days, expired, or joined; a new issue and a new key number, each as likely,
// never one given out before, a lost key's included, and an error once all
// ten thousand are given; the space a director's device draws, each teacher's
// assignment worked out from it (answer 597), and the latest key held of any
// school. Every school, device and teacher is made up.

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  archiveOf,
  archiveText,
  assignmentId,
  CODE_DAYS,
  issueCounts,
  issueRows,
  joinedKey,
  keptHeld,
  keptIssues,
  keyNumbers,
  latestHeld,
  layerOf,
  mayTravelAs,
  newId,
  newKeyNumber,
  newSchoolSpace,
  nextIssue,
  readSchoolHeld,
  readSchoolIssued,
  recordKey,
  ROUTES,
  startKeyring,
  type ArchiveOptions,
  type DemoTeacher,
  type SchoolHeld,
  type SchoolIssued,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { device, random, SCHOOL } from './school-devices.ts';

const PKCS8 = 'TWFkZS11cCBwcml2YXRlIGhhbGYgb2YgYW4gYWdyZWVtZW50IGtleQ==';
const options: ArchiveOptions = {
  made: d('2026-10-24'),
  app: '0.7.0',
  country: 'dz',
  calendarRelease: '2026.1',
  privateNotes: true,
  bundledPacks: [],
};

async function held(school = SCHOOL): Promise<SchoolHeld> {
  const director = await device();
  const opened = await startKeyring(school, director.holder, director.crypto, random);
  return {
    school,
    device: director.holder.id,
    publicKey: director.holder.publicKey,
    pkcs8: PKCS8,
    ring: opened.ring,
  };
}

const issued = (assignment: string, issue: number, keyNumber: string | null = null): SchoolIssued => ({
  school: SCHOOL,
  assignment,
  issue,
  epoch: 0,
  access: keyNumber === null ? 'phone' : 'key',
  keyNumber,
});

let seeded = 0;
const teacher = (subject: string, name: string): DemoTeacher => ({
  id: `teacher-${(seeded += 1)}`,
  subject,
  classIds: [],
  name,
  latinName: name,
  sex: 'f',
});

describe('the school key a director’s device holds', () => {
  it('keeps the latest that reads for the school, in the device layer only', async () => {
    const book = await openBook(cemEvents());
    const [first, second] = [await held(), await held()];
    assert.equal(layerOf({ kind: 'school.held', held: first }), 'device');
    for (const kind of ['school.held', 'school.issued'] as const) {
      assert.deepEqual(
        ROUTES.filter((route) => mayTravelAs('device', kind, route)),
        [],
      );
    }
    assert.equal(recordKey({ kind: 'school.held', held: first }), `school-held:${SCHOOL}`);
    assert.equal(keptHeld(book.entries, SCHOOL, 32), null);
    await book.record(d('2026-10-20'), { kind: 'school.held', held: first });
    await book.record(d('2026-10-21'), { kind: 'school.held', held: second });
    await book.record(d('2026-10-22'), { kind: 'school.held', held: { ...second, pkcs8: 'not base64!' } });
    assert.deepEqual(keptHeld(book.entries, SCHOOL, 32), second);
    assert.equal(keptHeld(book.entries, 'another-made-up-school', 32), null);
    const archive = archiveText(archiveOf(book.entries, book.state, options));
    for (const secret of [PKCS8, first.device, first.ring.school]) assert.equal(archive.includes(secret), false);
  });

  it('reads only a keyring that names this device by its key, for the same school', async () => {
    const one = await held();
    assert.deepEqual(readSchoolHeld(one, 32), one);
    const other = await held();
    for (const changed of [
      null,
      [one],
      { ...one, extra: 1 },
      { ...one, school: 'short' },
      { ...one, device: other.device },
      { ...one, publicKey: other.publicKey },
      { ...one, publicKey: one.publicKey.toUpperCase() },
      { ...one, pkcs8: 'A'.repeat(500) },
      { ...one, ring: { ...one.ring, school: 'another-made-up-school' } },
      { ...one, ring: other.ring },
    ]) {
      assert.equal(readSchoolHeld(changed, 32), null, JSON.stringify(changed));
    }
    assert.equal(readSchoolHeld(one, 65), null);
  });
});

describe('the codes and keys a director’s device issues', () => {
  it('keeps each assignment’s highest issue, the first that reads of each, with its day', async () => {
    const book = await openBook(cemEvents());
    const [a, b] = [newId(random), newId(random)];
    const event = { kind: 'school.issued', issued: issued(a, 1) } as const;
    assert.equal(layerOf(event), 'device');
    assert.equal(recordKey(event), `school-issued:${SCHOOL}/${a}/1`);
    await book.record(d('2026-10-20'), event);
    await book.record(d('2026-10-21'), { kind: 'school.issued', issued: issued(a, 2) });
    await book.record(d('2026-10-22'), { kind: 'school.issued', issued: issued(a, 2, '0042') });
    await book.record(d('2026-10-22'), { kind: 'school.issued', issued: issued(b, 1, '7310') });
    await book.record(d('2026-10-23'), {
      kind: 'school.issued',
      issued: { ...issued(b, 3), school: 'another-made-up-school' },
    });
    const kept = keptIssues(book.entries, SCHOOL);
    assert.deepEqual(kept.get(a), { ...issued(a, 2), day: d('2026-10-21') });
    assert.deepEqual(kept.get(b), { ...issued(b, 1, '7310'), day: d('2026-10-22') });
    assert.equal(nextIssue(kept, a), 3);
    assert.equal(nextIssue(kept, newId(random)), 1);
    await book.record(d('2026-10-24'), { kind: 'school.issued', issued: issued(a, 4) });
    await book.record(d('2026-10-25'), { kind: 'school.issued', issued: issued(a, 3) });
    await book.record(d('2026-10-25'), { kind: 'school.issued', issued: issued(b, 2, '0100') });
    const later = keptIssues(book.entries, SCHOOL);
    assert.deepEqual(later.get(a), { ...issued(a, 4), day: d('2026-10-24') });
    assert.deepEqual(later.get(b), { ...issued(b, 2, '0100'), day: d('2026-10-25') });
    assert.deepEqual([...keyNumbers(book.entries, SCHOOL)].sort(), ['0100', '7310']);
    const draws = [
      [0x1c, 0x8e],
      [0x00, 0x2a],
    ];
    assert.equal(
      newKeyNumber(() => new Uint8Array(draws.shift()!), keyNumbers(book.entries, SCHOOL)),
      '0042',
    );
    const archive = archiveText(archiveOf(book.entries, book.state, options));
    for (const secret of [a, b]) assert.equal(archive.includes(secret), false);
  });

  it('reads only a code without a key or a key with four digits', () => {
    const one = issued(newId(random), 1);
    assert.deepEqual(readSchoolIssued(one), one);
    assert.deepEqual(readSchoolIssued(issued(one.assignment, 2, '0001')), issued(one.assignment, 2, '0001'));
    for (const changed of [
      null,
      { ...one, extra: 1 },
      { ...one, assignment: 'not an id' },
      { ...one, issue: 0 },
      { ...one, issue: 1.5 },
      { ...one, epoch: -1 },
      { ...one, epoch: 1_000_000_000 },
      { ...one, keyNumber: '0001' },
      { ...one, access: 'key' },
      { ...one, access: 'key', keyNumber: '12345' },
      { ...one, access: 'key', keyNumber: 42 },
      { ...one, access: 'paper', keyNumber: null },
    ]) {
      assert.equal(readSchoolIssued(changed), null, JSON.stringify(changed));
    }
  });

  it('gives a new key a number none was given, each as likely, and says when none is left', () => {
    const draws = [
      [0x00, 0x2a],
      [0x27, 0x10],
      [0xea, 0x60],
      [0xff, 0xff],
      [0xea, 0x5f],
    ];
    const from = () => new Uint8Array(draws.shift() ?? [0, 1]);
    assert.equal(newKeyNumber(from, new Set()), '0042');
    assert.equal(newKeyNumber(from, new Set()), '0000');
    assert.equal(newKeyNumber(from, new Set()), '9999');
    const again = [
      [0x00, 0x2a],
      [0x00, 0x07],
    ];
    assert.equal(
      newKeyNumber(() => new Uint8Array(again.shift()!), new Set(['0042'])),
      '0007',
    );
    const every = new Set(Array.from({ length: 10_000 }, (_, at) => String(at).padStart(4, '0')));
    assert.throws(() => newKeyNumber(from, every), RangeError);
  });
});

describe('D-Issue’s rows', () => {
  it('lists the teachers by subject then name, by phone or key, and where each code stands', () => {
    const [samia, amel, karim, nadia] = [
      teacher('math', 'Samia'),
      teacher('arabic', 'Amel'),
      teacher('math', 'Karim'),
      teacher('arabic', 'Nadia'),
    ];
    const assignments = new Map([samia, amel, karim].map((one) => [one.id, newId(random)]));
    assignments.set(nadia.id, newId(random));
    const of = (one: DemoTeacher) => assignments.get(one.id)!;
    const issues = new Map([
      [of(karim), { ...issued(of(karim), 1), day: d('2026-10-20') }],
      [of(samia), { ...issued(of(samia), 2), day: d('2026-10-10') }],
      [of(nadia), { ...issued(of(nadia), 1, '0042'), day: d('2026-10-01') }],
      [samia.id, { ...issued(newId(random), 1, '0001'), day: d('2026-10-01') }],
    ]);
    const joined = new Map([[joinedKey(of(samia), 2), d('2026-10-12')]]);
    const name = {
      subject: (code: string) => code,
      person: (one: DemoTeacher) => one.name,
      compare: new Intl.Collator('en').compare,
    };
    const rows = issueRows([samia, amel, karim, nadia], assignments, issues, joined, d('2026-10-27'), name);
    assert.deepEqual(
      rows.map((row) => row.assignment),
      [amel, nadia, karim, samia].map(of),
    );
    assert.deepEqual(
      rows.map((row) => [row.teacher.name, row.access, row.keyNumber, row.status]),
      [
        ['Amel', 'phone', null, { kind: 'none' }],
        ['Nadia', 'key', '0042', { kind: 'waiting', until: null }],
        ['Karim', 'phone', null, { kind: 'waiting', until: d('2026-10-27') }],
        ['Samia', 'phone', null, { kind: 'joined', on: d('2026-10-12') }],
      ],
    );
    assert.equal(CODE_DAYS, 7);
    const later = issueRows([karim], assignments, issues, joined, d('2026-10-28'), name);
    assert.deepEqual(later[0]?.status, { kind: 'expired', until: d('2026-10-27') });
    assert.deepEqual(issueCounts(rows), { all: 4, phone: 3, key: 1 });
    const unknown = issueRows([teacher('math', 'Lina')], assignments, issues, joined, d('2026-10-27'), name);
    assert.deepEqual(unknown[0]?.assignment, null);
    assert.deepEqual(unknown[0]?.status, { kind: 'none' });
  });
});

describe('the space and assignments a director’s device names', () => {
  const mac = (key: Uint8Array, data: Uint8Array) =>
    Promise.resolve(new Uint8Array(createHmac('sha256', key).update(data).digest()));

  it('draws a space ID the relay takes, and works out each teacher’s assignment from it', async () => {
    const space = newSchoolSpace(() => new Uint8Array(16).fill(0xfb));
    assert.equal(space, '-_v7-_v7-_v7-_v7-_v7-w');
    assert.match(newSchoolSpace(random), /^[A-Za-z0-9_-]{22}$/u);
    const one = await assignmentId(SCHOOL, 'teacher-1', mac);
    const expected = createHmac('sha256', SCHOOL).update('minhajna/demo/assignment\nteacher-1').digest('hex');
    assert.equal(one, expected.slice(0, 32));
    assert.equal(await assignmentId(SCHOOL, 'teacher-1', mac), one);
    assert.notEqual(await assignmentId(SCHOOL, 'teacher-2', mac), one);
    assert.notEqual(await assignmentId(space, 'teacher-1', mac), one);
  });

  it('finds the latest key held, of whichever school', async () => {
    const book = await openBook(cemEvents());
    assert.equal(latestHeld(book.entries, 32), null);
    const first = await held();
    const other = await held('another-made-up-school');
    await book.record(d('2026-10-20'), { kind: 'school.held', held: first });
    assert.deepEqual(latestHeld(book.entries, 32), first);
    await book.record(d('2026-10-21'), { kind: 'school.held', held: other });
    assert.deepEqual(latestHeld(book.entries, 32), other);
    assert.deepEqual(keptHeld(book.entries, SCHOOL, 32), first);
    await book.record(d('2026-10-22'), { kind: 'school.held', held: { ...first, ring: other.ring } });
    assert.deepEqual(latestHeld(book.entries, 32), other);
  });
});
