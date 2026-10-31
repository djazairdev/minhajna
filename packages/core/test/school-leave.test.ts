// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Leaving a school for another (#567, answer 589): membership lasts to the
// school year's 31 August, the new school's begins on 1 September, and its
// classes come from the next year; a year not written as two following years
// has no dates.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { leavingDates } from '../src/index.ts';

describe('leaving a school', () => {
  it('ends membership on the year’s 31 August and starts the next school on 1 September', () => {
    assert.deepEqual(leavingDates('2026-2027'), { until: '2027-08-31', from: '2027-09-01', next: '2027-2028' });
    assert.deepEqual(leavingDates('2029-2030'), { until: '2030-08-31', from: '2030-09-01', next: '2030-2031' });
  });

  it('gives no dates for a year not written as two following years', () => {
    for (const year of ['2026', '2026-2028', '2027-2026', '26-27', ' 2026-2027'])
      assert.equal(leavingDates(year), null);
  });
});
