// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The bands the observatory shows a share in (#626, answer 678), never the
// share itself: under 5%, 5% to under 15%, 15–30%, 30–50%, 50–70%, 70–85%,
// 85–95%, and 95% and over, as Obs-Report draws them. For a share of few
// classes, neighbouring bands are merged until each holds two of the counts the
// share can take at least, so no band pins one count: at 10 classes, 0–15%,
// 15–50%, 50–70%, 70–85% and 85–100%. Bands of different figures may still
// narrow a count together, as a nation's and a wilaya's of one item, down to a
// group's exact count, even none or all of its classes, which then tells every
// class of the group alike, though never one class apart from others, as each
// figure shown covers at least 10 teachers and 3 schools; answer 678 states it
// as a limit of the method.

import { MAX_SENDINGS } from './insight-store.js';

export type Band = readonly [number, number];

/** The bands a share is shown in, in percent, each from its low end up to under its high end, the last up to 100. */
export const BANDS: readonly Band[] = Object.freeze(
  (
    [
      [0, 5],
      [5, 15],
      [15, 30],
      [30, 50],
      [50, 70],
      [70, 85],
      [85, 95],
      [95, 100],
    ] as const
  ).map((band) => Object.freeze(band)),
);

const byWhole = new Map<number, readonly Band[]>();

/** The bands for shares of `whole` classes, from 0 to MAX_SENDINGS, neighbours merged until each holds two counts. */
export function bandsFor(whole: number): readonly Band[] {
  if (!Number.isSafeInteger(whole) || whole < 0 || whole > MAX_SENDINGS)
    throw new RangeError('No such number of classes');
  const known = byWhole.get(whole);
  if (known !== undefined) return known;
  const bands = Object.freeze(merged(whole).map((band) => Object.freeze(band)));
  byWhole.set(whole, bands);
  return bands;
}

function merged(whole: number): Band[] {
  if (whole < 2) return [[0, 100]];
  const percents = Array.from({ length: whole + 1 }, (_, count) => (100 * count) / whole);
  const held = ([low, high]: Band) =>
    percents.filter((percent) => percent >= low && (percent < high || high === 100)).length;
  const bands: Band[] = [...BANDS];
  for (let at = bands.findIndex((band) => held(band) < 2); at >= 0; at = bands.findIndex((band) => held(band) < 2)) {
    const into = at === bands.length - 1 ? at - 1 : at + 1;
    const [first, second] = [bands[Math.min(at, into)]!, bands[Math.max(at, into)]!];
    bands.splice(Math.min(at, into), 2, [first[0], second[1]]);
  }
  return bands;
}

/** The band a share of `part` in `whole` classes falls in. */
export function bandOf(part: number, whole: number): Band {
  const bands = bandsFor(whole);
  const percent = whole === 0 ? 0 : (100 * part) / whole;
  return bands.find(([, high]) => percent < high) ?? bands[bands.length - 1]!;
}
