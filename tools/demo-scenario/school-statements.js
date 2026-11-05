// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario at the school, its statements in reader mode (#630, answers 722
// and 725): two teachers each say where a 4AM class has reached and sign a
// statement under the world's name, naming no teacher and no pupil, and share
// it on paper; the first's shows the session still not held in its signed week.
// A third teacher, the subject's coordinator, opens each in the world's store
// as the reader does: the signature checks only for this world, real mode and
// another world refuse it, and a statement changed in the sharing is refused
// and cannot be kept. The coordinator names the teachers on this device, reads
// both classes side by side in the school's picture, and merges them for the
// subject, each placed in its unit. Once the date moves, a later statement of
// the same class takes its place.

import {
  checkStatement,
  fitsInQr,
  nameTeacher,
  queueItems,
  receivedStatements,
  receiveStatement,
  statementMerge,
  statementPicture,
  storeWorld,
  teacherNames,
} from '@minhajna/core';
import { appModule } from './app.js';
import { classOf, schoolOf, see, teacherOf } from './school-join.js';

const { mineOf } = await appModule('week/school-mine-session.ts');
const { readSignChannel } = await appModule('week/week-sign-session.ts');
const { courseStatement, partInForce, signedWorldStatement, statementCourses } = await appModule(
  'school/world-statement-session.ts',
);

/** The fields a statement holds: no teacher, no pupil, no reason for a session not held. */
const FIELDS = JSON.stringify(
  ['class', 'day', 'delay', 'format', 'lastResource', 'lastUnit', 'notHeld', 'pack', 'td', 'version'].toSorted(),
);

async function shareStatement(stage, device, { who, item, notHeld, wholeUnit }) {
  const { kit, send, reference, paper } = stage;
  const school = schoolOf(stage, device);
  const room = classOf(stage, device, who);
  const { parts, weeks } = await readSignChannel(device, device.join, kit, send);
  const courses = statementCourses(parts, device.date, reference.profile.subjects, school, reference.packs);
  const course = courses.find((one) => one.class === room.name);
  see(course?.pack != null, `${room.name} has no pack to state its progress on`);
  const at = queueItems(course.pack, 'main').filter((one) => one.kind === 'lesson')[item];
  see(at !== undefined, `${room.name}'s pack has no lesson ${item}`);
  const statement = courseStatement({
    school,
    course,
    reached: { item: at.id, status: 'done' },
    weeks: weeks.map((one) => one.week),
    mine: mineOf(reference, reference.calendar, school),
    bells: partInForce(parts, device.date)?.bells ?? [],
    day: device.date,
  });
  see(statement !== null, `${room.name} gives no statement`);
  see(JSON.stringify(Object.keys(statement).toSorted()) === FIELDS, `the statement holds ${Object.keys(statement)}`);
  const { lastResource, lastUnit } = statement;
  see(lastResource?.id === at.id && lastResource.status === 'done', 'the statement is not of the item reached');
  see((lastUnit?.id ?? null) === wholeUnit, `the statement's last whole unit reads ${lastUnit?.id}`);
  see(statement.notHeld.other === notHeld, `the statement has ${statement.notHeld.other} not held, not ${notHeld}`);
  const text = await signedWorldStatement(statement, device.world, device.join, kit);
  see(fitsInQr(text), 'the signed statement does not fit a code');
  const people = [teacherOf(stage, device, who), ...room.pupils];
  const names = people.flatMap((one) => [one.name, one.latinName]).filter(Boolean);
  see(!names.some((name) => text.includes(name)), 'the signed statement names a person');
  paper.set('statements', [...(paper.get('statements') ?? []), text]);
  paper.set('reached', new Map(paper.get('reached')).set(room.name, { item: at.id, day: device.date }));
}

/** A statement with one figure changed after it was signed. */
function changed(text) {
  const signed = JSON.parse(text);
  const statement = JSON.parse(signed.payload);
  const delay = { ...statement.delay, sessions: statement.delay.sessions + 1 };
  return JSON.stringify({ ...signed, payload: JSON.stringify({ ...statement, delay }) });
}

/** Whether a call throws, as keeping a statement other than the one checked does. */
function refuses(call) {
  try {
    call();
    return false;
  } catch {
    return true;
  }
}

