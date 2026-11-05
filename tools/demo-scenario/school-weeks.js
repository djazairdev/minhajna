// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario at the school, its signed weeks and cover (#630, answer 722): a
// teacher signs a 4AM class's week with two sessions not held, one of them
// wrongly, as Week-sign does, and a second signature is refused; the director
// reads it; the teacher corrects it, as Week-fix does, and the director reads
// both versions and gives the correction a visa, which only one may have and
// the teacher reads back. The director marks a session of the world's day for
// cover, by the colleague the page suggests, who is then no longer free for
// another session at that time, and counts in the term's log.

import { correctWeek, readJoinCode, weekday } from '@minhajna/core';
import { appModule } from './app.js';
import { classOf, refusal, schoolOf, see, teacherOf } from './school-join.js';

const { markCover, readCover } = await appModule('director/cover-session.ts');
const { readRecords, wholeChain } = await appModule('director/records-session.ts');
const { giveVisa } = await appModule('director/visa-session.ts');
const { readSignChannel, sessionKey, signTheWeek, weekRecord, weekStart, weeksToSign } =
  await appModule('week/week-sign-session.ts');

/** How many sessions a week is signed with not held: one is wrong, and one stands. */
const NOT_HELD = 2;

async function signWeek(stage, device, { who }) {
  const { kit, send, reference } = stage;
  const { workingDays, subjects } = reference.profile;
  const { parts } = await readSignChannel(device, device.join, kit, send);
  const name = classOf(stage, device, who).name;
  const week = weeksToSign(parts, device.date, workingDays, subjects).find((one) => one.class === name);
  see(week !== undefined && week.sessions.length >= NOT_HELD, `no week of ${name} to sign on ${device.date}`);
  const first = weekStart(device.date, workingDays);
  const space = readJoinCode(device.join.code).school;
  const states = new Map(week.sessions.map((one, at) => [sessionKey(one), at < NOT_HELD ? 'not-held' : 'held']));
  const record = await weekRecord(space, week, first, states, kit.mac);
  await signTheWeek(device, device.join, record, kit, send);
  see((await refusal(signTheWeek(device, device.join, record, kit, send))) === 'E_WEEK_SIGNED', 'it signs twice');
  device.signed = record;
}

/** The week's record as the director reads it. */
async function recordedWeek(stage, device, who, first) {
  const { kit, send } = stage;
  const school = schoolOf(stage, device);
  const records = await readRecords(device, school, kit, send);
  const name = classOf(stage, device, who).name;
  const teacher = teacherOf(stage, device, who).name;
  const course = records.find((one) => one.class === name)?.courses.find((one) => one.teacher === teacher);
  return course?.weeks.find((one) => one.week.week === first);
}

async function seeWeek(stage, device, { of: who, version, notHeld }) {
  const { workingDays } = stage.reference.profile;
  const found = await recordedWeek(stage, device, who, weekStart(device.date, workingDays));
  see(found?.week.version === version, `the record stands at version ${found?.week.version}, not ${version}`);
  see(wholeChain(found), 'the versions below it were not all read');
  const count = found.week.sessions.filter((one) => one.state === 'not-held').length;
  see(count === notHeld, `the record has ${count} sessions not held, not ${notHeld}`);
  if (version === 0) return;
  const below = found.earlier[0]?.week.sessions.filter((one) => one.state === 'not-held').length;
  see(
    below === NOT_HELD && found.week.reason === 'entry-error',
    'the original is not kept under its correction, with a reason',
  );
}

async function correctTheWeek(stage, device) {
  const { kit, send } = stage;
  const wrong = device.signed.sessions.find((one) => one.state === 'not-held');
  const fixed = correctWeek(device.signed, wrong, 'held', 'entry-error');
  await signTheWeek(device, device.join, fixed, kit, send);
  const { weeks } = await readSignChannel(device, device.join, kit, send);
  const read = weeks.find((one) => one.week.course === fixed.course && one.week.week === fixed.week);
  see(read?.week.version === 1 && read.earlier.length === 1, 'the correction does not read with its original');
  device.signed = fixed;
  stage.paper.set('signed', fixed);
}

async function giveTheVisa(stage, device, { of: who }) {
  const { kit, send, reference } = stage;
  const found = await recordedWeek(stage, device, who, weekStart(device.date, reference.profile.workingDays));
  await giveVisa(device, found, kit, send);
  const again = await recordedWeek(stage, device, who, found.week.week);
  see(again.visas.length === 1, `the version holds ${again.visas.length} visas`);
  see(again.visas[0].value.version === found.week.version, 'the visa is not of the version read');
  see((await refusal(giveVisa(device, again, kit, send))) === 'E_WEEK_VISAED', 'a second visa was taken');
}

async function seeVisa(stage, device) {
  const { visas } = await readSignChannel(device, device.join, stage.kit, stage.send);
  const on = visas.filter((one) => one.value.course === device.signed.course && one.value.week === device.signed.week);
  see(on.length === 1 && on[0].value.version === device.signed.version, 'the teacher does not read the visa');
}

async function coverSession(stage, device) {
  const { kit, send, reference } = stage;
  const school = schoolOf(stage, device);
  const { year } = reference.calendar;
  const day = await readCover(device, school, year, kit, send);
  const { sessions } = day;
  const one = sessions.find((each) => each.suggested !== null);
  see(one !== undefined, `none of the ${sessions.length} sessions of ${device.date} has a colleague free`);
  const atOnce = (list) => list.filter((each) => each.id !== one.id && each.session.start === one.session.start);
  const free = (each) => each.free.some((person) => person.id === one.suggested);
  see(atOnce(sessions).some(free), 'the colleague was not free for another session at that time');
  await markCover(device, day.space, one.id, 'colleague', one.suggested);
  const after = await readCover(device, school, year, kit, send);
  const marked = after.sessions.find((each) => each.id === one.id);
  see(marked?.cover?.by === one.suggested && marked.taken === null, 'the cover does not read as marked');
  see(after.log.find((each) => each.id === one.suggested)?.count === 1, 'the term log does not count the cover');
  see(!atOnce(after.sessions).some(free), 'the colleague reads as free');
  see(weekday(device.date) === one.session.day, 'the session is not of the world’s day');
}

export const WEEK_ACTIONS = {
  signWeek,
  seeWeek,
  correctWeek: correctTheWeek,
  giveVisa: giveTheVisa,
  seeVisa,
  coverSession,
};

export const WEEK_STEPS = [
  { as: 'ministry', do: 'move', expect: 'moved' },
  { as: 'teacher', who: 'a', do: 'see', day: 1 },
  { as: 'teacher', who: 'a', do: 'signWeek' },
  { as: 'director', do: 'seeWeek', of: 'a', version: 0, notHeld: NOT_HELD },
  { as: 'teacher', who: 'a', do: 'correctWeek' },
  { as: 'director', do: 'seeWeek', of: 'a', version: 1, notHeld: NOT_HELD - 1 },
  { as: 'director', do: 'giveVisa', of: 'a' },
  { as: 'teacher', who: 'a', do: 'seeVisa' },
  { as: 'director', do: 'coverSession' },
];
