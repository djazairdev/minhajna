// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each teacher's part of the timetable (#577, answer 605): the timetable's
// teachers under the first spelling of their names; a session's ID the same for
// the same session in the same school whatever its room, its names in Arabic or
// Latin letters, and another for another time, class or school; a part's
// sessions in an order that compares names as the timetable does, once each,
// their names without format marks, even inside a name, which still read back;
// a part signed by the director's device and sealed on its teacher's channel
// after the joined record, read back as the latest that checks, while a part
// the joined device signed, one certified by another CA, one whose text was
// changed or is not canonical, one for another issue, one whose IDs are not its
// sessions', an older part its key signed sent again, and a batch that does not
// open, are left out; a part another key certified by the demo's CA signed
// holds until the director's next sending, as the demo allows; and a part that
// is not shaped as one, holds hidden characters, is too long for its channel
// once escaped, is signed with another certificate, or is sent on another
// code's channel, is refused, while the longest accepted still seals. Every
// world, school, teacher and key is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalJson,
  certificateRequest,
  channelParts,
  channelSealing,
  channelStream,
  isTimetablePart,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  partSessions,
  readPart,
  PART_BATCHES,
  sealJoined,
  sealPart,
  sessionId,
  signPart,
  startKeyring,
  teachersOf,
  TIMETABLE_PART_FORMAT,
  type Certificate,
  type JoinCode,
  type ImportedSession,
  type KeySigner,
  type SealedBatch,
  type SignedPart,
  type TimetablePart,
} from '../src/index.ts';
import { sealRecord } from '../src/sealed-stream.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const DAY = parseDay('2026-12-01');

const session = (teacher: string, day: 0 | 1 | 2 | 3 | 4, start: number, room = 'Q1'): ImportedSession => ({
  row: 2,
  class: '1م2',
  group: '',
  subject: 'رياضيات',
  teacher,
  room,
  day,
  start,
  end: start + 60,
  week: 'both',
});

async function certified(
  ca: KeySigner,
  subject = newId(random),
): Promise<{ signer: KeySigner; certificate: Certificate }> {
  const signer = keySigner();
  const request = await certificateRequest(WORLD, subject, signer);
  return { signer, certificate: await issueCertificate(request, DAY, newId(random), ca) };
}

const placeOf = async (code: JoinCode) => ({
  stream: await channelStream(code, mac),
  sealing: await channelSealing(code, mac),
});

/** The text a part's signature covers, as the core writes it. */
function signedText(certificate: Certificate, text: string): string {
  const { world, subject, publicKey, serial } = certificate;
  return `${TIMETABLE_PART_FORMAT}\n${world}\n${subject}\n${publicKey}\n${serial}\n${text}`;
}

async function setting() {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const assignment = newId(random);
  const code = await makeJoinCode(opened, WORLD, assignment, 1, director.crypto);
  const other = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const ca = keySigner();
  const sessions = await partSessions(
    SCHOOL,
    [{ ...session('بلعيد محمد', 1, 480), class: '1م\u200f2' }, session('بلعيد محمد', 0, 600)],
    mac,
  );
  const part = (version: number, of = code): TimetablePart => ({
    world: WORLD,
    school: SCHOOL,
    schoolName: 'متوسطة المختلقة',
    assignment: of.assignment,
    issue: of.issue,
    teacher: 'بلعيد محمد',
    version,
    from: parseDay('2026-12-06'),
    once: false,
    sessions,
    bells: [
      [480, 540],
      [540, 600],
    ],
  });
  return { code, other, ca, part, sessions };
}

