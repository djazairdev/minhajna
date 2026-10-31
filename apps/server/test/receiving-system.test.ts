// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Opening what is sealed for the stand-in receiving system (#590, answer 618):
// bytes the app's own worldKeyCrypto.seal sealed over the jest world kit for a
// made-up receiving key, which the server opens under the same world and kind
// only, so the two cannot drift apart; and null for bytes too short, a fresh
// half off the curve, or any bit changed.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openDelivery, receiverPoint, SHORTEST } from '../src/state-standins/receiving-system.js';

/** A receiving key, and bytes the app's own worldKeyCrypto sealed for it over the jest world kit. */
const VECTOR = {
  key:
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgE9IqgQzosxnW96zUk9v0XqMQY/3bnMZbGoIWsLioalihRANC' +
    'AASJHcHF2Ti6IFMDJODDUW2tsT1FfMAAIJCCg4a1zzFtFpwP1NDQ4se+TsZhKRrElx8I51enQss7O9oJlKh/j4hO',
  point:
    '04891dc1c5d938ba20530324e0c3516dadb13d457cc0002090828386b5cf316d169c0fd4d0d0e2c7be4ec661291ac497' +
    '1f08e757a742cb3b3bda0994a87f8f884e',
  info: 'minhajna/state-delivery/1\nV0001\nmarks',
  sealed:
    'BAIsHSlFJk3RwnkNyn04+r8f3c/kTv2nK/SvRKw+lRnV+RL7hK96xp1fcO/DIx0REGNn6onb20KkBIkI7EnouKw9lpFtJW+o' +
    'iH0Rc1yPRQ6dvkdaNBBX24mRgtke/NbzAwq+zD4MJ5LpGy4Wee5s+ey8PHl6obh2FWvZqjS0tNvD',
  plain: 'a made-up delivery sealed by the app',
};

describe('opening what is sealed for the stand-in', () => {
  const sealed = Buffer.from(VECTOR.sealed, 'base64');

  it('opens what the app sealed for its key, under the same world and kind only', () => {
    assert.equal(receiverPoint(VECTOR.key), VECTOR.point);
    assert.equal(openDelivery(sealed, VECTOR.key, VECTOR.info)?.toString('utf8'), VECTOR.plain);
    assert.equal(openDelivery(sealed, VECTOR.key, VECTOR.info.replace('marks', 'absences')), null);
    assert.equal(openDelivery(sealed, VECTOR.key, VECTOR.info.replace('V0001', 'V0002')), null);
  });

  it('answers null for bytes too short, a fresh half off the curve, or any bit changed', () => {
    assert.equal(openDelivery(sealed.subarray(0, SHORTEST - 1), VECTOR.key, VECTOR.info), null);
    const offCurve = Buffer.from(sealed);
    offCurve.fill(1, 1, 65);
    assert.equal(openDelivery(offCurve, VECTOR.key, VECTOR.info), null);
    for (const at of [0, 70, 80, sealed.length - 1]) {
      const flipped = Buffer.from(sealed);
      flipped[at] = (flipped[at] ?? 0) ^ 1;
      assert.equal(openDelivery(flipped, VECTOR.key, VECTOR.info), null, `byte ${at}`);
    }
  });
});
