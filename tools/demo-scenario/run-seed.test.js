// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A scenario's kit is seeded by its name alone, so a local or CI run plays the
// same world each time; a run that names itself, on a server that keeps its
// worlds, draws a world of its own.

import assert from 'node:assert/strict';
import process from 'node:process';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { appAccess, runSeed } from './device.js';

const NAME = 'A made-up school';
const VARIABLE = 'MINHAJNA_SCENARIO_RUN';
const had = process.env[VARIABLE];

/** The first bytes the kit of a device access draws, on what the variable holds now. */
const drawn = () => appAccess('http://demo', NAME).stage.kit.random(16);

describe('the seed of a scenario’s kit', () => {
  beforeEach(() => {
    delete process.env[VARIABLE];
  });

  afterEach(() => {
    if (had === undefined) delete process.env[VARIABLE];
    else process.env[VARIABLE] = had;
  });

  it('is the name alone with no run, or an empty one', () => {
    assert.equal(runSeed(NAME, undefined), NAME);
    assert.equal(runSeed(NAME, ''), NAME);
  });

  it('draws the same with no run, and another for each run, the same for that run', () => {
    const alone = drawn();
    assert.deepEqual(drawn(), alone);
    process.env[VARIABLE] = '41-1';
    const first = drawn();
    assert.notDeepEqual(first, alone);
    assert.deepEqual(drawn(), first);
    process.env[VARIABLE] = '41-2';
    assert.notDeepEqual(drawn(), first);
  });
});
