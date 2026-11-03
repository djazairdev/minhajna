// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curriculum report's range across the wilayas on N-Totals (#599, answers
// 539, 549 and 630): for a subject, how far each wilaya's classes got on
// average, of the wilayas whose figure for it is shown and holds a class, as a
// range from the lowest to the highest and the middle half, never naming or
// ranking a wilaya; the middle half runs from the average a quarter of the way
// up the sorted list to the one three quarters up, at the nearest rank below
// and above. With fewer than 8 such wilayas there is no range. The core's
// wilayaRange (floors.ts) counts the wilayas over the floor, which a page
// cannot see, and interpolates, where this takes the nearest ranks, so every
// number shown is a real average (answer 630); both need RANGE_WILAYAS.

import { RANGE_WILAYAS } from '@minhajna/core';
import { averageReached } from '../directorate/CurriculumReport';
import type { MinistryFigures } from '../directorate/totals-read';
import { figureFor } from './wilaya-rows';

/** A range of the wilayas' averages, in whole percent. */
export interface ReportRange {
  readonly low: number;
  readonly high: number;
  readonly middleLow: number;
  readonly middleHigh: number;
}

/** The wilayas' range for a subject, or null with fewer than 8 wilayas shown that hold a class. */
export function reportRange(figures: MinistryFigures, subject: string): ReportRange | null {
  const averages = figures.directorates
    .map(([, own]) => figureFor(own, subject))
    .flatMap((figure) => (figure === null || figure.classes === 0 ? [] : [averageReached(figure)]))
    .sort((a, b) => a - b);
  const last = averages.length - 1;
  if (averages.length < RANGE_WILAYAS) return null;
  return {
    low: averages[0],
    high: averages[last],
    middleLow: averages[Math.floor(last / 4)],
    middleHigh: averages[Math.ceil((3 * last) / 4)],
  };
}
