// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Two devices that change the same record before they sync (PRD §5.8). No
// change is lost, since both stay in the history; when the two differ, the
// teacher chooses which to keep. A record is named by what it changes: a
// session, a roll call, a pupil, a seating plan. Entries that only add, such
// as a pupil's joining or leaving, or a print of the week's set, never
// conflict. The notice says how many records wait for a choice, and of
// which kinds; the Conflict screen then shows both versions with their
// device and day, and until the teacher chooses, this device's version
// shows.

import { canonicalJson, eventOf, type Entry, type RecordEvent } from '@minhajna/core';

export interface Conflict {
  /** The record both devices changed, such as `roll-call/<unit>`. */
  readonly key: string;
  readonly kind: RecordEvent['kind'];
  readonly mine: Entry;
  readonly theirs: Entry;
}

/** The record an entry changes, or null for one that only adds. */
export function recordKey(entry: Entry): string | null {
  const event = eventOf(entry);
  if (event === null) return null;
  switch (event.kind) {
    case 'teacher.set':
      return 'teacher';
    case 'teacher.personal.set':
      return 'personal';
    case 'school.set':
      return `school/${event.school.id}`;
    case 'class.set':
      return `class/${event.schoolClass.id}`;
    case 'pupil.set':
      return `pupil/${event.pupil.id}`;
    case 'pupil.moved':
      return null;
    case 'course.set':
      return `course/${event.course.id}`;
    case 'timetable.set':
      return `timetable/${event.version.id}`;
    case 'calendar.set':
      return `calendar/${event.entry.id}`;
    case 'calendar.removed':
      return `calendar/${event.id}`;
    case 'calendar.updated':
      return `calendar-update/${event.applied.update.release}`;
    case 'pack.added':
      return `pack/${event.added.update.pack.id}@${event.added.update.pack.release}`;
    case 'layer.added':
      return `layer/${event.added.layer.level}:${event.added.layer.id}`;
    case 'layer.switched':
      return `layer-switch/${event.switched.courseId}/${event.switched.level}`;
    case 'list.set':
      return `list/${event.list.courseId}`;
    case 'session.recorded':
      return `session/${event.record.session.key}`;
    case 'session.withdrawn':
      return `session/${event.session.key}`;
    case 'session.noted':
      return `note/${event.note.sessionKey}`;
    case 'homework.counted':
      return `homework/${event.count.sessionKey}`;
    case 'homework.uncounted':
      return `homework/${event.sessionKey}`;
    case 'extra.logged':
      return `extra/${event.extra.id}`;
    case 'extra.removed':
      return `extra/${event.id}`;
    case 'roll-call.taken':
      return `roll-call/${event.rollCall.unit}`;
    case 'seating.set':
      return `seating/${event.plan.classId}/${event.plan.groupId}`;
    case 'counting.set':
      return 'counting';
    case 'setup.finished':
      return 'setup';
    case 'print.recorded':
      return null;
    case 'test.set':
      return `test/${event.test.id}`;
    case 'test.removed':
      return `test/${event.id}`;
    case 'plan.decided':
      return `decision/${event.decision.id}`;
    case 'plan.undecided':
      return `decision/${event.id}`;
    case 'duty.set':
      return `duty/${event.duty.id}`;
    case 'duty.removed':
      return `duty/${event.id}`;
    case 'catchup.set':
      return `catchup/${event.catchUp.id}`;
    case 'catchup.removed':
      return `catchup/${event.id}`;
    case 'support.set':
      return `support/${event.queue.courseId}`;
    case 'repace.set':
      return `repace/${event.repace.id}`;
    case 'repace.removed':
      return `repace/${event.id}`;
  }
}

function latest(entries: readonly Entry[]): Map<string, Entry> {
  const byKey = new Map<string, Entry>();
  for (const entry of entries) {
    const key = recordKey(entry);
    if (key !== null) byKey.set(key, entry);
  }
  return byKey;
}

/**
 * The records both sides changed since their last sync, where the latest
 * versions differ. `mine` and `theirs` are each side's entries since then.
 */
export function findConflicts(mine: readonly Entry[], theirs: readonly Entry[]): Conflict[] {
  const ours = latest(mine);
  const conflicts: Conflict[] = [];
  for (const [key, other] of latest(theirs)) {
    const own = ours.get(key);
    if (own === undefined) continue;
    if (canonicalJson(own.content?.body) === canonicalJson(other.content?.body)) continue;
    conflicts.push({ key, kind: eventOf(own)!.kind, mine: own, theirs: other });
  }
  return conflicts;
}

export interface ConflictNotice {
  readonly count: number;
  /** How many of each kind of record, such as two roll calls. */
  readonly kinds: Readonly<Partial<Record<RecordEvent['kind'], number>>>;
}

/** What the notice says: how many records differ, and of which kinds. */
export function conflictNotice(conflicts: readonly Conflict[]): ConflictNotice | null {
  if (conflicts.length === 0) return null;
  const kinds: Partial<Record<RecordEvent['kind'], number>> = {};
  for (const conflict of conflicts) kinds[conflict.kind] = (kinds[conflict.kind] ?? 0) + 1;
  return { count: conflicts.length, kinds };
}
