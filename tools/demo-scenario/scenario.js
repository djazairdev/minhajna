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

/** Who acts in a step: its role, or one of its people when a role has several. */
const actor = ({ as, who }) => (who === undefined ? as : `${as}:${who}`);

/** What is wrong with a scenario before it runs, or null. */
export function scenarioProblem({ kind, steps, actions = {} }) {
  const roles = ROLES[kind];
  if (roles === undefined) return `no world is of kind ${kind}`;
  const started = steps.findIndex((step) => step.do === 'start');
  const joined = new Set();
  for (const [index, step] of steps.entries()) {
    const at = `step ${index + 1}`;
    const own = Object.hasOwn(actions, step.do);
    if (!roles.includes(step.as)) return `${at}: a ${kind} world has no role ${step.as}`;
    if (!ACTIONS.includes(step.do) && !own) return `${at}: no step does ${step.do}`;
    if (step.do === 'start' && index !== started) return `${at}: the world is already started`;
    if (step.do !== 'start' && (started < 0 || index < started)) return `${at}: the world is not started yet`;
    if ((['move', 'see'].includes(step.do) || own) && !joined.has(actor(step)))
      return `${at}: ${actor(step)} has not joined`;
    if (step.do === 'start' || step.do === 'join') joined.add(actor(step));
    if (step.do === 'move' && !['moved', 'refused'].includes(step.expect))
      return `${at}: a move expects moved or refused`;
    if (step.do === 'see' && !(Number.isInteger(step.day) && step.day >= 0)) return `${at}: see needs a day, 0 or more`;
  }
  return null;
}

/** A step's words: who does what, and what it expects or sees. */
function stepWords(step) {
  const detail = step.expect === undefined ? '' : ` (${step.expect})`;
  return `${actor(step)} ${step.do}${detail}${step.day === undefined ? '' : ` day ${step.day}`}`;
}

/**
 * Runs a scenario against the demo server at `server`, saying each step it passes; throws at the first that fails.
 * `days` are the new world's, and `access` how a device meets the server: the scenario's own when it has one, its
 * `access(server)`, or else world.js. A scenario's own steps, its `actions`, each take the access's `stage`, the
 * device of the step's role, on the date its last move gave, so as not to spend the server's limit on joins, and the
 * step, and throw to fail it.
 */
export async function runScenario(scenario, server, { say = () => {}, days = world.worldDays(), access } = {}) {
  const problem = scenarioProblem(scenario);
  if (problem !== null) throw new RangeError(`${scenario.name}: ${problem}`);
  const through = access ?? scenario.access?.(server, scenario.name) ?? world;
  const dates = [days.date, ...days.announcedDays];
  const devices = new Map();
  let started;
  let date = days.date;
  try {
    for (const [index, step] of scenario.steps.entries()) {
      const fail = (what) => new Error(`${scenario.name}, step ${index + 1} (${actor(step)} ${step.do}): ${what}`);
      const device = devices.get(actor(step));
      if (step.do === 'start') {
        started = await through.startWorld(server, scenario.kind, days);
        devices.set(actor(step), started);
      } else if (step.do === 'join') {
        const joined = await through.joinWorld(server, started.code);
        if (joined.kind !== scenario.kind) throw fail(`the world is of kind ${joined.kind}`);
        if (joined.signer !== started.signer) throw fail('its signer is not the one the world was started with');
        devices.set(actor(step), { ...joined, starter: device?.starter ?? null });
      } else if (step.do === 'move') {
        const moved = await through.moveDate(server, device);
        const outcome = moved.status === 200 ? 'moved' : moved.status === 403 ? 'refused' : `answered ${moved.status}`;
        if (outcome !== step.expect) throw fail(`expected ${step.expect}, the server ${outcome}`);
        if (moved.status === 200) date = moved.date;
      } else if (step.do === 'see') {
        const seen = await through.dateOf(server, device);
        if (seen !== dates[step.day]) throw fail(`sees ${seen}, not ${dates[step.day] ?? 'a day the world announces'}`);
      } else {
        device.date = date;
        await scenario.actions[step.do](through.stage, device, step).catch((error) => {
          throw fail(`${error.code === undefined ? '' : `${error.code}: `}${error.message}`);
        });
      }
      say(`${index + 1}. ${stepWords(step)}: ok`);
    }
  } finally {
    through.leave?.();
  }
}
