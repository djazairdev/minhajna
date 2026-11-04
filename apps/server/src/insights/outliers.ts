// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setting aside the sendings no real class would send (#628, R-1.6-16, answer
// 679), before a term's figures are formed, on top of the rate limits and the
// floors: the code is public, and a token, a sending ID and a school's code can
// each be made up. Nothing is refused or erased, so a sender learns nothing of
// the rules, which the method publishes whole. Two rules. A token is one
// teacher's for one term, so a token whose sendings in the term name more than
// one wilaya, or more than MOST_TOKEN_COURSES courses over every pack, is set
// aside with every sending it holds, and one made-up token never weighs like
// many classes. Then within each pack and release still holding FENCE_SENDINGS
// sendings at least, a sending whose sessions over the term add up to a total
// over the upper far fence, past the upper quartile by FENCE_REACH times the
// distance between the quartiles, is set aside, so inflated sessions leave the
// medians and shares be. The distance is taken as twice the median at least,
// and one session, so the fence stands some seven medians up or more: classes
// that logged the whole term among many that began late are kept, and a made-up
// sending must stay under it to count, which bounds its pull on the figures.
// There is no lower fence: a low total cannot be told from a class that began
// logging late. A pack with fewer sendings draws no fence: the floors hide the
// smallest figures and the bands coarsen the rest. Sendings that are most of a
// pack outweigh any fence, a limit answer 678 states for made-up senders.

import { quantile, sortedOf } from './quantile.js';
import type { KeptSending } from './sending-read.js';

/** The most courses, a class in a subject, one teacher sends a term. */
export const MOST_TOKEN_COURSES = 24;
/** The fewest sendings of a pack and release before its fences are drawn. */
export const FENCE_SENDINGS = 20;
/** How far past the upper quartile the far fence stands, in distances between the quartiles. */
export const FENCE_REACH = 3;

/** The tokens of the term's sendings that name more than one wilaya, or more than MOST_TOKEN_COURSES courses. */
export function floodedTokens(sendings: readonly KeptSending[]): ReadonlySet<string> {
  const byToken = new Map<string, KeptSending[]>();
  for (const one of sendings) {
    const held = byToken.get(one.token);
    if (held === undefined) byToken.set(one.token, [one]);
    else held.push(one);
  }
  const flooded = [...byToken].filter(
    ([, held]) => held.length > MOST_TOKEN_COURSES || new Set(held.map((one) => one.wilaya)).size > 1,
  );
  return new Set(flooded.map(([token]) => token));
}

/** The total of the sessions a sending spent over the term. */
function totalOf(sending: KeptSending): number {
  let total = 0;
  for (const item in sending.sessions) total += sending.sessions[item]!;
  return total;
}

/** One pack and release's sendings without those whose total sessions lie over the upper far fence. */
export function withinFences(sendings: readonly KeptSending[]): KeptSending[] {
  if (sendings.length < FENCE_SENDINGS) return [...sendings];
  const totals = sendings.map(totalOf);
  const sorted = sortedOf(totals);
  const [median, high] = [quantile(sorted, 0.5), quantile(sorted, 0.75)];
  const fence = high + FENCE_REACH * Math.max(high - quantile(sorted, 0.25), 2 * median, 1);
  return sendings.filter((_, at) => totals[at]! <= fence);
}
