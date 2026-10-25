// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The plan a recorded session is read against (#322, answer 487 (7),
// R-4.2-13): its class's plan on the pack and release the record was first
// read in on, with the class's changes, so the texts book, the journal and
// Today write its titles as they were. A correction made after a move may
// name the newer release's items, and a release never reuses an old ID, so
// the items of the class's plan now that the older one lacks are kept as
// retired, which `findPackItem` still finds. A session not recorded, or read
// in on the release the class is on, reads the class's plan now.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import type { PlanPack } from './pack.ts';
import type { SessionRecord } from './records.ts';
import type { State } from './state-type.ts';

const packs = new WeakMap<ReadonlyMap<string, PlanPack>, WeakMap<State, Map<string, PlanPack | null>>>();

function withNewer(base: PlanPack, now: PlanPack | null): PlanPack {
  if (now === null || now === base) return base;
  const known = new Set([...base.items, ...(base.retired ?? [])].map((item) => item.id));
  const more = [...now.items, ...(now.retired ?? [])].filter((item) => !known.has(item.id));
  if (more.length === 0) return base;
  const templates = new Set(base.stageTemplates.map((template) => template.id));
  return {
    ...base,
    stageTemplates: [...base.stageTemplates, ...now.stageTemplates.filter((one) => !templates.has(one.id))],
    retired: [...(base.retired ?? []), ...more],
  };
}

/** The plan a session's record is read against: as it was when the record was first read in. */
export function recordPack(context: Context, record: SessionRecord): PlanPack | null {
  const { courseId, key } = record.session;
  const now = courseSetup(context, courseId).pack;
  const stamp = context.state.sessions.get(key)?.[0]?.pack;
  const course = context.state.courses.get(courseId);
  if (stamp === undefined || course === undefined) return now;
  if (course.pack?.id === stamp.id && course.pack.release === stamp.release) return now;
  const byState = packs.get(context.ref.packs) ?? new WeakMap<State, Map<string, PlanPack | null>>();
  packs.set(context.ref.packs, byState);
  const known = byState.get(context.state) ?? new Map<string, PlanPack | null>();
  byState.set(context.state, known);
  const memo = `${courseId}|${stamp.id}|${stamp.release}`;
  if (!known.has(memo)) {
    const courses = new Map(context.state.courses).set(courseId, { ...course, pack: stamp });
    const base = courseSetup({ ...context, state: { ...context.state, courses } }, courseId).pack;
    known.set(memo, base === null ? null : withNewer(base, now));
  }
  return known.get(memo) ?? now;
}
