// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's code (#539, choice D2 of the 0.7.0 demo): 20 characters in
// four groups of five, from the recovery key's 32, read as typed the same
// way. The first group names the world on the server, and is all the server
// ever receives. The next 14 characters are the code's secret, 70 random
// bits: the device derives from them the key that wraps the world's private
// keys, so whoever holds the code holds the world, and the server does not.
// The last character is a Luhn mod 32 check over the other 19, so a single
// mistyped character, or most swaps of two neighbours, is refused before
// anything is sent.

import type { RandomBytes } from './id.ts';
import { plainTyped, RECOVERY_ALPHABET, recoverySymbols } from './recovery-key.ts';

export const WORLD_CODE_LENGTH = 20;
export const WORLD_CODE_GROUP = 5;
export const WORLD_ID_LENGTH = 5;

const WORLD_ID = new RegExp(`^[${RECOVERY_ALPHABET}]{${WORLD_ID_LENGTH}}$`, 'u');
const BYTES = 12;
const BODY = WORLD_CODE_LENGTH - 1;
const BASE = RECOVERY_ALPHABET.length;

/** Why a typed code was refused: too short or too long, a character no code holds, or a failed check. */
export type WorldCodeProblem = 'length' | 'character' | 'check';

export type WorldCodeRead = { readonly code: string } | { readonly problem: WorldCodeProblem };

/** The Luhn mod 32 sum of a code's characters, doubling every second one from the right. */
function luhnSum(text: string, doubleFirst: boolean): number {
  let sum = 0;
  let double = doubleFirst;
  for (let at = text.length - 1; at >= 0; at--) {
    let value = RECOVERY_ALPHABET.indexOf(text[at]!);
    if (double) value *= 2;
    sum += Math.floor(value / BASE) + (value % BASE);
    double = !double;
  }
  return sum % BASE;
}

function checkCharacter(body: string): string {
  return RECOVERY_ALPHABET[(BASE - luhnSum(body, true)) % BASE]!;
}

/** A new code, as stored: 20 characters, no spaces. */
export function makeWorldCode(random: RandomBytes): string {
  const bytes = random(BYTES);
  if (bytes.length !== BYTES) throw new RangeError('A world code needs 12 random bytes');
  const body = recoverySymbols(bytes).slice(0, BODY);
  return body + checkCharacter(body);
}

/** The code someone typed or read aloud, as stored, or why it was refused. */
export function readWorldCode(text: string): WorldCodeRead {
  const plain = plainTyped(text);
  if (plain.length !== WORLD_CODE_LENGTH) return { problem: 'length' };
  if (![...plain].every((one) => RECOVERY_ALPHABET.includes(one))) return { problem: 'character' };
  if (luhnSum(plain, false) !== 0) return { problem: 'check' };
  return { code: plain };
}

/** The code in its four groups of five, as a screen shows it and someone reads it aloud. */
export function worldCodeGroups(code: string): readonly string[] {
  return code.match(/.{5}/g) ?? [];
}

/** The first five characters: the only part of a code the server may receive, naming the world. */
export function worldIdOfCode(code: string): string {
  return code.slice(0, WORLD_ID_LENGTH);
}

/** Whether a value is a world's ID, a code's first five characters. */
export function isWorldId(value: unknown): value is string {
  return typeof value === 'string' && WORLD_ID.test(value);
}

/**
 * The next fourteen characters, before the check character: the secret the device derives the world's wrapping key
 * from. It never leaves the device.
 */
export function worldCodeSecret(code: string): string {
  return code.slice(WORLD_ID_LENGTH, BODY);
}
