// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The uses of inspectors' grants in the teacher's access log (#594,
// School-mine, R-5.10-14, R-7.8-05, answer 622): for each grant's notice on the
// teacher's channel, the uses on the stream of each week it names, read with
// the key the notice gives for that week (grant-uses.ts), those that name the
// notice's grant and that week, newest first by the day reported, then by week.
// Each use reads as the inspector's device reported it: the teacher's device
// holds no grant's log key, so it cannot tell a use from one forged by another
// holder of a week's key; the school's devices check them (grant-last-use.ts).
// The log reads them as it opens and again on each reading of the channel or
// change of the world's date, dropping a slower answer; a problem reading them
// is kept, in the catalogue's words, and the grants still show.

import {
  compareDays,
  openGrantUses,
  usePlace as placeOfUses,
  type Day,
  type GrantNotice,
  type GrantUse,
  type SchoolJoined,
  type SignedTimetable,
} from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { spaceBatches } from '../school/space-read';
import { fromHex } from '../storage/history';
import { codeOf } from '../timetable/teacher-session';

type Notices = readonly SignedTimetable<GrantNotice>[];

/** A number for each reading of the notices, so each channel read reads the uses again. */
const readings = new WeakMap<Notices, number>();
let count = 0;
const readingOf = (notices: Notices) => {
  if (!readings.has(notices)) readings.set(notices, (count += 1));
  return readings.get(notices);
};

/** Each grant's uses reported on the teacher's weeks, newest first, by the grant's ID. */
export async function readAccessUses(
  join: SchoolJoined,
  notices: Notices,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ReadonlyMap<string, readonly GrantUse[]>> {
  const found = new Map<string, GrantUse[]>();
  if (notices.length === 0) return found;
  const code = codeOf(join);
  const batches = await spaceBatches(code.world, code.school, send);
  for (const { value } of notices) {
    const uses: GrantUse[] = [];
    for (const { course, week, key } of value.uses) {
      const place = await kitStep(() => placeOfUses(fromHex(key), kit.mac));
      const read = await kitStep(() => openGrantUses(place, batches.get(place.stream) ?? [], kit.cipher));
      uses.push(...read.filter((one) => one.grant === value.grant && one.course === course && one.week === week));
    }
    found.set(
      value.grant,
      uses.sort((a, b) => compareDays(b.day, a.day) || compareDays(a.week, b.week)),
    );
  }
  return found;
}

/** The uses of the grants the notices name, read again on each reading of them or of the world's date. */
export function useAccessUses(join: SchoolJoined, notices: Notices, date: Day, kit: WorldKit, send?: Send) {
  const key = `${date}:${readingOf(notices)}`;
  const [found, setFound] = useState<{ key: string; uses: ReadonlyMap<string, readonly GrantUse[]> } | null>(null);
  const [problem, setProblem] = useState<{ key: string; words: ReturnType<typeof problemOf> } | null>(null);
  const live = useRef(key);
  const read = useEffectEvent(() => readAccessUses(join, notices, kit, send));
  useEffect(() => {
    live.current = key;
    read().then(
      (uses) => live.current === key && setFound({ key, uses }),
      (error: unknown) => live.current === key && setProblem({ key, words: problemOf(error) }),
    );
    return () => {
      live.current = '';
    };
  }, [key]);
  return {
    uses: found?.key === key ? found.uses : null,
    problem: problem?.key === key ? problem.words : null,
  };
}
