// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A term's marks sent to the state's stand-in (#591, answer 619), against the
// jest server's stand-in on the server's own code: the term holding the date,
// the last ended between terms, none before; the courses of the timetable in
// force, or of the latest sent before it is, once each, a subject the country
// does not know kept with no code; a course's marks for the world's school's
// class by name key, on the level's scale and formula, or none without a list
// or a code; sending, answered with a receipt on the world's date naming no
// pupil, the same export again with the same receipt as came before, a later
// day's as a new one, the receipts read back newest first and the course's
// found; a mismatch or a missing part refused before anything is sent; and a
// refusal by the stand-in, for a day after the world's or once it is full, said
// as E_STATE_REFUSED. Every pupil, mark, school and world here is made up.

import { directorSchool, parseDay, seedNationalWorld, type DemoSchool, type SchoolJoined } from '@minhajna/core';
import { MINE, SUBJECTS, TEACHER } from '../jest/term-weeks';
import { BELLS, school as staff, sendParts, server, session, setting } from '../jest/timetable-send';
import { codeOf, nodeKit as kit } from '../jest/world-server';
import { appreciationList } from '../src/marks/appreciation-rules';
import { assessmentData } from '../src/marks/marks-rules';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { standInReceipts, toBase64 } from '../src/school/state-standin';
import {
  courseReceipt,
  sendingTerm,
  sendTermMarks,
  termComplete,
  termCourses,
  termMatches,
  termSheet,
} from '../src/school/term-send-session';
import { readSignChannel } from '../src/week/week-sign-session';

const result = readReference(bundledReference);
if (!result.ok) throw new Error('The bundled reference does not read');
const read = result;
const data = { assessment: assessmentData(read.profile)!, list: appreciationList(read.profile)! };
const TERM2 = parseDay('2027-01-12');

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

/** A world on a day, its school, and a timetable naming two of its classes, a class it lacks and an unknown subject. */
async function termWorld(date = TERM2) {
  const { id, here, joined } = await setting();
  const { zones = [], workingDays } = read.profile;
  const school: DemoSchool = directorSchool(seedNationalWorld(id, zones, workingDays, read.packs))!;
  const [first, second] = school.classes;
  const sessions = [
    session(TEACHER, 0, 480, first.name),
    session(TEACHER, 1, 480, first.name),
    session(TEACHER, 0, 540, second.name),
    session(TEACHER, 1, 540, '9AM9'),
    { ...session(TEACHER, 2, 480, first.name), subject: 'مادة مختلقة' },
  ];
  await sendParts(here, staff, sessions, BELLS);
  server.worlds.get(id)!.date = date;
  const world = { world: id, date };
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  return { world, school, joined, parts, first: first, second: second };
}

const sheetOf = (setting: Awaited<ReturnType<typeof termWorld>>, at = 0) => {
  const course = termCourses(setting.parts, setting.world.date, SUBJECTS)[at];
  return termSheet(setting.world.world, setting.school, course, 2, setting.world.date, data);
};

describe('the term and courses a teacher sends', () => {
  it('sends the term holding the date, the last ended between terms, and none before one ends', () => {
    const { year } = MINE.calendar;
    expect(sendingTerm(year, TERM2)?.number).toBe(2);
    expect(sendingTerm(year, parseDay('2026-12-17'))?.number).toBe(1);
    expect(sendingTerm(year, parseDay('2026-12-25'))?.number).toBe(1);
    expect(sendingTerm(year, parseDay('2027-03-25'))?.number).toBe(2);
    expect(sendingTerm(year, parseDay('2026-09-10'))).toBeNull();
  });

  it('lists each class and subject of the timetable once, an unknown subject with no code', async () => {
    const { parts, first, second } = await termWorld();
    const courses = termCourses(parts, TERM2, SUBJECTS);
    expect(courses).toEqual([
      { class: first.name, subject: 'رياضيات', code: 'math' },
      { class: second.name, subject: 'رياضيات', code: 'math' },
      { class: '9AM9', subject: 'رياضيات', code: 'math' },
      { class: first.name, subject: 'مادة مختلقة', code: null },
    ]);
    expect(termCourses(parts, parseDay('2026-12-17'), SUBJECTS)).toEqual(courses);
    expect(termCourses([], TERM2, SUBJECTS)).toEqual([]);
  });

  it('makes up the class list’s marks on the level’s scale and formula, or none without list or code', async () => {
    const setting = await termWorld();
    const sheet = sheetOf(setting);
    if (sheet.kind !== 'marks') throw new Error(sheet.kind);
    expect([sheet.formula?.id, sheet.marks.scale, sheet.marks.parts, sheet.release]).toEqual([
      'cem',
      20,
      ['T', 'F', 'E'],
      data.assessment.release,
    ]);
    expect(sheet.marks.rows.map((row) => row.registration)).toEqual(
      setting.first.pupils.map((pupil) => pupil.registration),
    );
    expect(sheet.head).toEqual({
      world: setting.world.world,
      school: setting.school.id,
      term: 2,
      className: setting.first.name,
      subject: 'math',
      signed: TERM2,
    });
    expect(termMatches(sheet.head, sheet.marks)).toEqual({
      matched: sheet.marks.rows.length,
      total: sheet.marks.rows.length,
    });
    expect(sheetOf(setting, 2).kind).toBe('no-list');
    expect(sheetOf(setting, 3).kind).toBe('no-subject');
  });
});

