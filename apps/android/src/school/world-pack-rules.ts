// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a world's published releases mean for a joined teacher's classes (#617,
// answer 771): a course is a class and subject of the timetable in force that
// the school sent, kept apart by school. Its pin is the release it moved to,
// kept in the world's own store, or the one the world's class starts on, or
// none. Publishing moves nothing: a course with an older pin, or none and a
// fitting grade and subject, is offered the pack's latest release, and the
// steps between are read as anywhere else. When they don't fit, the teacher
// sees why and no move is offered. A world's classes hold no layers or recorded
// items, so no question arises on a move.

import {
  compareReleases,
  packReleaseKey,
  parsePackId,
  releaseChain,
  releaseChanges,
  timetableNameKey,
  type DemoSchool,
  type KeptPackPin,
  type PackRelease,
  type PinnedPack,
  type PlanPack,
  type ReleaseChange,
  type Subject,
} from '@minhajna/core';
import { courseKey, subjectCode } from '../week/week-sign-session';

export interface WorldCourse {
  readonly key: string;
  readonly class: string;
  readonly subject: string;
  readonly code: string | null;
  readonly grade: string | null;
  /** The release the world's class starts on, for this subject. */
  readonly start: PinnedPack | null;
}

/** Each class and subject the timetable's sessions name, once, in the order they come. */
export function coursesFrom(
  scope: string,
  sessions: readonly { readonly class: string; readonly subject: string }[],
  school: DemoSchool | null | undefined,
  subjects: readonly Subject[],
): WorldCourse[] {
  const found = new Map<string, WorldCourse>();
  for (const one of sessions) {
    const code = subjectCode(subjects, one.subject);
    const week = { class: one.class, subject: one.subject, code };
    const key = `${scope}\n${courseKey(week)}`;
    if (found.has(key)) continue;
    const held = school?.classes.find((each) => timetableNameKey(each.name) === timetableNameKey(one.class));
    const start = code === null ? undefined : held?.packs[code];
    found.set(key, { ...week, key, grade: held?.grade ?? null, start: start ?? null });
  }
  return [...found.values()];
}

/** The course's release: the one it moved to, or the one it starts on. */
export function pinOf(course: WorldCourse, pins: Readonly<Record<string, KeptPackPin>>): PinnedPack | null {
  return pins[course.key] ?? course.start;
}

/** The latest published release of each pack, the latest of the releases published once beside it. */
export function latestPublished(records: ReadonlyMap<string, PackRelease>): PackRelease[] {
  const latest = new Map<string, PackRelease>();
  for (const one of records.values()) {
    if (one.stage !== 'published') continue;
    const held = latest.get(one.pack.id);
    if (held === undefined || compareReleases(one.pack.release, held.pack.release) > 0) latest.set(one.pack.id, one);
  }
  return [...latest.values()];
}

const fits = (course: WorldCourse, id: string) => {
  const parts = parsePackId(id);
  return parts !== null && parts.subject === course.code && parts.grade === course.grade;
};

/** The courses this release is offered to: on an older one of its pack, or on none and fitting it. */
export function coursesFor(
  release: PackRelease,
  courses: readonly WorldCourse[],
  pins: Readonly<Record<string, KeptPackPin>>,
): WorldCourse[] {
  const { id, release: number } = release.pack;
  return courses.filter((course) => {
    const pin = pinOf(course, pins);
    return pin === null ? fits(course, id) : pin.id === id && compareReleases(pin.release, number) < 0;
  });
}

/** Every release the steps may pass through: the app's, and those this world published once. */
export function chainPacks(bundled: readonly PlanPack[], records: ReadonlyMap<string, PackRelease>): PlanPack[] {
  const all = new Map(bundled.map((pack) => [packReleaseKey(pack.id, pack.release), pack]));
  for (const [key, one] of records)
    if (one.stage === 'published' || one.stage === 'superseded' || one.stage === 'withdrawn') all.set(key, one.pack);
  return [...all.values()];
}

export type MoveOffer =
  | { readonly kind: 'first' }
  | { readonly kind: 'move'; readonly from: string; readonly changes: readonly ReleaseChange[] }
  | { readonly kind: 'none'; readonly from: string };

/** What moving the course to the release would be: its first plan, a move with these changes, or none offered. */
export function moveOffer(pin: PinnedPack | null, target: PlanPack, packs: readonly PlanPack[]): MoveOffer {
  if (pin === null) return { kind: 'first' };
  if (pin.id !== target.id) return { kind: 'none', from: pin.release };
  const chain = releaseChain(packs, target, pin.release);
  const from = packs.find((pack) => pack.id === pin.id && pack.release === pin.release);
  if (!chain.ok || from === undefined) return { kind: 'none', from: pin.release };
  return { kind: 'move', from: pin.release, changes: releaseChanges(from, target, chain.steps) };
}