/** Opens one shared statement as the reader does, and keeps it in the world's store. */
async function open(stage, device, text, at) {
  const { verify } = stage.kit;
  const here = storeWorld(device.book.entries);
  see(here === device.world, 'the coordinator’s store is not of this world');
  const real = await checkStatement(text, verify);
  see(!real.ok && real.problem === 'world', `real mode answered ${real.problem ?? 'yes'}`);
  const other = await checkStatement(text, verify, 'Z9XY8');
  see(!other.ok && other.problem === 'world', `another world answered ${other.problem ?? 'yes'}`);
  const edited = await checkStatement(changed(text), verify, here);
  see(!edited.ok && edited.problem === 'signature', `a changed statement answered ${edited.problem ?? 'yes'}`);
  const checked = await checkStatement(text, verify, here);
  see(checked.ok, `the statement answered ${checked.problem}`);
  const keeping = (one, id) => receiveStatement(device.book.entries, one, checked, 'qr', id);
  see(
    refuses(() => keeping(changed(text), 'changed')),
    'a changed statement would be kept',
  );
  const event = keeping(text, `statement-${at}`);
  if (event !== null) await device.book.record(device.date, event);
  const again = keeping(text, `statement-${at}-again`);
  see(again === null, 'the same statement would be kept twice');
  return checked.spki;
}

async function mergeStatements(stage, device, { kept, sections, units }) {
  const { reference, paper } = stage;
  const keys = [];
  for (const [at, text] of paper.get('statements').entries()) keys.push(await open(stage, device, text, at));
  const list = receivedStatements(device.book.entries);
  see(list.length === kept, `the store keeps ${list.length} statements, not ${kept}`);
  const known = teacherNames(device.book.entries);
  for (const [at, spki] of [...new Set(keys)].entries()) {
    if (!known.has(spki)) await device.book.record(device.date, nameTeacher(spki, `Made-up teacher ${at + 1}`));
  }
  const names = teacherNames(device.book.entries);
  see(names.size === sections, `the coordinator named ${names.size} teachers`);
  const picture = statementPicture(list, names);
  const [part] = picture.grades;
  see(picture.leftOut === 0 && picture.grades.length === 1, 'the picture leaves a statement out');
  see(
    part?.grade === '4am' && part.statements === sections && part.teachers === sections,
    'the picture’s grade is off',
  );
  const [subject] = part.subjects;
  const merge = statementMerge(part, subject, reference.packs);
  see(merge.rows.length === sections && merge.teachers === sections, `the merge has ${merge.rows.length} classes`);
  const reached = paper.get('reached');
  for (const row of merge.rows) {
    see(reached.has(row.section), `${row.section} shared nothing`);
    see(names.has(row.one.spki), `${row.section}'s teacher is not named`);
    see(row.miss === null && row.place !== null, `${row.section} cannot be placed: ${row.miss}`);
    const { item, day } = reached.get(row.section);
    const { statement } = row.one;
    see(statement.lastResource.id === item && statement.day === day, `${row.section} reads an older statement`);
    see(row.place.items[row.place.at].id === item, `${row.section} is placed on another item`);
  }
  for (const [who, unit] of Object.entries(units)) {
    const row = merge.rows.find((one) => one.section === classOf(stage, device, who).name);
    see(row.place.unit?.at === unit, `${row.section} reads unit ${row.place.unit?.at}, not ${unit}`);
  }
}

export const STATEMENT_ACTIONS = { shareStatement, mergeStatements };

export const STATEMENT_STEPS = [
  { as: 'teacher', who: 'a', do: 'shareStatement', item: 3, notHeld: 1, wholeUnit: null },
  { as: 'teacher', who: 'b', do: 'shareStatement', item: 1, notHeld: 0, wholeUnit: null },
  { as: 'teacher', who: 'c', do: 'mergeStatements', kept: 2, sections: 2, units: { a: 1, b: 1 } },
  { as: 'ministry', do: 'move', expect: 'moved' },
  { as: 'teacher', who: 'c', do: 'see', day: 5 },
  { as: 'teacher', who: 'a', do: 'shareStatement', item: 5, notHeld: 1, wholeUnit: 'u1' },
  { as: 'teacher', who: 'c', do: 'mergeStatements', kept: 3, sections: 2, units: { a: 2, b: 1 } },
];
