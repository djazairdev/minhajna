// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's page set up for its tests (#604, answer 638): a world on a
// made-up demo server, its keys held, moved onto a day; the mock exam and the
// BEM of the bundled calendar; a made-up school whose 4th grade pins plans for
// math and French; made-up shares of its grade for a day, from enough schools
// of the directorate and another to clear the floors; and the page for a date.
// Every world, school and share is made up.

import { worldExams, type Day } from '@minhajna/core';
import { randomBytes } from 'node:crypto';
import type { HeldWorld } from '../src/demo/world-calendar-read';
import { startWorld, type Send } from '../src/demo/world-session';
import { readTotals } from '../src/directorate/totals-read';
import { CommitteePage, type CommitteePageProps } from '../src/threshold/CommitteePage';
import ar from '../src/text/ar.json';
import { quoted } from './threshold-page';
import { calendar, reference } from './world-calendar';
import { DemoServer, nodeKit as kit } from './world-server';

export const server = new DemoServer();
export const SCOPE = 'dir-1';
const exams = worldExams(calendar.year, calendar.entries);
export const mock = exams.find((one) => one.id === 'mock')!;
export const bem = exams.find((one) => one.id === 'bem')!;
export const pack = reference.packs.find((one) => one.items.length >= 4)!;
export const items = pack.items.map((one) => one.id);
const pinned = { id: pack.id, release: pack.release };
export const schools = [
  { classes: [{ id: 'c-1', grade: '4am', name: '1', pupils: [], packs: { math: pinned, french: pinned } }] },
];

/** A world started on the server, its keys held. */
export async function started(): Promise<HeldWorld> {
  const one = await startWorld('national', calendar, kit, server.send);
  return { world: one.keys.world, keys: one.keys, sealing: one.sealing };
}

/** Moves a world on the server onto a day, announced from now on. */
export function onDay(world: string, day: Day) {
  const kept = server.worlds.get(world)!;
  kept.date = day;
  kept.announced = [...new Set([...kept.announced, mock.figuresDay, day])];
}

/** Puts 4 schools' shares of a subject for a day, 10 classes each a directorate; `counts` by item, by school. */
export function putShares(
  world: string,
  day: Day,
  counts: Record<string, number> | ((school: number, directorate: string) => Record<string, number>),
  options: {
    readonly subject?: string;
    readonly teachers?: number;
    readonly closed?: number;
    readonly directorates?: readonly string[];
  } = {},
) {
  const { subject = 'math', teachers = 2, closed = 3, directorates = [SCOPE, 'dir-2'] } = options;
  for (const directorate of directorates) {
    for (let school = 0; school < 4; school += 1) {
      const id = randomBytes(32).toString('hex');
      const items = typeof counts === 'function' ? counts(school, directorate) : counts;
      const figure = {
        teachers,
        vacantPosts: 0,
        hoursWithoutTeacher: 0,
        classes: 10,
        cover: 0,
        closed,
        reached: 100,
        runLong: 0,
        items: {},
        grades: { '4am': { teachers, classes: 10, items } },
      };
      const share = { format: 'minhajna/total-share/1', id, day, directorate, subjects: { [subject]: figure } };
      server.shares.set(`${world}\n${day}\n${id}`, share);
    }
  }
}

/** The page's props for a date, its days written `day …`. */
export const pageOf = (
  held: HeldWorld | null,
  world: string,
  date: Day,
  send: Send = server.send,
  more: Partial<CommitteePageProps> = {},
) => (
  <CommitteePage
    world={world}
    date={date}
    level="directorate"
    scope={SCOPE}
    held={held}
    reference={reference}
    schools={schools}
    packs={reference.packs}
    read={(day) => readTotals(world, day, SCOPE, send)}
    kit={kit}
    send={send}
    dayText={(day) => `day ${day}`}
    {...more}
  />
);

export const words = ar.demo.committee;
export const page = ar.demo.threshold;
export const day = mock.figuresDay;
/** A catalogue's text with its values filled in. */
export const fill = (text: string, values: Record<string, unknown>) =>
  Object.entries(values).reduce((all, [key, value]) => all.replaceAll(`{{${key}}}`, String(value)), text);
/** A plan item's title, quoted, by its place. */
export const title = (at: number) => quoted(pack.items[at].title);
/** A seat's post, counted from 1. */
export const seat = (n: number) => fill(words.seat, { n });

/** A world on a date with the figures day's shares: all classes at item 1, 9 in 10 at item 2, half at item 3. */
export async function opened(
  date: Day = day,
  counts: Parameters<typeof putShares>[2] = { [items[0]]: 10, [items[1]]: 9, [items[2]]: 5 },
) {
  const held = await started();
  onDay(held.world, date);
  putShares(held.world, day, counts);
  return { held, id: held.world };
}

/** A room of the mock exam's math, for a seat's vote put from outside the page. */
export const mathRoom = (world: string) => ({
  name: { world, scope: SCOPE, exam: 'mock', subject: 'math', grade: '4am' },
  items,
  days: { from: day, to: mock.signBy },
  lastDay: mock.to,
});
