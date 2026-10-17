// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's records and their history, together: every change is an
// event added to the history, and the state is rebuilt from it.

import type { Day } from './day.ts';
import { HistoryLog, type Entry, type HistoryDeps, type HistoryStore } from './history.ts';
import { eventOf, layerOf, type RecordEvent } from './events.ts';
import { buildState, type State } from './state.ts';

/**
 * Which record an event sets. Events with the same key are versions of one
 * record. A pupil's movements are part of the pupil's record.
 */
function recordKey(event: RecordEvent): string {
  switch (event.kind) {
    case 'teacher.set':
      return 'teacher';
    case 'teacher.personal.set':
      return 'teacher:personal';
    case 'school.set':
      return `school:${event.school.id}`;
    case 'class.set':
      return `class:${event.schoolClass.id}`;
    case 'pupil.set':
      return `pupil:${event.pupil.id}`;
    case 'pupil.moved':
      return `pupil:${event.pupilId}`;
    case 'course.set':
      return `course:${event.course.id}`;
    case 'timetable.set':
      return `timetable:${event.version.id}`;
    case 'calendar.set':
      return `calendar:${event.entry.id}`;
    case 'session.recorded':
      return `session:${event.record.session.key}`;
    case 'session.withdrawn':
      return `session:${event.session.key}`;
    case 'session.noted':
      return `note:${event.note.sessionKey}`;
    case 'roll-call.taken':
      return `roll-call:${event.rollCall.unit}`;
    case 'seating.set':
      return `seating:${event.plan.classId}/${event.plan.groupId}`;
    case 'counting.set':
      return 'counting';
    case 'setup.finished':
      return 'setup';
  }
}

/**
 * The teacher's records and their history. Every change is stored before
 * the promise resolves, so nothing is lost (PRD §6.8).
 */
export class RecordBook {
  readonly #log: HistoryLog;
  #state: State;

  private constructor(log: HistoryLog) {
    this.#log = log;
    this.#state = buildState(log.entries);
  }

  /** Opens a stored history, but only one that verifies (`HistoryLog.open`). */
  static async open(store: HistoryStore, deps: HistoryDeps): Promise<RecordBook> {
    return new RecordBook(await HistoryLog.open(store, deps));
  }

  get state(): State {
    return this.#state;
  }

  get entries(): readonly Entry[] {
    return this.#log.entries;
  }

  /**
   * Records one event and rebuilds the state. Rebuilding from the whole
   * history keeps one path from history to screen. A year's history is a few
   * thousand entries, which rebuild in milliseconds.
   */
  async record(day: Day, event: RecordEvent): Promise<Entry> {
    const entry = await this.#log.append(day, layerOf(event), event.kind, event);
    this.#state = buildState(this.#log.entries);
    return entry;
  }

  async recordAll(day: Day, events: readonly RecordEvent[]): Promise<Entry[]> {
    const entries: Entry[] = [];
    for (const event of events) entries.push(await this.record(day, event));
    return entries;
  }

  /**
   * Erases whole records: the entries must hold every version of each record
   * they touch, such as a session's record and its corrections, a roll call
   * and its corrections, or a pupil and their movements. Erasing one version
   * alone would bring the one before it back (PRD §5.5).
   */
  async erase(day: Day, ids: readonly string[]): Promise<Entry> {
    const named = new Set(ids);
    const touched = new Set<string>();
    for (const id of named) {
      const entry = this.#log.entries.find((candidate) => candidate.id === id);
      const event = entry === undefined ? null : eventOf(entry);
      if (event === null) throw new RangeError('An erasure names an entry that holds no record');
      touched.add(recordKey(event));
    }
    for (const entry of this.#log.entries) {
      const event = eventOf(entry);
      if (event !== null && !named.has(entry.id) && touched.has(recordKey(event))) {
        throw new RangeError('An erasure must cover every version of each record it touches');
      }
    }
    const erasure = await this.#log.erase(day, [...named]);
    this.#state = buildState(this.#log.entries);
    return erasure;
  }
}
