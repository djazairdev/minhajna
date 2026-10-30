// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's code (#539): 20 characters read as typed, a check that
// refuses typing mistakes, and a first half that is all the server receives.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RECOVERY_ALPHABET,
  WORLD_CODE_LENGTH,
  makeWorldCode,
  readWorldCode,
  worldCodeGroups,
  worldCodeSecret,
  worldIdOfCode,
} from '../src/index.ts';
import { deps } from './support.ts';

const BYTES = Uint8Array.from([0x3a, 0x91, 0x07, 0xc4, 0x5e, 0xb2, 0x68, 0x0d, 0xf3, 0x29, 0x84, 0x1b]);
const CODE = makeWorldCode(() => BYTES);

function arabicDigits(text: string): string {
  return text.replace(/\d/g, (digit) => String.fromCharCode(0x0660 + Number(digit)));
}

describe('the world code', () => {
  it('draws 20 characters from the 32 that cannot be misread, and every code reads back', () => {
    const seen = new Set<string>();
    for (let round = 0; round < 300; round++) {
      const code = makeWorldCode(deps.random);
      assert.equal(code.length, WORLD_CODE_LENGTH);
      assert.deepEqual(readWorldCode(code), { code });
      assert.deepEqual(readWorldCode(worldCodeGroups(code).join('-')), { code });
      for (const one of code) seen.add(one);
    }
    assert.equal(seen.size, RECOVERY_ALPHABET.length);
  });

  it('turns 12 bytes into 19 characters and a check', () => {
    assert.equal(
      makeWorldCode(() => new Uint8Array(12)),
      '0'.repeat(20),
    );
    assert.equal(
      makeWorldCode(() => new Uint8Array(12).fill(255)),
      `${'Z'.repeat(19)}K`,
    );
    assert.throws(() => makeWorldCode(() => new Uint8Array(11)), RangeError);
  });

  it('reads a code as someone types it or reads it aloud', () => {
    const groups = worldCodeGroups(CODE);
    assert.equal(groups.length, 4);
    assert.ok(groups.every((group) => group.length === 5));
    assert.equal(groups.join(''), CODE);
    for (const typed of [
      groups.join(' ').toLowerCase(),
      ` ${groups.join('\n')}\t`,
      arabicDigits(groups.join('-')),
      CODE.replace(/0/g, 'O').replace(/1/g, 'l'),
    ]) {
      assert.deepEqual(readWorldCode(typed), { code: CODE });
    }
  });

  it('refuses a code of the wrong length or with a character no code holds', () => {
    assert.deepEqual(readWorldCode(''), { problem: 'length' });
    assert.deepEqual(readWorldCode(CODE.slice(0, 19)), { problem: 'length' });
    assert.deepEqual(readWorldCode(`${CODE}0`), { problem: 'length' });
    assert.deepEqual(readWorldCode(worldIdOfCode(CODE)), { problem: 'length' });
    assert.deepEqual(readWorldCode(`U${CODE.slice(1)}`), { problem: 'character' });
    assert.deepEqual(readWorldCode(`${CODE.slice(0, 7)}#${CODE.slice(8)}`), { problem: 'character' });
  });

  it('refuses every single mistyped character', () => {
    for (let at = 0; at < WORLD_CODE_LENGTH; at++) {
      for (const one of RECOVERY_ALPHABET) {
        if (one === CODE[at]) continue;
        const typed = CODE.slice(0, at) + one + CODE.slice(at + 1);
        assert.deepEqual(readWorldCode(typed), { problem: 'check' }, typed);
      }
    }
  });

  it('refuses two neighbours swapped, unless they are 0 and Z', () => {
    let caught = 0;
    for (let round = 0; round < 100; round++) {
      const code = makeWorldCode(deps.random);
      for (let at = 0; at < WORLD_CODE_LENGTH - 1; at++) {
        const [left, right] = [code[at]!, code[at + 1]!];
        if (left === right) continue;
        const swapped = code.slice(0, at) + right + left + code.slice(at + 2);
        const blind = (left === '0' && right === 'Z') || (left === 'Z' && right === '0');
        assert.deepEqual(readWorldCode(swapped), blind ? { code: swapped } : { problem: 'check' }, swapped);
        if (!blind) caught++;
      }
    }
    assert.ok(caught > 1000);
  });

  it('gives the server only the first half, which says nothing of the secret', () => {
    assert.equal(worldIdOfCode(CODE), worldCodeGroups(CODE)[0]);
    assert.equal(worldCodeSecret(CODE).length, 14);
    assert.equal(worldIdOfCode(CODE) + worldCodeSecret(CODE) + CODE.slice(-1), CODE);
    for (let round = 0; round < 300; round++) {
      const code = makeWorldCode(deps.random);
      const sent = JSON.stringify({ world: worldIdOfCode(code) });
      assert.equal(sent.includes(worldCodeSecret(code)), false);
      assert.equal(sent.includes(code), false);
    }
    const other = Uint8Array.from(BYTES);
    for (let at = 4; at < other.length; at++) other[at] = other[at]! ^ 0xff;
    const twin = makeWorldCode(() => other);
    assert.equal(worldIdOfCode(twin), worldIdOfCode(CODE));
    assert.notEqual(worldCodeSecret(twin), worldCodeSecret(CODE));
  });
});