describe('each teacher’s part of the timetable', () => {
  it('groups the teachers and gives each session an ID that stays while the session does', async () => {
    const teachers = teachersOf([
      session('بلعيد محمد', 0, 480),
      session(' بلعيد  محمد ', 1, 480),
      session('صالحي زهية', 0, 540),
    ]);
    assert.deepEqual([...teachers.keys()], ['بلعيد محمد', 'صالحي زهية']);
    assert.equal(teachers.get('بلعيد محمد')!.length, 2);
    const one = session('a', 0, 480);
    const id = await sessionId(SCHOOL, one, mac);
    assert.match(id, /^[0-9a-f]{32}$/u);
    assert.equal(await sessionId(SCHOOL, { ...one, room: 'Q9', teacher: 'b', row: 9 }, mac), id);
    assert.equal(await sessionId(SCHOOL, { ...one, class: ' 1م2 ' }, mac), id);
    const latin = { ...one, class: '1AM2' };
    assert.equal(await sessionId(SCHOOL, { ...latin, class: ' 1am2 ' }, mac), await sessionId(SCHOOL, latin, mac));
    for (const changed of [
      { start: 540 },
      { day: 1 as const },
      { class: '1م3' },
      { group: 'G1' },
      { week: 'A' as const },
    ])
      assert.notEqual(await sessionId(SCHOOL, { ...one, ...changed }, mac), id);
    assert.notEqual(await sessionId('another-made-up-school-space', one, mac), id);
    const sorted = await partSessions(
      SCHOOL,
      [session('a', 2, 480), session('a', 0, 540), session('a', 0, 480), session('a', 0, 480, 'Q2')],
      mac,
    );
    assert.deepEqual(
      sorted.map((made) => `${made.day} ${made.start}`),
      ['0 480', '0 540', '2 480'],
    );
  });

  it('cleans the names it carries and orders the sessions the same way everywhere', async () => {
    const marked = { ...session('a', 0, 480), class: '1م\u200b2', subject: ' رياضيات\u2028 ' };
    const [made] = await partSessions(SCHOOL, [marked], mac);
    assert.deepEqual([made!.class, made!.subject], ['1م2', 'رياضيات']);
    assert.equal(made!.id, await sessionId(SCHOOL, session('a', 0, 480), mac));
    const groups = await partSessions(
      SCHOOL,
      [
        { ...session('a', 0, 480), group: 'G2' },
        { ...session('a', 0, 480), group: 'G1' },
      ],
      mac,
    );
    assert.equal(groups.map((one) => one.group).join(), 'G1,G2');
  });

  it('reads back the latest part that checks, and leaves the rest out', async () => {
    const { code, ca, part } = await setting();
    const director = await certified(ca);
    const teacher = await certified(ca);
    const stranger = await certified(keySigner());
    const joined = await sealJoined(
      code,
      { device: teacher.certificate.subject, certificate: teacher.certificate },
      cipher,
      mac,
      0,
    );
    const batches: SealedBatch[] = [...joined.batches];
    const next = () => batches.length;
    const put = async (one: SignedPart) => batches.push(...(await sealPart(code, one, next(), cipher, mac)).batches);
    const raw = async (value: unknown) =>
      batches.push(...(await sealRecord(await placeOf(code), value, next(), PART_BATCHES, cipher)));
    const read = () =>
      readPart(code, batches, { key: ca.publicKey, checker: ca }, teacher.certificate.subject, cipher, mac);
    await put(await signPart(part(1), director.certificate, director.signer));
    const signedBy = async (text: string) => ({
      format: TIMETABLE_PART_FORMAT,
      text,
      signature: await director.signer.sign(signedText(director.certificate, text)),
      certificate: director.certificate,
    });
    await raw(await signedBy(canonicalJson(part(2))));
    await put(await signPart(part(9), teacher.certificate, teacher.signer));
    await put(await signPart(part(9), stranger.certificate, stranger.signer));
    const changed = await signPart(part(8), director.certificate, director.signer);
    const edited = changed.text.replace('"version":8', '"version":7');
    assert.notEqual(edited, changed.text);
    await put({ ...changed, text: edited });
    const { version, ...rest } = part(6);
    const reordered = JSON.stringify({ version, ...rest });
    assert.notEqual(reordered, canonicalJson(part(6)));
    await raw(await signedBy(reordered));
    await raw(await signedBy(canonicalJson({ ...part(5), issue: 2 })));
    const swapped = part(4);
    const wrongIds = {
      ...swapped,
      sessions: swapped.sessions.map((one, at, all) => ({ ...one, id: all[1 - at]!.id })),
    };
    await raw(await signedBy(canonicalJson(wrongIds)));
    batches.push({ number: next(), bytes: random(4096 + 28) });
    assert.deepEqual((await read())?.part, part(2));
    assert.equal((await read())?.certificate.subject, director.certificate.subject);
    const second = await certified(ca);
    await put(await signPart({ ...part(3), teacher: 'مختلق آخر' }, second.certificate, second.signer));
    assert.equal((await read())?.part.teacher, 'مختلق آخر');
    const latest = await signPart(part(4), director.certificate, director.signer);
    await put(latest);
    assert.deepEqual((await read())?.part, part(4));
    await put(await signPart(part(1), director.certificate, director.signer));
    await put(latest);
    await raw(await signedBy(canonicalJson(part(2))));
    assert.deepEqual((await read())?.part, part(4));
    const all = await channelParts(
      code,
      batches,
      { key: ca.publicKey, checker: ca },
      teacher.certificate.subject,
      cipher,
      mac,
    );
    assert.deepEqual(
      all.map((one) => one.part.version),
      [1, 2, 3, 4],
    );
    assert.equal(await readPart(code, [], { key: ca.publicKey, checker: ca }, null, cipher, mac), null);
    for (const batch of batches) assert.equal(batch.bytes.length, batches[0]!.bytes.length);
  });

  it('refuses a part that is not one, another key’s certificate, and another code’s channel', async () => {
    const { code, other, ca, part, sessions } = await setting();
    const director = await certified(ca);
    assert.equal(isTimetablePart(part(1)), true);
    const long = 'م'.repeat(80);
    const many = Array.from({ length: 121 }, (_, at) => ({ ...sessions[0]!, id: at.toString(16).padStart(32, '0') }));
    const big = many.slice(0, 120).map((one) => ({ ...one, class: long, subject: long, room: long, group: long }));
    for (const wrong of [
      { ...part(1), extra: 1 },
      { ...part(1), version: 0 },
      { ...part(1), school: 'short' },
      { ...part(1), from: '2026-13-01' },
      { ...part(1), teacher: ' ' },
      { ...part(1), teacher: 'بلعيد\u202e محمد' },
      { ...part(1), schoolName: 'مختلقة\ud800' },
      { ...part(1), sessions: [sessions[0], sessions[0]] },
      { ...part(1), sessions: [{ ...sessions[0], start: 600, end: 540 }] },
      { ...part(1), sessions: [{ ...sessions[0], week: 'C' }] },
      { ...part(1), sessions: many },
      { ...part(1), sessions: big },
      { ...part(1), bells: [[480]] },
      { ...part(1), bells: [[540, 480]] },
      null,
    ])
      assert.equal(isTimetablePart(wrong), false);
    await assert.rejects(
      signPart({ ...part(1), sessions: big }, director.certificate, director.signer),
      /Not a teacher/u,
    );
    const quoted = '"\\'.repeat(40);
    const fitting = (count: number) => ({
      ...part(1),
      sessions: many.slice(0, count).map((one) => ({ ...one, class: quoted, subject: quoted, room: quoted })),
    });
    let most = 0;
    while (isTimetablePart(fitting(most + 1))) most += 1;
    assert.ok(most > 10 && most < 120);
    const full = await signPart(fitting(most), director.certificate, director.signer);
    assert.ok((await sealPart(code, full, 0, cipher, mac)).batches.length <= PART_BATCHES);
    await assert.rejects(signPart(part(1), director.certificate, keySigner()), /another key/u);
    await assert.rejects(
      signPart({ ...part(1), world: 'ZZZZZ' }, director.certificate, director.signer),
      /another world/u,
    );
    const signed = await signPart(part(1), director.certificate, director.signer);
    await assert.rejects(sealPart(other, signed, 0, cipher, mac), /own code/u);
    await assert.rejects(sealPart(code, signed, -1, cipher, mac), /numbered from 0/u);
  });
});
