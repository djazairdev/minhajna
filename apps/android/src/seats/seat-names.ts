// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The name on a seat (Roll-seats): the given name alone, as the teacher
// calls the pupil, since a seat has room for little. Class lists write the
// family name first, and a family name may run on after a particle such as
// «بن» or «آيت». The seat's spoken label keeps the full name.

const PARTICLES = new Set([
  'بن',
  'ابن',
  'بو',
  'آيت',
  'أيت',
  'ولد',
  'أولاد',
  'عبد',
  'سي',
  'ben',
  'ait',
  'aït',
  'ould',
  'abd',
  'bou',
  'si',
]);

/** The given name from a class list's «family given» name, or the whole name when it has one word. */
export function givenName(name: string): string {
  const words = name.trim().split(/\s+/);
  let family = 1;
  while (family < words.length - 1 && PARTICLES.has(words[family - 1]?.toLowerCase() ?? '')) family++;
  return words.length > family ? words.slice(family).join(' ') : name.trim();
}
