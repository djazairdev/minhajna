// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up statements for reader mode's tests (#246): two made-up keys, a
// 4AM statement for a section and subject, and keeping one as reader mode
// does once its signature checks, on 20/10/2026.

import { parseDay, receiveStatement, signStatement, type ProgressStatement } from '@minhajna/core';
import type { TestData } from './app-data';

export const [KEY_A, KEY_B] = ['bWFkZS11cC1rZXktYQ==', 'bWFkZS11cC1rZXktYg=='];

let kept = 0;

/** A statement of `day` for a class, `behind` sessions behind its plan. */
export const madeUpStatement = (
  day: string,
  section: string,
  subject = 'arabic',
  grade = '4am',
  behind = 0,
): ProgressStatement => ({
  format: 'minhajna.statement',
  version: { major: 1, minor: 0 },
  day: parseDay(day),
  class: { level: 'cem', grade, section, subject, year: '2026-2027' },
  pack: { id: 'dz.cem.4am.arabic.example', release: '2026.1' },
  lastUnit: null,
  lastResource: null,
  delay: { sessions: behind, weeks: null, bufferUsed: 0, bufferLeft: 2 },
  notHeld: { calendar: 0, other: 0 },
  td: { calendar: 0, other: 0 },
});

/** Keeps a statement signed under `spki`, as received by QR code, and gives its ID. */
export async function keepStatement(data: TestData, spki: string, value: ProgressStatement): Promise<string> {
  const text = await signStatement(value, spki, () => Promise.resolve('bWFkZS11cA=='));
  kept += 1;
  const event = receiveStatement(data.book.entries, text, { ok: true, spki, statement: value }, 'qr', `r-${kept}`);
  await data.book.record(parseDay('2026-10-20'), event!);
  return `r-${kept}`;
}
