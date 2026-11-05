// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What PDF text extraction leaves behind in a pack's words (#614, R-4.3-14,
// answer 768): a replacement character, Arabic presentation forms instead of
// plain letters, and private-use characters from a broken font map. A release's
// numbers are typed twice as they are keyed (answer 747), so there is nothing
// to check of them here; a typed title holds none of these.

import type { PlanPack } from './pack.ts';

const RANGES: readonly (readonly [number, number])[] = [
  [0xfffd, 0xfffd],
  [0xfb00, 0xfdf1],
  [0xfdf3, 0xfdf9],
  [0xfdfb, 0xfdff],
  [0xfe70, 0xfeff],
  [0xe000, 0xf8ff],
];

const isArtefact = (title: string): boolean =>
  [...title].some((one) => RANGES.some(([from, to]) => one.codePointAt(0)! >= from && one.codePointAt(0)! <= to));

/** The items whose title holds an extraction artefact. */
export function extractionArtefacts(pack: PlanPack): string[] {
  return pack.items.filter((item) => isArtefact(item.title)).map((item) => item.id);
}