describe('sending a term’s marks to the stand-in', () => {
  const marksOf = (setting: Awaited<ReturnType<typeof termWorld>>, at = 0) => {
    const sheet = sheetOf(setting, at);
    if (sheet.kind !== 'marks') throw new Error(sheet.kind);
    return sheet;
  };
  const sending = (setting: { world: { world: string }; joined: SchoolJoined }, sheet: ReturnType<typeof marksOf>) =>
    sendTermMarks(setting.world, setting.joined, sheet.head, sheet.marks, kit, server.send);

  it('answers a receipt on the world’s date, the same again, and a later day’s as new', async () => {
    const setting = await termWorld();
    const sheet = marksOf(setting);
    const first = await sending(setting, sheet);
    const { id, ...rest } = first.receipt;
    expect([first.again, /^[0-9a-f]{32}$/u.test(id)]).toEqual([false, true]);
    expect(rest).toEqual({
      standIn: true,
      kind: 'marks',
      term: 2,
      class: setting.first.name,
      subject: 'math',
      rows: setting.first.pupils.length,
      signed: TERM2,
      received: TERM2,
      signer: setting.joined.certificate.subject,
    });
    expect(await sending(setting, sheet)).toEqual({ receipt: first.receipt, again: true });
    const later = parseDay('2027-01-13');
    server.worlds.get(setting.world.world)!.date = later;
    const next = await sending(setting, { ...sheet, head: { ...sheet.head, signed: later } });
    expect([next.again, next.receipt.id === first.receipt.id, next.receipt.received]).toEqual([false, false, later]);
    const receipts = await standInReceipts(setting.world.world, server.send);
    expect(receipts.map((one) => one.id)).toEqual([next.receipt.id, first.receipt.id]);
    expect(courseReceipt(receipts, setting.joined, sheet.head)).toEqual(next.receipt);
    expect(courseReceipt(receipts, setting.joined, marksOf(setting, 1).head)).toBeUndefined();
    const sealed = server.seen.filter((one) => one.path.endsWith('/state/deliveries') && one.method === 'POST');
    expect(sealed).toHaveLength(3);
    expect(sealed.every((one) => !one.body!.includes(setting.first.pupils[0].registration!))).toBe(true);
  });

  it('refuses a mismatch before sending, and says the stand-in’s refusal', async () => {
    const setting = await termWorld();
    const sheet = marksOf(setting);
    const [one, two, ...rest] = sheet.marks.rows;
    const twice = { ...sheet.marks, rows: [one, { ...two, registration: one.registration }, ...rest] };
    expect(await codeOf(sendTermMarks(setting.world, setting.joined, sheet.head, twice, kit, server.send))).toBe(
      'E_TERM_MISMATCH',
    );
    expect(server.seen.some((one) => one.path.endsWith('/state/deliveries'))).toBe(false);
    const short = { T: one.values.T, F: one.values.F };
    const missing = { ...sheet.marks, rows: [{ ...one, values: short }, two, ...rest] };
    expect(termComplete(missing)).toBe(sheet.marks.rows.length - 1);
    expect(termMatches(sheet.head, missing)).toEqual({ matched: missing.rows.length, total: missing.rows.length });
    expect(await codeOf(sendTermMarks(setting.world, setting.joined, sheet.head, missing, kit, server.send))).toBe(
      'E_TERM_MISMATCH',
    );
    expect(server.seen.some((one) => one.path.endsWith('/state/deliveries'))).toBe(false);
    const ahead = { ...sheet, head: { ...sheet.head, signed: parseDay('2027-01-20') } };
    expect(await codeOf(sending(setting, ahead))).toBe('E_STATE_REFUSED');
    server.relay.state.most = 0;
    expect(await codeOf(sending(setting, sheet))).toBe('E_STATE_REFUSED');
    expect(await standInReceipts(setting.world.world, server.send)).toEqual([]);
  });

  it('writes what is sealed in base64 with its padding', () => {
    expect([toBase64(new Uint8Array([251, 255])), toBase64(new Uint8Array([1, 2, 3]))]).toEqual(['+/8=', 'AQID']);
  });
});
