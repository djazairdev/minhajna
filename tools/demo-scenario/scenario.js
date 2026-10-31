// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Demo scenarios (#629, answer 586): a world's kind and a list of steps, each
// done as one role on that role's own device, against a running demo server. A
// role starts the world, joins it with the code, moves the date, or checks what
// it sees: the world's kind, its stand-in signer, the one the starting device
// sealed, and its date, the world's first date or one of its announced days,
// counted from 1. Moving the date is expected to work or to be refused, as it
// is for every device but the one that started the world. The roles are the
// world's kind's, as the app offers them (world-mode.ts, answer 576); a role
// the kind lacks, a second start, or a step before the world is started or
// before its role has started or joined it, is refused before anything is sent.
// A step that sees something else throws, naming the step. SAMPLE is the first
// scenario: the Ministry starts a national world, a director and a teacher join
// it, the teacher cannot move its date, the Ministry moves it, and both see the
// next announced day.

import * as world from './world.js';

export const ROLES = {
  national: ['ministry', 'directorate', 'director', 'preparer', 'inspector', 'teacher', 'curator', 'operator'],
  teachers: ['teacher', 'observatory'],
};

export const SAMPLE = {
  name: 'The Ministry moves a national world’s date, and each role sees it',
  kind: 'national',
  steps: [
    { as: 'ministry', do: 'start' },
    { as: 'director', do: 'join' },
    { as: 'teacher', do: 'join' },
    { as: 'teacher', do: 'see', day: 0 },
    { as: 'teacher', do: 'move', expect: 'refused' },
    { as: 'ministry', do: 'move', expect: 'moved' },
    { as: 'director', do: 'see', day: 1 },
    { as: 'teacher', do: 'see', day: 1 },
  ],
};

const ACTIONS = ['start', 'join', 'move', 'see'];

/** What is wrong with a scenario before it runs, or null. */
export function scenarioProblem({ kind, steps }) {
  const roles = ROLES[kind];
  if (roles === undefined) return `no world is of kind ${kind}`;
  const started = steps.findIndex((step) => step.do === 'start');
  const joined = new Set();
  for (const [index, step] of steps.entries()) {
    const at = `step ${index + 1}`;
    if (!roles.includes(step.as)) return `${at}: a ${kind} world has no role ${step.as}`;
    if (!ACTIONS.includes(step.do)) return `${at}: no step does ${step.do}`;
    if (step.do === 'start' && index !== started) return `${at}: the world is already started`;
    if (step.do !== 'start' && (started < 0 || index < started)) return `${at}: the world is not started yet`;
    if (['move', 'see'].includes(step.do) && !joined.has(step.as)) return `${at}: ${step.as} has not joined`;
    if (step.do === 'start' || step.do === 'join') joined.add(step.as);
    if (step.do === 'move' && !['moved', 'refused'].includes(step.expect))
      return `${at}: a move expects moved or refused`;
    if (step.do === 'see' && !(Number.isInteger(step.day) && step.day >= 0)) return `${at}: see needs a day, 0 or more`;
  }
  return null;
}

/**
 * Runs a scenario against the demo server at `server`, saying each step it passes; throws at the first that fails.
 * `days` are the new world's, and `access` how a device meets the server, both the app's unless a test gives others.
 */
export async function runScenario(scenario, server, { say = () => {}, days = world.worldDays(), access = world } = {}) {
  const problem = scenarioProblem(scenario);
  if (problem !== null) throw new RangeError(`${scenario.name}: ${problem}`);
  const dates = [days.date, ...days.announcedDays];
  const devices = new Map();
  let started;
  for (const [index, step] of scenario.steps.entries()) {
    const fail = (what) => new Error(`${scenario.name}, step ${index + 1} (${step.as} ${step.do}): ${what}`);
    const device = devices.get(step.as);
    if (step.do === 'start') {
      started = await access.startWorld(server, scenario.kind, days);
      devices.set(step.as, started);
    } else if (step.do === 'join') {
      const joined = await access.joinWorld(server, started.code);
      if (joined.kind !== scenario.kind) throw fail(`the world is of kind ${joined.kind}`);
      if (joined.signer !== started.signer) throw fail('its signer is not the one the world was started with');
      devices.set(step.as, { ...joined, starter: device?.starter ?? null });
    } else if (step.do === 'move') {
      const moved = await access.moveDate(server, device);
      const outcome = moved.status === 200 ? 'moved' : moved.status === 403 ? 'refused' : `answered ${moved.status}`;
      if (outcome !== step.expect) throw fail(`expected ${step.expect}, the server ${outcome}`);
    } else {
      const date = await access.dateOf(server, device);
      if (date !== dates[step.day]) throw fail(`sees ${date}, not ${dates[step.day] ?? 'a day the world announces'}`);
    }
    const detail = step.expect === undefined ? '' : ` (${step.expect})`;
    say(`${index + 1}. ${step.as} ${step.do}${detail}${step.day === undefined ? '' : ` day ${step.day}`}: ok`);
  }
}
