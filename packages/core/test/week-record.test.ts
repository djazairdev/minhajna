// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A course's week as its teacher signs it (#582, #583, answers 565, 610 and
// 611): its text reads back as written, its totals as the totals read them; a
// session's state other than held, not held or awaiting, an empty span, a
// reason, a day, end or week out of range, a hidden mark, no session, sessions
// out of order or twice, more than sixty, an untidy name, a field the week does
// not have or a subject that is not a code is refused, and so is text that is
// not canonical; a correction is the week again at the next version with one
// session's state changed and its reason or none, refused when it changes
// nothing or names no session of the week, what it changed is each session
// whose state differs, added or dropped, and a reason outside the list, on
// version 0 or not text is refused; a course's ID, pinned, is its class's by
// name key and its subject's code under the school's ID; and on the channel,
// among timetable records, the joined device's weeks of the school are kept,
// each course's week once at its highest version, even when it came first, with
// the versions below it and their signatures, gaps left, the lower text winning
// a tie, while another key's week, the same device under another key, a record
// with a field more, a text changed under its signature, a course its class and
// subject do not make, a reading with another CA or before joining keep
// nothing, and a week of another world, of another school's course or that does
// not read is not sealed. Every school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  channelSealing,
  channelStream,
  channelWeeks,
  correctWeek,
  courseId,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  readWeekRecord,
  readWeekTotals,
  sealPart,
  sealWeek,
  signPart,
  signWeek,
  startKeyring,
  weekChanges,
  weekRecordText,
  type Certificate,
  type KeySigner,
  type SealedBatch,
  type WeekRecord,
} from '../src/index.ts';
import { sealRecord } from '../src/sealed-stream.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const COURSE = await courseId(SCHOOL, '4م2', 'arabic', mac);

async function certified(ca: KeySigner, world = WORLD, signer = keySigner(), subject = newId(random)) {
  const request = await certificateRequest(world, subject, signer);
  const certificate: Certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca);
  return { signer, certificate };
}

