// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A grant's last access as the director's device checks it (#594, D-Substitute,
// R-5.10-14, answer 622): for each week the school's record of the grant names,
// the device derives the key of that week's uses from the grant's log key and
// reads the uses on its stream of the school's space (grant-uses.ts), keeping
// only those that check against that record (checkUse), since anyone holding a
// week's key could post one; the last access is the latest day among them, or
// null before any. A grant whose log epoch the keyring lacks gives none.

import {
  checkUse,
  compareDays,
  grantUseKey,
  openGrantUses,
  usePlace as placeOfUses,
  type Day,
  type Grant,
  type SealedBatch,
} from '@minhajna/core';
import { kitStep, type WorldKit } from '../demo/world-session';
import type { HeldDesk } from './issue-session';

/** The latest day a use of the grant that checks was reported for, or null before any. */
export async function lastUseOf(
  desk: Pick<HeldDesk, 'opened' | 'crypto'>,
  grant: Grant,
  batches: ReadonlyMap<string, readonly SealedBatch[]>,
  kit: WorldKit,
): Promise<Day | null> {
  if (grant.log.epoch >= desk.opened.keys.length) return null;
  let last: Day | null = null;
  for (const { course, week } of grant.weeks) {
    const key = await kitStep(() => grantUseKey(desk.opened, grant, course, week, desk.crypto));
    const place = await kitStep(() => placeOfUses(key, kit.mac));
    const uses = await kitStep(() => openGrantUses(place, batches.get(place.stream) ?? [], kit.cipher));
    for (const use of uses) {
      const checks = await kitStep(() => checkUse(desk.opened, grant, use, desk.crypto));
      if (checks && (last === null || compareDays(use.day, last) > 0)) last = use.day;
    }
  }
  return last;
}
