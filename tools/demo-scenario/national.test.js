// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario above the school can run and use every step it brings, and goes
// through the app's own sessions; playing it needs the demo server, which CI
// runs.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appAccess } from './device.js';
import { NATIONAL } from './national.js';
import { scenarioProblem } from './scenario.js';

describe('the scenario above the school', () => {
  for (const scenario of [NATIONAL]) {
    it(`${scenario.name}: can run, through the app, and uses every step it brings`, () => {
      assert.equal(scenarioProblem(scenario), null);
      assert.equal(scenario.access, appAccess);
      const used = new Set(scenario.steps.map((step) => step.do));
      for (const action of Object.keys(scenario.actions)) assert.ok(used.has(action), action);
    });
  }
});
