// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The packs a class can pin (PRD §3.2, §4.2). A pack's ID names its level,
// grade, subject, stream and edition, and each edition ships one release a
// school year, with quick fixes after it. A class stays on the release it
// pinned until the teacher moves it; the catalogue offers each edition's
// latest release, the ones that apply best first.

import type { PackStatus, PlanPack } from './pack.ts';
import type { PinnedPack } from './records.ts';

/** The parts of `dz.<level>.<grade>.<subject>[.<stream>].<edition>`. */
export interface PackIdParts {
  readonly country: string;
  readonly level: string;
  readonly grade: string;
  readonly subject: string;
  readonly stream?: string;
  readonly edition: string;
}

/** The order a teacher is offered packs in: what applies first, a stale plan last. */
export const STATUS_ORDER: readonly PackStatus[] = [
  'official',
  'in-force',
  'latest-found',
  'community',
  'example',
  'stale',
];

export function parsePackId(id: string): PackIdParts | null {
  const parts = id.split('.');
  if (parts.length !== 5 && parts.length !== 6) return null;
  const [country = '', level = '', grade = '', subject = ''] = parts;
  const edition = parts.at(-1) ?? '';
  const stream = parts.length === 6 ? parts[4] : undefined;
  return { country, level, grade, subject, ...(stream !== undefined && { stream }), edition };
}

/** Releases in order, such as `2026.1` before `2026.2` before `2027.1`. */
export function compareReleases(a: string, b: string): number {
  const [yearA = 0, fixA = 0] = a.split('.').map(Number);
  const [yearB = 0, fixB = 0] = b.split('.').map(Number);
  return yearA - yearB || fixA - fixB;
}

/** The latest release of each edition for a grade and subject, the ones that apply best first. */
export function packsFor(packs: Iterable<PlanPack>, grade: string, subject: string): PlanPack[] {
  const latest = new Map<string, PlanPack>();
  for (const pack of packs) {
    const parts = parsePackId(pack.id);
    if (parts?.grade !== grade || parts.subject !== subject) continue;
    const known = latest.get(pack.id);
    if (known === undefined || compareReleases(pack.release, known.release) > 0) latest.set(pack.id, pack);
  }
  return [...latest.values()].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.id.localeCompare(b.id),
  );
}

/** The pin for a pack's release. */
export function pinOf(pack: PlanPack): PinnedPack {
  return { id: pack.id, release: pack.release };
}

/** A later release of the pinned edition, if one has come; the class stays where it is until the teacher moves it. */
export function newerRelease(packs: Iterable<PlanPack>, pinned: PinnedPack): PlanPack | null {
  let newest: PlanPack | null = null;
  for (const pack of packs) {
    if (pack.id !== pinned.id || compareReleases(pack.release, pinned.release) <= 0) continue;
    if (newest === null || compareReleases(pack.release, newest.release) > 0) newest = pack;
  }
  return newest;
}
