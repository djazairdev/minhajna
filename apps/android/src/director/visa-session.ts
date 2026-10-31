// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's visa on a signed week in a demo world (#585, D-Record,
// R-7.5-14, answer 613): with the school key held on this device, not started,
// and this device's signing key, certified once for the world and kept in
// memory (send-session.ts), the visa on the week's version, with the world's
// day, is signed and put on the channel of the code or key the week came under;
// a version that already has a visa, given meanwhile from any device, is
// refused with E_WEEK_VISAED before anything is put, and a world's date before
// the week's first day with E_VISA_EARLY before anything is signed. Other
// errors carry world-session.ts's codes and those of holding the school key.

import { channelVisas, sealVisa, signVisa, type WeekVisa } from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey } from '../school/space-read';
import { putOnChannel, signingKey } from '../timetable/send-session';
import { holdSchool, joinCode } from './issue-session';
import type { RecordedWeek } from './records-session';

type VisaWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** Gives the director's visa on a signed week at its version, on the world's day; refused when it has one. */
export async function giveVisa(world: VisaWorld, week: RecordedWeek, kit: WorldKit, send: Send = worldRequest) {
  if (world.date < week.week.week) throw failed('The world’s date is before the week', 'E_VISA_EARLY');
  const desk = await holdSchool(world, kit, send, false);
  const ca = await caKey(world.world, send);
  const key = await signingKey(world.world, desk, ca, kit, send);
  const code = await joinCode(world.world, desk, week.issue);
  const { course, week: first, version } = week.week;
  const visa: WeekVisa = {
    world: world.world,
    school: desk.held.school,
    assignment: week.issue.assignment,
    issue: week.issue.issue,
    course,
    week: first,
    version,
    day: world.date,
  };
  const signed = await kitStep(() => signVisa(visa, key.certificate, key.signer));
  await putOnChannel(code, ca, kit, send, async ({ batches, joined }, at) => {
    const given = await kitStep(() =>
      channelVisas(code, batches, { key: ca, checker: kit }, joined, kit.cipher, kit.mac),
    );
    if (given.some((one) => one.value.course === course && one.value.week === first && one.value.version === version))
      throw failed('This version of the week has its visa', 'E_WEEK_VISAED');
    return (await kitStep(() => sealVisa(code, signed, at, kit.cipher, kit.mac))).batches;
  });
}
