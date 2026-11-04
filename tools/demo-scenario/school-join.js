// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario at the school, its first part (#630, answer 722): a school joins
// and its timetable reaches its teachers. The director's device takes the
// seeded key of the school a world's director runs and fills its term, as
// D-Keys does; it issues a new code to each teacher who joins, handed over as
// on paper, and each joins on their own device as School-join does. The
// timetable is the school's seeded week, written out as the template's rows and
// read as the template is; it is published from the next Sunday, to every
// teacher of the staff list. Each teacher finds their own sessions and
// confirms, and the director sees the receipts. A teacher here is one of the
// school's Arabic teachers, a, b or c, each with a 4AM class, so that a grade's
// merge has several classes to show.

import { directorSchool, keptIssues, readTimetable } from '@minhajna/core';
import { appModule } from './app.js';

const { seededWorld } = await appModule('director/director-world.ts');
const { fillTakenTerm } = await appModule('director/seeded-fill.ts');
const { takeSeededKey } = await appModule('director/seeded-key.ts');
const { assignmentsOf, codeText, holdSchool, issueFor, joinedDays } = await appModule('director/issue-session.ts');
const { joinSchool } = await appModule('school/school-join-session.ts');
const { readRecords } = await appModule('director/records-session.ts');
const { levelBells, timetableWords } = await appModule('timetable/timetable-words.ts');
const { partFrom } = await appModule('timetable/send-session.ts');
const { draftVersion, publishVersion } = await appModule('timetable/version-session.ts');
const { readReceipts, upToDate } = await appModule('timetable/receipt-session.ts');
const { confirmReceipt, readTeacherChannel } = await appModule('timetable/teacher-session.ts');

const WHO = { a: 0, b: 1, c: 2 };

/** The school a world's director runs, as every device works it out from the world's ID. */
export const schoolOf = ({ reference }, device) => directorSchool(seededWorld(device.world, reference));

/** The seeded teacher a person of the scenario plays. */
export function teacherOf(stage, device, who) {
  const found = schoolOf(stage, device).teachers.filter((one) => one.subject === 'arabic')[WHO[who]];
  if (found === undefined) throw new RangeError(`The school has no teacher ${who}`);
  return found;
}

/** Throws unless what a role sees holds. */
export function see(holds, what) {
  if (!holds) throw new Error(what);
}

async function takeKey(stage, device) {
  const { kit, send, reference } = stage;
  const school = schoolOf(stage, device);
  await takeSeededKey(device, device.held, school, kit, send);
  const desk = await holdSchool(device, kit, send, false);
  await fillTakenTerm(device, desk, device.held, school, reference, kit, send);
  const records = await readRecords(device, school, kit, send);
  see(records.length === school.classes.length, `the term's records show ${records.length} classes`);
}

async function issueCode(stage, device, { for: who }) {
  const { kit, send } = stage;
  const desk = await holdSchool(device, kit, send, false);
  const teacher = teacherOf(stage, device, who);
  const assignment = (await assignmentsOf(desk, [teacher], kit)).get(teacher.id);
  const { kept, desk: after } = await issueFor(device, desk, assignment, 'phone', kit, send);
  see(kept.issue === 2, `the new code is issue ${kept.issue}, after the seeded first`);
  stage.paper.set(`code:${who}`, await codeText(device.world, after, kept));
}

async function joinTheSchool(stage, device, { who }) {
  device.join = await joinSchool(device, stage.paper.get(`code:${who}`), stage.kit, stage.send);
}

async function seeJoined(stage, device, { of: who }) {
  const { kit, send } = stage;
  const desk = await holdSchool(device, kit, send, false);
  const teacher = teacherOf(stage, device, who);
  const assignment = (await assignmentsOf(desk, [teacher], kit)).get(teacher.id);
  const issue = keptIssues(device.book.entries, desk.held.school).get(assignment);
  const days = await joinedDays(device.world, desk, [issue], kit, send);
  see(days.size === 1, `${who} is not seen as joined on the code issued`);
}

