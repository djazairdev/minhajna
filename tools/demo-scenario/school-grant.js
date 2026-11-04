// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario at the school, an inspector's grant from asking to its end
// (#630, answer 722): the inspector's device posts its key in the directorate's
// space, and its fingerprint goes on paper, as the inspectorate's official
// message; the directorate asks, by that fingerprint, for a 4AM class's weeks
// up to a week from the world's date; the director is refused on another
// fingerprint and grants on the right one. The inspector then finds the grant,
// and the class opens with the corrected week and its visa; the director reads
// the last access, and the teacher reads the grant and the access in their own
// log. Once the world's date passes the grant's end, it reads as ended, its
// class no longer opens and the request reads as lapsed.

import { addDays } from '@minhajna/core';
import { appModule } from './app.js';
import { schoolOf, see } from './school-join.js';
import { classOf, refusal } from './school-weeks.js';

const { approveGrant } = await appModule('director/grant-make.ts');
const { readGrants } = await appModule('director/grant-session.ts');
const { requestGrant, requestsOf } = await appModule('directorate/request-session.ts');
const { openGrantClass, readInspectorGrants } = await appModule('inspector/grant-read.ts');
const { postInspectorKey } = await appModule('inspector/inspector-key-session.ts');
const { readAccessUses } = await appModule('week/access-uses.ts');
const { deliveryReading } = await appModule('week/school-mine-session.ts');
const { readSignChannel } = await appModule('week/week-sign-session.ts');

const WEEKS_BACK = 14;
const GRANT_DAYS = 7;

async function postKey(stage, device) {
  const school = schoolOf(stage, device);
  const posted = await postInspectorKey(device, school.directorateId, stage.kit, stage.send);
  stage.paper.set('fingerprint', posted.fingerprint);
}

async function askGrant(stage, device, { of: who }) {
  const { kit, send, paper } = stage;
  const school = schoolOf(stage, device);
  const form = {
    school: school.id,
    fingerprint: paper.get('fingerprint'),
    label: 'Made-up inspector of district 3',
    subject: 'arabic',
    classes: [classOf(stage, device, who).name],
    weeks: { from: addDays(device.date, -WEEKS_BACK), to: device.date },
    until: addDays(device.date, GRANT_DAYS),
  };
  const request = await requestGrant(device, school.directorateId, form, kit, send);
  const [made] = await requestsOf(device, school.directorateId, kit, send);
  see(made?.request.id === request.id && made.delivered && made.seed === school.id, 'the request is not delivered');
  paper.set('request', request.id);
}

async function approve(stage, device) {
  const { kit, send, paper } = stage;
  const school = schoolOf(stage, device);
  const request = paper.get('request');
  const { asked } = await readGrants(device, school, kit, send);
  const one = asked.find((each) => each.request.id === request);
  see(one !== undefined && one.weeks.length > 0 && one.missing.length === 0, 'the request names no signed week');
  const wrong = await refusal(approveGrant(device, school, request, 'A'.repeat(64), kit, send));
  see(wrong === 'E_GRANT_FINGERPRINT', `another fingerprint was answered ${wrong}`);
  await approveGrant(device, school, request, paper.get('fingerprint'), kit, send);
  const after = (await readGrants(device, school, kit, send)).asked.find((each) => each.request.id === request);
  see(after?.made !== null && after.relayed, 'the grant is not recorded and relayed');
}

/** How the inspector's home reads a class's delivery. */
const readingOf = ({ reference: { profile, calendar } }) => deliveryReading({ profile, calendar }, [], []);

const inspectorGrant = async (stage, device) => {
  const school = schoolOf(stage, device);
  const [found] = await readInspectorGrants(device, school.directorateId, stage.kit, stage.send);
  see(found !== undefined && found.school === school.id, 'the inspector finds no grant of this school');
  return found;
};

async function readGrant(stage, device) {
  const { kit, send, paper } = stage;
  const found = await inspectorGrant(stage, device);
  see(!found.ended, 'the grant reads as ended');
  const course = found.grant.weeks.find((one) => one.week === paper.get('signed').week)?.course;
  see(course === paper.get('signed').course, 'the grant does not name the week signed');
  const read = await openGrantClass(device, found.grant, course, readingOf(stage), kit, send);
  see(read !== null && read.corrections > 0 && read.visas === 1, 'the class does not show its correction and visa');
  see(
    read.weeks.some((one) => one.week === paper.get('signed').week && one.version === 1),
    'the correction is absent',
  );
}

async function seeLastUse(stage, device) {
  const { asked } = await readGrants(device, schoolOf(stage, device), stage.kit, stage.send);
  see(asked[0]?.lastUse === device.date, `the last access reads ${asked[0]?.lastUse}`);
}

async function seeAccess(stage, device) {
  const { kit, send } = stage;
  const { notices } = await readSignChannel(device, device.join, kit, send);
  see(notices.length === 1, `the teacher reads ${notices.length} notices of a grant`);
  const uses = await readAccessUses(device.join, notices, kit, send);
  const [use] = uses.get(notices[0].value.grant) ?? [];
  see(use?.day === device.date, 'the teacher’s log does not show the inspector’s access');
}

async function seeEnded(stage, device) {
  const { kit, send, paper } = stage;
  const found = await inspectorGrant(stage, device);
  see(found.ended, 'the grant does not read as ended');
  const reading = readingOf(stage);
  const course = paper.get('signed').course;
  const refused = await refusal(openGrantClass(device, found.grant, course, reading, kit, send));
  see(refused === 'E_GRANT_ENDED', `opening its class was answered ${refused}`);
}

async function seeLapsed(stage, device) {
  const { asked } = await readGrants(device, schoolOf(stage, device), stage.kit, stage.send);
  see(asked[0]?.lapsed === true, 'the request does not read as lapsed');
}

export const GRANT_ACTIONS = { postKey, askGrant, approve, readGrant, seeLastUse, seeAccess, seeEnded, seeLapsed };

export const GRANT_STEPS = [
  { as: 'inspector', do: 'join' },
  { as: 'inspector', do: 'postKey' },
  { as: 'directorate', do: 'join' },
  { as: 'directorate', do: 'askGrant', of: 'a' },
  { as: 'director', do: 'approve' },
  { as: 'inspector', do: 'readGrant' },
  { as: 'director', do: 'seeLastUse' },
  { as: 'teacher', who: 'a', do: 'seeAccess' },
  { as: 'ministry', do: 'move', expect: 'moved' },
  { as: 'inspector', do: 'seeEnded' },
  { as: 'director', do: 'seeLapsed' },
];
