// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The seeded schools' shares of the totals, sent from the device that started a
// seeded world (#596, answer 628): once it has moved the world's date onto an
// announced day, for each school seeded with the world, the share the term
// generator's weeks give up to that day (seeded-term.ts), never signed, for the
// term the day falls in, with the staffing the school's timetable shows, under
// the ID its first keyring gives, opened with its seeded device's key, as a
// director's device that took the key would make it, and put on the server, a
// share sent again replacing the first. The generator runs on the bundled
// reference data, as the fill does (answer 626), so every device works out the
// same weeks. A school the world holds no seeded key for is passed over, and so
// is every school when the server does not take the day; any other answer
// throws, with world-session.ts's codes and those of opening a seeded key.

import { schoolStaffing, seededShare, seededTerm, type Day } from '@minhajna/core';
import { seededWorld } from '../director/director-world';
import { termReference, worldClosure, type TermReference } from '../director/seeded-fill';
import { openSeededRing, seededKeys } from '../director/seeded-key';
import { termStart } from '../director/share-send';
import { worldRequest } from '../network/world-network';
import type { HeldWorld } from './world-calendar-read';
import { kitStep, unexpected, type Send, type WorldKit } from './world-session';

/** Puts every seeded school's share for the announced day the world's date moved onto, and answers how many. */
export async function sendSeededShares(
  held: HeldWorld,
  day: Day,
  reference: TermReference,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<number> {
  const from = termStart(reference.calendar, day);
  const keys = await seededKeys(held, kit, send);
  if (from === null || keys.length === 0) return 0;
  const demo = seededWorld(held.world, reference);
  const closures = [worldClosure(demo, reference)];
  let sent = 0;
  for (const school of demo.schools) {
    const seeded = keys.find((one) => one.seed === school.id);
    if (seeded === undefined) continue;
    const { opened, crypto } = await openSeededRing(held.world, seeded, kit, send);
    const input = { seed: held.world, school, space: seeded.space, reference: termReference(reference) };
    const weeks = await kitStep(() => seededTerm({ ...input, closures, bells: reference.bells, until: day }, kit.mac));
    const common = { school: opened, day, from, directorate: school.directorateId, staffing: schoolStaffing(school) };
    const share = await kitStep(() => seededShare({ ...common, weeks }, crypto));
    const answer = await send({ method: 'PUT', path: `/worlds/${held.world}/totals/${day}/shares`, body: share });
    if (answer.status === 422) return sent;
    if (answer.status !== 200 && answer.status !== 201) throw unexpected(answer);
    sent += 1;
  }
  return sent;
}
