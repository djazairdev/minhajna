// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The signed weeks a school's share of the totals counts (#555, #601, answers
// 566, 567 and 631, total-shares.ts): a week counts only when signed with a key
// the school lists for its course, whatever device its certificate names, so no
// other signer adds or replaces one; of each week only the latest correction
// counts, the lower text breaking a tie, since only its signer controls the
// text while anyone can alter an ECDSA signature, a week whose latest
// correction names its subject or an item otherwise than the server takes them
// left out whole; and only weeks with a day between the first day asked for and
// the announced day.

import { checkSignedWeek } from './certify.ts';
import { addDays } from './day.ts';
import { shareable } from './share-grades.ts';
import type { ShareInput } from './total-shares.ts';
import { readWeekTotals, WEEK_TEXT_BYTES, type WeekForTotals } from './week-totals.ts';

interface Checked {
  readonly read: WeekForTotals;
  readonly text: string;
}

/** Whether `a` comes before `b` among a course's weeks: an earlier week, a lower version, a lower text. */
function before(a: Checked, b: Checked): boolean {
  if (a.read.week !== b.read.week) return a.read.week < b.read.week;
  if (a.read.version !== b.read.version) return a.read.version < b.read.version;
  return a.text < b.text;
}

const tooLong = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'text' in value &&
  typeof value.text === 'string' &&
  value.text.length > WEEK_TEXT_BYTES;

/** Each course's weeks that count, in order: under its listed keys, the latest correction of each, in the term. */
export async function countedWeeks({
  weeks,
  signers,
  ca,
  from,
  day,
}: Pick<ShareInput, 'weeks' | 'signers' | 'ca' | 'from' | 'day'>): Promise<WeekForTotals[][]> {
  const latest = new Map<string, Checked>();
  for (const value of weeks) {
    if (tooLong(value)) continue;
    const signed = await checkSignedWeek(value, ca.world, ca.key, ca.checker);
    const read = typeof signed === 'string' ? null : readWeekTotals(signed.text);
    if (typeof signed === 'string' || read === null) continue;
    const { course, week, version } = read;
    if (!signers[course]?.includes(signed.certificate.publicKey) || addDays(week, 6) < from || week > day) continue;
    const one = { read, text: signed.text };
    const held = latest.get(`${course}\n${week}`);
    const kept = held?.read.version ?? -1;
    if (kept > version || (kept === version && held!.text <= one.text)) continue;
    latest.set(`${course}\n${week}`, one);
  }
  const courses = new Map<string, WeekForTotals[]>();
  for (const { read } of [...latest.values()]
    .filter(({ read }) => shareable(read))
    .sort((a, b) => (before(a, b) ? -1 : 1))) {
    courses.set(read.course, [...(courses.get(read.course) ?? []), read]);
  }
  return [...courses.values()];
}
