// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario above the school (#631, answer 722), through the app's own
// sessions (device.js): the Ministry publishes the calendar and a pack
// (national-publish.js), which reaches a teacher who joined a school and took
// its timetable (national-plans.js); the operators' console shows the world:
// what the server reports of itself, that its admin log holds its start and its
// security log counts a refusal, and its problem reports.

import { appModule } from './app.js';
import { appAccess } from './device.js';
import { PLAN_ACTIONS, PLAN_STEPS } from './national-plans.js';
import { PUBLISH_ACTIONS, PUBLISH_STEPS } from './national-publish.js';
import { JOIN_ACTIONS, see } from './school-join.js';

const { readAdminLog, readSecurity } = await appModule('operators/ops-logs.ts');
const { opsBoxes } = await appModule('operators/ops-map.ts');
const { readProblems } = await appModule('operators/ops-problems.ts');
const { readSystem, SERVER_PARTS, SERVER_RELEASE } = await appModule('operators/ops-system.ts');

/** The operators' console reads the server's system, draws what it reports, and reads its logs and problem reports. */
async function seeConsole(stage, device) {
  const { send } = stage;
  const system = await readSystem(device.world, send);
  see(
    SERVER_PARTS.every((one) => system.parts.includes(one)),
    `the server reports ${system.parts}`,
  );
  see(system.version === SERVER_RELEASE, `the server reports version ${system.version}`);
  const drawn = opsBoxes(system);
  see(drawn.includes('gateway') && drawn.includes('totals'), `the console draws ${drawn}`);
  const lines = await readAdminLog(device.world, send);
  see(
    lines.some((one) => one.action === 'server.started'),
    'the admin log holds no start of the server',
  );
  const { keptDays, days } = await readSecurity(device.world, send);
  const refused = days.reduce((sum, one) => sum + one.counts['starter-refused'], 0);
  see(keptDays > 0, 'the security log keeps no days');
  see(refused >= 1, 'the security log counts no refusal');
  see(Array.isArray(await readProblems(device.world, send)), 'the problem reports do not read');
}

const { takeKey, issueCode, joinSchool, publishTimetable, receiveTimetable } = JOIN_ACTIONS;
const JOINING = { takeKey, issueCode, joinSchool, publishTimetable, receiveTimetable };

export const NATIONAL = {
  name: 'The Ministry publishes, and a release reaches a teacher',
  kind: 'national',
  access: appAccess,
  actions: { ...JOINING, ...PUBLISH_ACTIONS, ...PLAN_ACTIONS, seeConsole },
  steps: [
    { as: 'ministry', do: 'start' },
    { as: 'directorate', do: 'join' },
    { as: 'curator', do: 'join' },
    { as: 'operator', do: 'join' },
    { as: 'director', do: 'join' },
    { as: 'director', do: 'takeKey' },
    { as: 'director', do: 'issueCode', for: 'a' },
    { as: 'teacher', who: 'a', do: 'join' },
    { as: 'teacher', who: 'a', do: 'joinSchool' },
    { as: 'director', do: 'publishTimetable' },
    { as: 'teacher', who: 'a', do: 'receiveTimetable' },
    ...PUBLISH_STEPS,
    ...PLAN_STEPS,
    { as: 'operator', do: 'seeConsole' },
  ],
};
