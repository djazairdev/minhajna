// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's bands (#626, answer 678): every share in a band, near 0%
// and 100% too; for a share of few classes, neighbouring bands merged until
// each holds two counts at least; frozen, and only for a whole number of
// classes from 0 to the most a world keeps.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bandOf, BANDS, bandsFor } from '../src/insights/bands.js';

describe('the observatory’s bands', () => {
  it('bands every share, near 0% and 100% too, and never pins one count in a small figure', () => {
    assert.deepEqual(bandsFor(40), BANDS);
    assert.deepEqual(bandOf(0, 40), [0, 5]);
    assert.deepEqual(bandOf(2, 40), [5, 15]);
    assert.deepEqual(bandOf(20, 40), [50, 70]);
    assert.deepEqual(bandOf(38, 40), [95, 100]);
    assert.deepEqual(bandOf(40, 40), [95, 100]);
    assert.deepEqual(bandsFor(10), [
      [0, 15],
      [15, 50],
      [50, 70],
      [70, 85],
      [85, 100],
    ]);
    assert.deepEqual(bandOf(0, 10), [0, 15]);
    assert.deepEqual(bandOf(10, 10), [85, 100]);
    assert.deepEqual(bandsFor(1), [[0, 100]]);
    assert.deepEqual(bandOf(0, 0), [0, 100]);
    for (let whole = 2; whole <= 60; whole += 1) {
      const bands = bandsFor(whole);
      const counts = bands.map(() => 0);
      for (let part = 0; part <= whole; part += 1) {
        const [low] = bandOf(part, whole);
        counts[bands.findIndex((band) => band[0] === low)]! += 1;
      }
      assert.ok(
        counts.every((count) => count >= 2),
        `whole ${whole}`,
      );
    }
  });

  it('freezes its bands and takes only a whole number of classes a world can hold', () => {
    assert.ok(Object.isFrozen(bandsFor(10)) && Object.isFrozen(bandsFor(10)[0]) && Object.isFrozen(BANDS[0]));
    for (const whole of [1.5, -1, 4097, Number.NaN]) assert.throws(() => bandsFor(whole), RangeError);
  });
});
