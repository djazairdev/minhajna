// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Totals rendered for its tests (#598): a made-up demo server, made-up shares
// put on it for a day, every directorate's schools with math and French, two of
// them with Arabic and a second French item too, a world moved onto its
// announced days, the page for a directorate and the Ministry's (#599), a row's
// words, and the shares a day holds.

import type { Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { randomBytes } from 'node:crypto';
import { Text, type TextProps } from 'react-native';
import type { Share } from '../../server/src/totals/share-read';
import { moveWorldDate, startWorld, type Send } from '../src/demo/world-session';
import { DirectorateTotals } from '../src/directorate/DirectorateTotals';
import { MinistryTotals } from '../src/ministry/MinistryTotals';
import { rendered, show } from './grant-page';
import { calendar, reference } from './world-calendar';
import { DemoServer, nodeKit } from './world-server';

export const server = new DemoServer();
export const OWN = 'dir-a';

const item = (sessions: number) => ({ sessions, merged: 0, skipped: 1, retaught: 0 });

/** A made-up share's subject: its teachers, fixed counts, and one plan item, or two. */
export const subject = (teachers: number, more = false) => ({
  teachers,
  vacantPosts: 1,
  hoursWithoutTeacher: 3,
  classes: 4,
  cover: 2,
  closed: 5,
  reached: 1200,
  runLong: 1,
  items: more ? { 'u1-2': item(6), 'u1-3': item(2) } : { 'u1-2': item(6) },
});

/** Puts a made-up share for a day. */
export function putShare(world: string, day: Day, directorate: string, subjects: Record<string, unknown>) {
  const id = randomBytes(32).toString('hex');
  server.shares.set(`${world}\n${day}\n${id}`, { format: 'minhajna/total-share/1', id, day, directorate, subjects });
}

/** Puts made-up shares for a day, `schools` for each directorate. */
export function put(world: string, day: Day, directorates: readonly string[], schools = 4) {
  for (const directorate of directorates) {
    for (let at = 0; at < schools; at += 1) {
      const both = { math: subject(3), french: subject(4, at < 2) };
      putShare(world, day, directorate, at < 2 ? { arabic: subject(2), ...both } : both);
    }
  }
}

/** Starts a national world and moves its date `moves` times, answering its ID and the dates it had. */
export async function world(moves = 1) {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const days = [started.date];
  for (let at = 0; at < moves; at += 1)
    days.push(await moveWorldDate(started.keys.world, started.starter, days.at(-1)!, server.send));
  return { id: started.keys.world, days };
}

/** Renders M-Totals for a directorate, or renders it again in place, and settles its answers. */
export const page = (id: string, date: Day, send: Send = server.send, directorate = OWN) =>
  show(
    <LocaleDirContext.Provider value="rtl">
      <DirectorateTotals
        world={{ world: id, date }}
        school={{ directorateId: directorate }}
        wilaya="ولاية مختلقة"
        calendars={[calendar]}
        send={send}
        dayText={(day) => `day ${day}`}
        subjectName={(code) => `subject ${code}`}
        bundled={reference}
      />
    </LocaleDirContext.Provider>,
  );

/** Renders N-Totals, or renders it again in place, and settles its answers. */
export const ministryPage = (id: string, date: Day, send: Send = server.send) =>
  show(
    <LocaleDirContext.Provider value="rtl">
      <MinistryTotals
        world={{ world: id, date }}
        calendars={[calendar]}
        send={send}
        dayText={(day) => `day ${day}`}
        subjectName={(code) => `subject ${code}`}
        bundled={reference}
      />
    </LocaleDirContext.Provider>,
  );

/** The words of the element with this test ID, in order. */
export const row = (testID: string) =>
  rendered()
    .root.findByProps({ testID })
    .findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));

/** The shares a world holds for a day. */
export const shares = (id: string, day: Day) =>
  [...server.shares].filter(([key]) => key.startsWith(`${id}\n${day}\n`)).map(([, share]) => share as Share);
