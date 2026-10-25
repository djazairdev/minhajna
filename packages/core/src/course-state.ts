// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How the state reads a course's events and its sessions (#322, answer 487,
// R-4.2-13). A move changes the release a course is pinned to only while the
// course is still on the release the move leaves, and only to a newer one, and
// the activity log shows only a move that did. Each session record is
// stamped with the pack and release its class is on as it is read in, so one
// from before the class's first move has the release before it; the record
// itself never changes, and exports send it as it came, each class going out
// on the release its first record was read in on and moved before the first
// record read in on the next, so the stamps read the same where it arrives: the
// records go out by release, then in the order of their own days. Those read
// in on a pack the class had before it changed edition, or on its own list, go
// out with the class set back for them, so their stamps read the same too.

import type { CourseEvent, CourseMove } from './course-events.ts';
import type { RecordEvent } from './events.ts';
import type { Entry } from './history.ts';
import { compareReleases } from './pack-catalogue.ts';
import type { Course, PinnedPack, SessionRecord } from './records.ts';
import { versionOf, type Version } from './versions.ts';

type SessionEvent = Extract<RecordEvent, { readonly kind: 'session.recorded' | 'session.withdrawn' }>;

const applies = (release: string | undefined, move: CourseMove): boolean =>
  release === move.from && compareReleases(move.to, move.from) > 0;

/** Sets a course, or moves it to a newer release when it is still on the one the move leaves. */
export function setCourse(courses: Map<string, Course>, event: CourseEvent): void {
  if (event.kind === 'course.set') {
    courses.set(event.course.id, event.course);
    return;
  }
  const course = courses.get(event.move.courseId);
  if (course?.pack == null || !applies(course.pack.release, event.move)) return;
  courses.set(course.id, { ...course, pack: { ...course.pack, release: event.move.to } });
}

export interface MovedLine {
  readonly kind: 'course-moved';
  readonly courseId: string;
  readonly release: string;
}

/** The activity log's line for a course's event: a move that applied, given the release each course is on. */
export function movedLine(event: CourseEvent, releases: Map<string, string | undefined>): MovedLine | null {
  if (event.kind === 'course.set') {
    releases.set(event.course.id, event.course.pack?.release);
    return null;
  }
  if (!applies(releases.get(event.move.courseId), event.move)) return null;
  releases.set(event.move.courseId, event.move.to);
  return { kind: 'course-moved', courseId: event.move.courseId, release: event.move.to };
}

/** Adds a session's version: a record with its class's release as it is read in, or a withdrawal. */
export function addSession(
  sessions: Map<string, Version<SessionRecord | null>[]>,
  entry: Entry,
  event: SessionEvent,
  courses: ReadonlyMap<string, Course>,
): void {
  if (event.kind === 'session.withdrawn') {
    const key = event.session.key;
    sessions.set(key, [...(sessions.get(key) ?? []), versionOf<SessionRecord | null>(entry, null)]);
    return;
  }
  const key = event.record.session.key;
  const version = versionOf(entry, event.record, event.correction);
  const pack = courses.get(event.record.session.courseId)?.pack;
  sessions.set(key, [...(sessions.get(key) ?? []), pack == null ? version : { ...version, pack }]);
}

type Read = { readonly record: SessionRecord; readonly pack?: PinnedPack | undefined };

/** Records going out by the pin read in on: a pin the class no longer has first, then each pack's by release. */
export function comparePins(courses: ReadonlyMap<string, Course>): (a: Read, b: Read) => number {
  const own = (read: Read) => Number(read.pack?.id === courses.get(read.record.session.courseId)?.pack?.id);
  const id = (read: Read) => read.pack?.id ?? '';
  return (a, b) =>
    own(a) - own(b) ||
    (id(a) === id(b) ? 0 : id(a) < id(b) ? -1 : 1) ||
    compareReleases(a.pack?.release ?? '', b.pack?.release ?? '');
}

/** A course as it goes out: on the pin its first record going out was read in on, none for its own list. */
export function sentCourse(course: Course, sessions: readonly Read[]): Course {
  const first = sessions.find((one) => one.record.session.courseId === course.id);
  return first === undefined ? course : { ...course, pack: first.pack ?? null };
}

/**
 * The records going out in their order, each after its class's move to the
 * release it was read in on, or after the class set back on a pack or own
 * list it no longer has, then each class on its pin.
 */
export function sentSessions(courses: ReadonlyMap<string, Course>, sessions: readonly Read[]): RecordEvent[] {
  const on = new Map([...courses.values()].map((course) => [course.id, sentCourse(course, sessions).pack]));
  const events: RecordEvent[] = [];
  const pin = (course: Course, to: PinnedPack | null) => {
    const from = on.get(course.id) ?? null;
    if (from?.id === to?.id && from?.release === to?.release) return;
    on.set(course.id, to);
    if (from !== null && to !== null && from.id === to.id && compareReleases(to.release, from.release) > 0) {
      events.push({ kind: 'course.moved', move: { courseId: course.id, from: from.release, to: to.release } });
    } else events.push({ kind: 'course.set', course: { ...course, pack: to } });
  };
  for (const { record, pack } of sessions) {
    const course = courses.get(record.session.courseId);
    if (course !== undefined) pin(course, pack ?? null);
    events.push({ kind: 'session.recorded', record });
  }
  for (const course of courses.values()) pin(course, course.pack);
  return events;
}
