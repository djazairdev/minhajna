// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The seeded schools' shares of the totals, sent from the device that started a
// seeded world (#596, answer 628): once it has moved the world's date onto an
// announced day, and when it enters the world again, for each school seeded
// with the world and each announced day the date has reached, the share the
// term generator's weeks give up to that day (seeded-term.ts), never signed,
// for the term the day falls in, with the staffing the school's timetable
// shows, under the ID its first keyring gives, opened with its seeded device's
// key, as a director's device that took the key would make it, and put on the
// server, a share sent again replacing the first and one the same as the last
// put in the last ten minutes not put again (share-send.ts), so a send that
// failed partway is finished by the next. A seeded school's share stays the
// generator's even once a director took its key and its teachers sign weeks,
// as the director's device sends none for a seeded key. The generator runs on
// the bundled reference data, as the fill does (answer 626), so every device
// works out the same weeks. Schools are sent a few at a time. A school the
// world holds no seeded key for is passed over, and so is a day the server
// does not take; any other answer throws, with world-session.ts's codes and
// those of opening a seeded key.

import {
  schoolStaffing,
  seededShare,
  seededTerm,
  type Day,
  type DemoSchool,
  type SeededSchoolKey,
} from '@minhajna/core';
import { seededWorld } from '../director/director-world';
import { termReference, worldClosure, type TermReference } from '../director/seeded-fill';
import { openSeededRing, seededKeys } from '../director/seeded-key';
import { putShare, sharedDays } from '../director/share-send';
import { worldRequest } from '../network/world-network';
import type { HeldWorld } from './world-calendar-read';
import { kitStep, type Send, type WorldKit } from './world-session';

/** How many schools are sent at once. */
const AT_ONCE = 4;

/** Puts every seeded school's shares for the announced days the world's date reached, and answers how many were put. */
export async function sendSeededShares(
  held: HeldWorld,
  date: Day,
  reference: TermReference,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<number> {
  const days = sharedDays(reference.calendar, date);
  const keys = days.length === 0 ? [] : await seededKeys(held, kit, send);
  if (keys.length === 0) return 0;
  const demo = seededWorld(held.world, reference);
  const closures = [worldClosure(demo, reference)];
  const schools = demo.schools.flatMap((school) => {
    const seeded = keys.find((one) => one.seed === school.id);
    return seeded === undefined ? [] : [{ school, seeded }];
  });
  const refused = new Set<Day>();
  const sendSchool = async ({ school, seeded }: { school: DemoSchool; seeded: SeededSchoolKey }) => {
    const { opened, crypto } = await openSeededRing(held.world, seeded, kit, send);
    const input = { seed: held.world, school, space: seeded.space, reference: termReference(reference), closures };
    const common = { school: opened, directorate: school.directorateId, staffing: schoolStaffing(school) };
    let put = 0;
    for (const { day, from } of days.filter((one) => !refused.has(one.day))) {
      const weeks = await kitStep(() => seededTerm({ ...input, bells: reference.bells, until: day }, kit.mac));
      const share = await kitStep(() => seededShare({ ...common, day, from, weeks }, crypto));
      const answer = await putShare(held.world, share, send);
      if (answer === 'refused') refused.add(day);
      if (answer === 'put') put += 1;
    }
    return put;
  };
  let put = 0;
  for (let at = 0; at < schools.length; at += AT_ONCE) {
    for (const one of await Promise.all(schools.slice(at, at + AT_ONCE).map(sendSchool))) put += one;
  }
  return put;
}
