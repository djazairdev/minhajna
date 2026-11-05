// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario above the school, a release reaching a teacher's plan (#631,
// answers 722 and 771): a teacher joins a school and takes the timetable it
// sends, its classes read from that real channel as the plans page reads them.
// The Ministry's release moved no class: the teacher's 4AM course is offered
// it, who signed it reads as the Ministry, and it says the retitled lesson
// changed, while their course of another grade is not offered it. A move is
// kept in the world's store, dated by the world, moves that course alone and
// offers it nothing more. The teacher reports an error in the retitled lesson
// on the world's reports stream, and the curators read exactly what was sent,
// with no name.

import { keptWorld, partOn, readJoinCode } from '@minhajna/core';
import { appModule } from './app.js';
import { RETITLED } from './national-publish.js';
import { classOf, schoolOf, see } from './school-join.js';

const { readPackEditor } = await appModule('editor/pack-release-session.ts');
const { keepPackPin } = await appModule('editor/pack-account.ts');
const { readPackReports, sendPackReport } = await appModule('editor/pack-report-session.ts');
const { chainPacks, coursesFor, coursesFrom, latestPublished, moveOffer, pinOf } =
  await appModule('school/world-pack-rules.ts');
const { firstToCome, sessionsOf } = await appModule('timetable/teacher-session.ts');
const { readSignChannel } = await appModule('week/week-sign-session.ts');

const NOTE = 'Made-up report: this lesson reads wrongly.';
const KIND = 'title';

/** The page's reading: the world's releases, and the courses of the timetable the school sent. */
async function plansOf(stage, device) {
  const { reference, kit, send } = stage;
  const { profile } = reference;
  const world = { world: device.world, date: device.date, kind: 'national' };
  const { records, damaged, date } = await readPackEditor({ world, held: device.held, profile, kit }, send);
  see(!damaged, 'the world’s releases read as damaged');
  const { parts } = await readSignChannel(world, device.join, kit, send);
  const part = partOn(parts, device.date)?.part ?? firstToCome({ parts });
  see(part !== null, 'the school sent no timetable');
  const scope = readJoinCode(device.join.code).school;
  const courses = coursesFrom(scope, sessionsOf(part), schoolOf(stage, device), profile.subjects);
  return { records, courses, date, pins: keptWorld(device.book.entries)?.packPins ?? {} };
}

async function seeOffer(stage, device, { who }) {
  const { records, courses, pins } = await plansOf(stage, device);
  const pack = stage.paper.get('release').pack;
  const [release] = latestPublished(records).filter((one) => one.pack.id === pack.id);
  see(release?.pack.release === pack.release, 'the page does not read the release as the latest');
  see(release.actor === 'ministry', `the release reads as signed by ${release.actor}`);
  const room = classOf(stage, device, who);
  see(courses.length > 1, `the page reads ${courses.length} courses, with no other to stay out of it`);
  const course = courses.find((one) => one.class === room.name && one.code === 'arabic');
  see(pins[course.key] === undefined, 'publishing moved the class');
  const offered = coursesFor(release, courses, pins);
  see(
    offered.length === 1 && offered[0] === course,
    `the release is offered to ${offered.map((one) => one.class)}, not ${room.name} alone`,
  );
  const pin = pinOf(course, pins);
  see(pin?.release === course.start.release, `the class starts on ${pin?.release}`);
  const offer = moveOffer(pin, release.pack, chainPacks(stage.reference.packs, records));
  see(offer.kind === 'move' && offer.from === pin.release, `the move reads ${offer.kind}`);
  const [change] = offer.changes;
  see(
    offer.changes.length === 1 && change.kind === 'title' && change.to.title === RETITLED,
    `the move says ${JSON.stringify(offer.changes)} changed`,
  );
}

async function movePlan(stage, device) {
  const { records, courses, date, pins } = await plansOf(stage, device);
  const { pack } = stage.paper.get('release');
  const [release] = latestPublished(records).filter((one) => one.pack.id === pack.id);
  const [course] = coursesFor(release, courses, pins);
  const others = courses.filter((one) => one.key !== course.key);
  const before = others.map((one) => pinOf(one, pins));
  const moved = await keepPackPin({ book: device.book, date }, course.key, { id: pack.id, release: pack.release });
  see(moved[course.key]?.day === date, 'the move is not dated by the world');
  see(pinOf(course, moved)?.release === pack.release, 'the course did not move');
  see(coursesFor(release, courses, moved).length === 0, 'the release is still offered');
  see(
    JSON.stringify(others.map((one) => pinOf(one, moved))) === JSON.stringify(before),
    'the move moved another course',
  );
  const kept = await plansOf(stage, device);
  const again = kept.courses.find((one) => one.key === course.key);
  see(pinOf(again, kept.pins)?.release === pack.release, 'the page does not read the move from the store');
}

async function reportError(stage, device) {
  const { reference, kit, send, paper } = stage;
  const { pack } = paper.get('release');
  const world = { world: device.world, date: device.date, kind: 'national' };
  const editor = { world, held: device.held, profile: reference.profile, kit };
  const { id: item } = pack.items.find((one) => one.title === RETITLED);
  const report = { id: pack.id, release: pack.release, item, kind: KIND, note: NOTE, name: null };
  await sendPackReport(editor, report, send);
  paper.set('report', { ...report, day: device.date });
}

async function readReports(stage, device) {
  const { reference, kit, send } = stage;
  const world = { world: device.world, date: device.date, kind: 'national' };
  const reports = await readPackReports({ world, held: device.held, profile: reference.profile, kit }, send);
  see(reports.length === 1, `the curators read ${reports.length} reports`);
  const sent = JSON.stringify(Object.entries(stage.paper.get('report')).toSorted());
  see(JSON.stringify(Object.entries(reports[0]).toSorted()) === sent, 'the curators read other than was sent');
}

export const PLAN_ACTIONS = { seeOffer, movePlan, reportError, readReports };

export const PLAN_STEPS = [
  { as: 'teacher', who: 'a', do: 'seeOffer' },
  { as: 'teacher', who: 'a', do: 'movePlan' },
  { as: 'teacher', who: 'a', do: 'reportError' },
  { as: 'curator', do: 'readReports' },
];
