// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario in a teachers' world (#631, answer 722), through the app's own
// sessions (device.js): before the teacher opts in, no sending leaves the
// device. Once they turn it on, the term that has ended goes out, one sending
// for each class with a pack, and trying again sends nothing more. A sending
// names no teacher, school, class, pupil or date. A device without the starter
// token only waits for a term whose collection is open; the device holding it
// ends the collection, and the observatory reports the term's packs, the
// teacher's arriving with the seeded ones among the nation's classes.

import { createHash } from 'node:crypto';
import { endedTerm, insightsState, seedInsights, sentSendings, worldTeacher } from '@minhajna/core';
import { appModule } from './app.js';
import { appAccess } from './device.js';
import { worldKit } from './kit.js';
import { see } from './school-join.js';

const { seededWorld } = await appModule('director/director-world.ts');
const { sendDueInsights } = await appModule('insights/send-insights.ts');
const { termReference } = await appModule('director/seeded-fill.ts');
const { packFigures } = await appModule('observatory/figures-read.ts');
const { readTerm } = await appModule('observatory/use-term-figures.ts');

/** The teacher's sending attempt, as the page's switch makes it. */
function trying(stage, device) {
  const { reference, kit, send } = stage;
  const mine = worldTeacher(seededWorld(device.world, reference));
  see(mine !== null, 'the world has no teacher');
  const input = {
    world: device.world,
    mine,
    date: device.date,
    book: device.book,
    reference,
    kit,
    digest: async (text) => createHash('sha256').update(text).digest('hex'),
    send,
  };
  return { mine, attempt: () => sendDueInsights(input) };
}

async function stayOff(stage, device) {
  const state = insightsState(device.kind, device.date, [], [stage.reference.calendar]);
  see(state.kind === 'teacher', `the world's teacher reads the insights as ${state.kind}`);
  const { taken } = await trying(stage, device).attempt();
  see(taken === 0, `${taken} sendings left a device that did not opt in`);
}

async function optIn(stage, device) {
  const { mine, attempt } = trying(stage, device);
  await device.book.record(device.date, { kind: 'insights.choice', choice: { on: true } });
  const rooms = mine.school.classes.filter((one) => mine.teacher.classIds.includes(one.id));
  const withPack = rooms.filter((one) => one.packs[mine.teacher.subject] !== undefined).length;
  const { taken, unsent, late } = await attempt();
  see(taken === withPack && unsent === 0 && late === 0, `${taken} sendings of ${withPack}, ${unsent} and ${late} not`);
  const sent = sentSendings(device.book.entries);
  see(sent.length === taken, `the log keeps ${sent.length} of ${taken} sendings`);
  const { school, teacher } = mine;
  const people = [teacher, school, ...rooms, ...rooms.flatMap((one) => one.pupils)];
  const named = people.flatMap((one) => [one.name, one.latinName, one.id, one.registration]).filter(Boolean);
  for (const { text } of sent) {
    see(!named.some((name) => text.includes(name)), 'a sending names a person, a school or a class');
    see(!/\d{4}-\d{2}-\d{2}/.test(text), 'a sending carries a date');
  }
  const again = await attempt();
  see(again.taken === 0, `trying again sent ${again.taken} more`);
  const { year } = stage.reference.calendar;
  const { pack } = JSON.parse(sent[0].text);
  stage.paper.set('term', { year: year.id, term: endedTerm(year, device.date).number });
  stage.paper.set('pack', pack);
  stage.paper.set('taken', sent.filter((one) => JSON.parse(one.text).pack === pack).length);
}

/** How many of the world's seeded sendings are for the term and the pack. */
function seededFor(stage, device, { year, term }, pack) {
  const { reference } = stage;
  const seeded = seedInsights(seededWorld(device.world, reference), termReference(reference), worldKit.random);
  return seeded.filter((one) => one.year === year && one.term === term && one.pack === pack).length;
}

async function report(stage, device) {
  const { send, paper } = stage;
  const asked = paper.get('term');
  const live = () => true;
  see((await readTerm(device.world, null, asked, send, live)) === 'waiting', 'a term open reads its figures');
  const packs = await readTerm(device.world, device.starter, asked, send, live);
  const pack = paper.get('pack');
  const at = Array.isArray(packs) ? packs.findIndex((one) => one.pack === pack) : -1;
  see(at !== -1, `the term reports ${JSON.stringify(packs)}, not the teacher's pack`);
  const { nation, setAside } = await packFigures(device.world, asked, at, send);
  see(nation !== null && nation.items.length > 0, 'the nation’s figures hold no item');
  const expected = seededFor(stage, device, asked, pack) + paper.get('taken');
  see(setAside === 0, `${setAside} sendings were set aside as outliers`);
  see(nation.classes === expected, `the nation counts ${nation.classes} classes, not the ${expected} sent`);
}

export const INSIGHTS = {
  name: 'A teachers’ world: a teacher opts in, and the observatory reports',
  kind: 'teachers',
  access: appAccess,
  actions: { stayOff, optIn, report },
  steps: [
    { as: 'observatory', do: 'start' },
    { as: 'teacher', do: 'join' },
    { as: 'teacher', do: 'stayOff' },
    { as: 'teacher', do: 'optIn' },
    { as: 'observatory', do: 'report' },
  ],
};