/** The school's week as the template's rows: a header, then a row for each session. */
export function timetableRows(stage, school) {
  const { profile, bells } = stage.reference;
  const times = levelBells(bells, school.level);
  const clock = (minutes) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  const named = (list, id) => list.find((one) => one.id === id);
  const subjectName = (code) => profile.subjects.find((one) => one.code === code)?.name.en;
  const words = timetableWords();
  const rows = school.week.map((one) => {
    const [from, to] = times[one.slot.index - 1];
    const day = words.days[one.weekday][2] ?? words.days[one.weekday][0];
    return [
      named(school.classes, one.classId).name,
      subjectName(one.subject),
      named(school.teachers, one.teacherId).name,
      day,
      clock(from),
      clock(to),
    ];
  });
  return [['Class', 'Subject', 'Teacher', 'Day', 'Start', 'End'], ...rows];
}

async function publishTimetable(stage, device) {
  const { kit, send, reference } = stage;
  const school = schoolOf(stage, device);
  const read = readTimetable(timetableRows(stage, school), timetableWords());
  see(read.problems.length === 0, `the template reads with ${JSON.stringify(read.problems[0])}`);
  const bells = levelBells(reference.bells, school.level);
  const draft = await draftVersion(device, school, read.sessions, bells, kit, send);
  see(draft.notStaff.length + draft.twoNames.length + draft.noCode.length === 0, 'a teacher cannot be sent a part');
  const from = partFrom(device.date);
  const sent = await publishVersion(device, draft, { from, once: false }, kit, send);
  see(sent.failed.length === 0, `no part reached ${sent.failed[0]}: ${sent.problem?.code}`);
  see(sent.sent.length === school.teachers.length, `the version went to ${sent.sent.length} teachers`);
}

async function receiveTimetable(stage, device, { who }) {
  const { kit, send } = stage;
  const channel = await readTeacherChannel(device, device.join, kit, send);
  const part = channel.parts.at(-1)?.part;
  const teacher = teacherOf(stage, device, who);
  const theirs = schoolOf(stage, device).week.filter((one) => one.teacherId === teacher.id);
  see(part?.sessions.length === theirs.length, `the part holds ${part?.sessions.length} of ${theirs.length} sessions`);
  await confirmReceipt(device, device.join, part.version, kit, send);
}

async function seeReceipts(stage, device, { of: who }) {
  const { kit, send } = stage;
  const teacher = teacherOf(stage, device, who);
  const one = (await readReceipts(device, schoolOf(stage, device), kit, send)).find((each) => each.id === teacher.id);
  see(one !== undefined && upToDate(one), `${who}'s receipt does not show as up to date`);
}

export const JOIN_ACTIONS = {
  takeKey,
  issueCode,
  joinSchool: joinTheSchool,
  seeJoined,
  publishTimetable,
  receiveTimetable,
  seeReceipts,
};

export const JOIN_STEPS = [
  { as: 'ministry', do: 'start' },
  { as: 'director', do: 'join' },
  { as: 'director', do: 'takeKey' },
  { as: 'director', do: 'issueCode', for: 'a' },
  { as: 'director', do: 'issueCode', for: 'b' },
  { as: 'director', do: 'issueCode', for: 'c' },
  { as: 'teacher', who: 'a', do: 'join' },
  { as: 'teacher', who: 'a', do: 'joinSchool' },
  { as: 'teacher', who: 'b', do: 'join' },
  { as: 'teacher', who: 'b', do: 'joinSchool' },
  { as: 'teacher', who: 'c', do: 'join' },
  { as: 'teacher', who: 'c', do: 'joinSchool' },
  { as: 'director', do: 'seeJoined', of: 'a' },
  { as: 'director', do: 'publishTimetable' },
  { as: 'teacher', who: 'a', do: 'receiveTimetable' },
  { as: 'teacher', who: 'b', do: 'receiveTimetable' },
  { as: 'director', do: 'seeReceipts', of: 'a' },
];