const WEEK: WeekRecord = {
  course: COURSE,
  week: parseDay('2026-12-06'),
  version: 0,
  totals: { subject: 'arabic', items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
  class: '4م2',
  subject: 'اللغة العربية',
  sessions: [
    { day: 0, start: 480, end: 540, group: '', week: 'both', state: 'held' },
    { day: 1, start: 600, end: 660, group: 'ف1', week: 'A', state: 'not-held' },
    { day: 1, start: 600, end: 660, group: 'ف2', week: 'A', state: 'held' },
    { day: 4, start: 480, end: 540, group: '', week: 'both', state: 'awaiting' },
  ],
};
const asText = (value: object) => JSON.stringify({ format: 'minhajna/week/1', ...value });

describe('a signed week’s text', () => {
  it('reads back as written, its totals as the totals read them', () => {
    const text = weekRecordText(WEEK);
    assert.deepEqual(readWeekRecord(text), WEEK);
    assert.equal(readWeekTotals(text)?.totals.subject, 'arabic');
  });

  it('refuses a session, a name, an order or a field that is not a week’s', () => {
    const [first, second] = WEEK.sessions as [WeekRecord['sessions'][0], WeekRecord['sessions'][0]];
    const broken = [
      { ...WEEK, sessions: [{ ...first, state: 'absent' }] },
      { ...WEEK, sessions: [{ ...first, start: 540, end: 540 }] },
      { ...WEEK, sessions: [{ ...first, reason: 'private' }] },
      { ...WEEK, sessions: [{ ...first, day: 7 }] },
      { ...WEEK, sessions: [{ ...first, end: 1441 }] },
      { ...WEEK, sessions: [{ ...first, week: 'C' }] },
      { ...WEEK, sessions: [{ ...first, group: 'G\u200b1' }] },
      { ...WEEK, sessions: [] },
      { ...WEEK, sessions: [first, first] },
      { ...WEEK, sessions: Array.from({ length: 61 }, (_, at) => ({ ...first, start: at, end: at + 1 })) },
      { ...WEEK, class: ' 4م2' },
      { ...WEEK, subject: '' },
      { ...WEEK, signedAt: '10:00' },
      { ...WEEK, totals: { ...WEEK.totals, subject: 'اللغة' } },
    ];
    for (const one of broken) {
      assert.equal(readWeekRecord(asText(one)), null);
      assert.throws(() => weekRecordText(one as unknown as WeekRecord), RangeError);
    }
    const unordered = { ...WEEK, sessions: [second, first] };
    assert.equal(readWeekRecord(asText(unordered)), null);
    assert.deepEqual(readWeekRecord(weekRecordText(unordered))?.sessions, [first, second]);
  });

  it('reads canonical text only', () => {
    const text = weekRecordText(WEEK);
    assert.equal(readWeekRecord(JSON.stringify(JSON.parse(text), null, 2)), null);
    assert.equal(readWeekRecord(text.replace('"version":0', '"version":0.0')), null);
    assert.equal(readWeekRecord(text.replace('"class":', '"class":"9A9","class":')), null);
    const nested = `${'['.repeat(30_000)}${']'.repeat(30_000)}`;
    const deep = text.replace(/"sessions":\[.*?\],"subject"/u, `"sessions":${nested},"subject"`);
    assert.notEqual(deep, text);
    assert.equal(readWeekRecord(deep), null);
  });
});

describe('a correction', () => {
  it('is the week again at the next version, one session changed, with its reason or none', () => {
    const [first, , , last] = WEEK.sessions as [WeekRecord['sessions'][0], unknown, unknown, WeekRecord['sessions'][0]];
    const fixed = correctWeek(WEEK, last, 'held', 'confirmed-later');
    assert.deepEqual(readWeekRecord(weekRecordText(fixed)), fixed);
    assert.deepEqual([fixed.version, fixed.reason, fixed.sessions.at(-1)?.state], [1, 'confirmed-later', 'held']);
    const slot = { day: last.day, start: last.start, end: last.end, group: last.group, week: last.week };
    assert.deepEqual(weekChanges(WEEK, fixed), [{ slot, before: 'awaiting', after: 'held' }]);
    const again = correctWeek(fixed, first, 'not-held');
    assert.deepEqual([again.version, Object.hasOwn(again, 'reason')], [2, false]);
    assert.deepEqual(readWeekRecord(weekRecordText(again)), again);
    const added = { ...WEEK, sessions: [...WEEK.sessions, { ...last, day: 3 as const }] };
    assert.deepEqual(weekChanges(WEEK, added), [{ slot: { ...slot, day: 3 }, before: null, after: 'awaiting' }]);
    const dropped = { ...WEEK, sessions: WEEK.sessions.slice(0, -1) };
    assert.deepEqual(weekChanges(WEEK, dropped), [{ slot, before: 'awaiting', after: null }]);
    assert.throws(() => correctWeek(WEEK, first, 'held'), RangeError);
    assert.throws(() => correctWeek(WEEK, { ...first, start: 1 }, 'not-held'), RangeError);
  });

  it('carries a reason of the list, on a version above 0 only', () => {
    const fixed = weekRecordText(correctWeek(WEEK, WEEK.sessions[0]!, 'not-held', 'entry-error'));
    assert.equal(readWeekRecord(fixed.replace('"entry-error"', '"lost the register"')), null);
    assert.equal(readWeekRecord(asText({ ...WEEK, reason: 'other' })), null);
    assert.equal(readWeekRecord(fixed.replace('"entry-error"', '1')), null);
    const none = readWeekRecord(fixed.replace('"reason":"entry-error",', ''));
    assert.deepEqual([none?.version, none === null || Object.hasOwn(none, 'reason')], [1, false]);
  });
});

describe('a course’s ID', () => {
  it('is its class’s by name key and its subject’s code, under the school’s ID', async () => {
    assert.equal(COURSE, 'ec85e361168aeebe7199c41de333db1c');
    assert.equal(await courseId(SCHOOL, ' ٤م٢ ', 'arabic', mac), COURSE);
    assert.notEqual(await courseId(SCHOOL, '4م2', 'math', mac), COURSE);
    assert.notEqual(await courseId('S'.repeat(22), '4م2', 'arabic', mac), COURSE);
    assert.notEqual(await courseId(SCHOOL, '4م1', 'arabic', mac), COURSE);
  });
});

describe('a signed week on the teacher’s channel', () => {
  it('keeps the joined device’s weeks of the school, each course’s week once at its highest version', async () => {
    const director = await device();
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
    const ca = keySigner();
    const [teacher, stranger, elsewhere] = [await certified(ca), await certified(ca), await certified(ca, 'Q2WZ8')];
    const again = await certified(ca, WORLD, keySigner(), teacher.certificate.subject);
    const joined = { device: teacher.certificate.subject, certificate: teacher.certificate };
    const batches: SealedBatch[] = [];
    const place = { stream: await channelStream(code, mac), sealing: await channelSealing(code, mac) };
    const raw = async (value: object) => batches.push(...(await sealRecord(place, value, batches.length, 8, cipher)));
    const put = async (week: WeekRecord, by = teacher) => {
      const signed = await signWeek(weekRecordText(week), by.certificate, by.signer);
      batches.push(...(await sealWeek(code, signed, batches.length, cipher, mac)).batches);
      return signed;
    };
    const tie = [
      { ...WEEK, version: 1 },
      { ...WEEK, version: 1, sessions: WEEK.sessions.slice(1) },
    ];
    const [lower, higher] = tie.map(weekRecordText).sort() as [string, string];
    await put({ ...WEEK, version: 3 });
    await put({ ...WEEK, week: parseDay('2026-12-13') });
    await put(readWeekRecord(higher)!);
    const named = { schoolName: 'متوسطة المختلقة', teacher: 'مختلق', sessions: [], bells: [] };
    const part = { world: WORLD, school: SCHOOL, assignment: code.assignment, issue: code.issue, ...named };
    const signedPart = await signPart(
      { ...part, version: 1, from: WEEK.week, once: false },
      teacher.certificate,
      teacher.signer,
    );
    batches.push(...(await sealPart(code, signedPart, batches.length, cipher, mac)).batches);
    const signed = await put(readWeekRecord(lower)!);
    await put(WEEK);
    await put({ ...WEEK, version: 5 }, stranger);
    await raw({ format: 'minhajna/signed-week-record/1', ...signed, extra: 1 });
    await raw({ format: 'minhajna/signed-week-record/1', ...signed, text: weekRecordText({ ...WEEK, version: 9 }) });
    const course = await courseId(SCHOOL, '4م9', 'arabic', mac);
    const wrong = await signWeek(weekRecordText({ ...WEEK, course, version: 7 }), teacher.certificate, teacher.signer);
    await assert.rejects(sealWeek(code, wrong, batches.length, cipher, mac), RangeError);
    await raw({ format: 'minhajna/signed-week-record/1', ...wrong });
    await put({ ...WEEK, version: 6 }, again);
    const foreign = await signWeek(weekRecordText(WEEK), elsewhere.certificate, elsewhere.signer);
    await assert.rejects(sealWeek(code, foreign, batches.length, cipher, mac), RangeError);
    const unread = await signWeek('{"format":"minhajna/week/1"}', teacher.certificate, teacher.signer);
    await assert.rejects(sealWeek(code, unread, batches.length, cipher, mac), RangeError);
    const read = await channelWeeks(code, batches, { key: ca.publicKey, checker: ca }, joined, cipher, mac);
    assert.deepEqual(
      read.map((one) => [one.week.week, one.week.version, one.signed.text === lower, one.earlier.map((v) => v.week)]),
      [
        [parseDay('2026-12-06'), 3, false, [WEEK, readWeekRecord(lower)]],
        [parseDay('2026-12-13'), 0, false, []],
      ],
    );
    assert.equal(read[0]?.earlier[0]?.signed.text, weekRecordText(WEEK));
    assert.deepEqual(await channelWeeks(code, batches, { key: ca.publicKey, checker: ca }, null, cipher, mac), []);
    const otherCa = keySigner();
    const elsewhereCa = { key: otherCa.publicKey, checker: otherCa };
    assert.deepEqual(await channelWeeks(code, batches, elsewhereCa, joined, cipher, mac), []);
  });
});
