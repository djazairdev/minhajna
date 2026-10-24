// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سجل النشاط» (#235, Log, R-5.5-06, answer 425): worked out from the
// history, never kept apart. It lists corrections to the books (a later
// version of a session or a roll call, or a session withdrawn), files and
// printing, and deletions, by the day each was made and in the history's
// order, never a clock time (R-5.5-05). A line says what changed, never the
// content: no pupil's name, note or text. Past a damaged stretch (#399,
// answer 427) a change shows as its kind and day only, unchecked. Erasing a
// pupil's data shows as one line (answer 473): its erasures make none of
// their own, and a roll call it restated keeps its corrections' days. Backups
// and recovery sheets are listed under the devices (#247), never the key.

import { canonicalJson } from './canonical.ts';
import { compareDays, type Day } from './day.ts';
import { CORRECTION_REASONS, eventOf, type CorrectionReason, type RecordEvent } from './events.ts';
import { ERASURE, erasedIds, type Entry } from './history.ts';
import { MARK_FIX_REASONS, type MarkFixReason } from './mark-fix.ts';
import type { MarkTarget, MarkValue } from './marks.ts';
import type { OutputRecord } from './prints.ts';
import type { Half, SessionRecord, SessionRef } from './records.ts';
import { markOf, ROLL_CALL_REASONS, type PupilMark, type RollCallReason } from './roll-call-fix.ts';
import type { RollCall } from './attendance-records.ts';
import { restatements } from './restated.ts';

/** A field of a session record a correction changed, in the order the texts book shows them. */
export const SESSION_FIELDS = [
  'outcome',
  'coverage',
  'unplanned',
  'homework',
  'due',
  'test',
  'factual',
  'type',
  'make-up',
  'list-item',
] as const;

export type SessionField = (typeof SESSION_FIELDS)[number];

/** One pupil's mark before and after a roll call's correction. */
export interface PupilMarkChange {
  readonly pupilId: string;
  readonly from: PupilMark;
  readonly to: PupilMark;
}

export type LogLine =
  | {
      readonly kind: 'session-corrected';
      readonly session: SessionRef;
      /** Empty when a withdrawn session was recorded again. */
      readonly fields: readonly SessionField[];
      readonly reason?: CorrectionReason;
    }
  | { readonly kind: 'session-withdrawn'; readonly session: SessionRef }
  | {
      readonly kind: 'roll-call-corrected';
      readonly classId: string;
      readonly groupId: string;
      readonly day: Day;
      readonly half: Half;
      readonly changes: readonly PupilMarkChange[];
      /** Only a known code: an older or other device's history may hold words, which never show. */
      readonly reason?: RollCallReason;
    }
  /** A mark corrected after its term (#243); its detail never shows. */
  | {
      readonly kind: 'mark-corrected';
      readonly courseId: string;
      readonly term: number;
      readonly target: MarkTarget;
      readonly pupilId: string;
      readonly from: MarkValue | null;
      readonly to: MarkValue | null;
      readonly reason?: MarkFixReason;
    }
  /** The week's print set, by the documents it held. */
  | { readonly kind: 'printed'; readonly documents: readonly string[] }
  | { readonly kind: 'output'; readonly output: OutputRecord }
  | { readonly kind: 'calendar-update'; readonly release: string }
  | { readonly kind: 'pack-added'; readonly pack: string; readonly release: string }
  | { readonly kind: 'layer-added'; readonly title: string }
  /** The kinds of the records an erasure removed: only the fact and the day stay (R-5.5-13). */
  | { readonly kind: 'erased'; readonly kinds: readonly string[] }
  /** A pupil's data erased, with nothing of it (answer 473). */
  | { readonly kind: 'pupil-erased' }
  /** A backup saved, or a new recovery sheet confirmed (#247): never the key. */
  | { readonly kind: 'backup-saved' }
  | { readonly kind: 'recovery-set' }
  /** A change past a damaged stretch: its kind and day, never its content. */
  | { readonly kind: 'unverified'; readonly entryKind: string };

export type LogCategory = 'corrections' | 'files' | 'erasures' | 'devices';

export interface LogItem {
  /** The entry's place in the history. */
  readonly seq: number;
  readonly day: Day;
  /** Null for an unchecked change, which shows only under «الكل». */
  readonly category: LogCategory | null;
  readonly line: LogLine;
}

export interface LogDay {
  readonly day: Day;
  /** Newest first. */
  readonly items: readonly LogItem[];
}

const known = <T extends string>(codes: readonly T[], value: string | undefined): value is T =>
  (codes as readonly (string | undefined)[]).includes(value);

const same = (a: unknown, b: unknown) => canonicalJson(a ?? null) === canonicalJson(b ?? null);

const FIELD_VALUES: Readonly<Record<SessionField, (record: SessionRecord) => unknown>> = {
  outcome: (record) => record.outcome,
  coverage: (record) => record.coverage,
  unplanned: (record) => record.unplanned,
  homework: (record) => record.homework?.text,
  due: (record) => record.homework?.due,
  test: (record) => record.test,
  factual: (record) => record.factual,
  type: (record) => record.sessionType,
  'make-up': (record) => record.makeUp,
  'list-item': (record) => record.listItem,
};

/** The fields that differ between two versions of a session record. */
export function changedFields(before: SessionRecord, after: SessionRecord): SessionField[] {
  return SESSION_FIELDS.filter((field) => !same(FIELD_VALUES[field](before), FIELD_VALUES[field](after)));
}

/** Every pupil whose mark differs between two versions of a roll call, in the order they are marked. */
export function changedMarks(before: RollCall, after: RollCall): PupilMarkChange[] {
  const pupils = new Set<string>();
  for (const rollCall of [before, after]) {
    for (const absence of rollCall.absent) pupils.add(absence.pupilId);
    for (const id of rollCall.late) pupils.add(id);
  }
  return [...pupils]
    .map((pupilId) => ({ pupilId, from: markOf(before, pupilId), to: markOf(after, pupilId) }))
    .filter((change) => change.from !== change.to);
}

/** The books' records the log follows, each by its last version; null once a session was withdrawn. */
interface Seen {
  readonly sessions: Map<string, SessionRecord | null>;
  readonly rollCalls: Map<string, RollCall>;
}

/** The line one event makes, given the versions seen before it; null for an event the log leaves out. */
function lineOf(event: RecordEvent, seen: Seen): LogLine | null {
  switch (event.kind) {
    case 'session.recorded': {
      const { key } = event.record.session;
      const before = seen.sessions.get(key);
      seen.sessions.set(key, event.record);
      if (before === undefined) return null;
      const fields = before === null ? [] : changedFields(before, event.record);
      if (before !== null && fields.length === 0) return null;
      return {
        kind: 'session-corrected',
        session: event.record.session,
        fields,
        ...(known(CORRECTION_REASONS, event.correction) && { reason: event.correction }),
      };
    }
    case 'session.withdrawn':
      seen.sessions.set(event.session.key, null);
      return { kind: 'session-withdrawn', session: event.session };
    case 'roll-call.taken': {
      const { rollCall } = event;
      const before = seen.rollCalls.get(rollCall.unit);
      seen.rollCalls.set(rollCall.unit, rollCall);
      if (before === undefined) return null;
      const changes = changedMarks(before, rollCall);
      if (changes.length === 0) return null;
      const { classId, groupId, day, half } = rollCall;
      return {
        kind: 'roll-call-corrected',
        classId,
        groupId,
        day,
        half,
        changes,
        ...(known(ROLL_CALL_REASONS, event.reason) && { reason: event.reason }),
      };
    }
    case 'mark.corrected': {
      const { mark, before, reason } = event.fix;
      const { courseId, term, target, pupilId, value } = mark;
      return {
        kind: 'mark-corrected',
        courseId,
        term,
        target,
        pupilId,
        from: before,
        to: value,
        ...(known(MARK_FIX_REASONS, reason) && { reason }),
      };
    }
    case 'print.recorded':
      return { kind: 'printed', documents: event.print.documents.map((document) => document.id) };
    case 'output.recorded':
      return { kind: 'output', output: event.output };
    case 'calendar.updated':
      return { kind: 'calendar-update', release: event.applied.update.release };
    case 'pack.added':
      return { kind: 'pack-added', pack: event.added.update.pack.id, release: event.added.update.pack.release };
    case 'layer.added':
      return { kind: 'layer-added', title: event.added.layer.title };
    case 'pupil.erased':
      return { kind: 'pupil-erased' };
    case 'backup.saved':
      return { kind: 'backup-saved' };
    case 'recovery.set':
      return { kind: 'recovery-set' };
    default:
      return null;
  }
}

/** An erasure's line: the kinds of the records it removed. */
function erasedLine(ids: readonly string[], kinds: ReadonlyMap<string, string>): LogLine {
  return { kind: 'erased', kinds: [...new Set(ids.flatMap((id) => kinds.get(id) ?? []))] };
}

const categoryOf = (line: LogLine): LogCategory | null => {
  switch (line.kind) {
    case 'session-corrected':
    case 'session-withdrawn':
    case 'roll-call-corrected':
    case 'mark-corrected':
      return 'corrections';
    case 'erased':
    case 'pupil-erased':
      return 'erasures';
    case 'backup-saved':
    case 'recovery-set':
      return 'devices';
    case 'unverified':
      return null;
    default:
      return 'files';
  }
};

/**
 * The log, newest day first, a day's changes newest first; the phone's date can go back, so days are sorted.
 * Entries from `trusted` on lie past a damaged stretch: each shows as its kind and day, unchecked, and an
 * unreadable row is left out. An erased record's own versions show only through their erasure, as their content
 * is gone. A pupil's erasure is its fact's line alone, and a restated version stands at the day and place of the
 * entry it replaces.
 */
export function activityLog(entries: readonly (Entry | null)[], trusted: number = entries.length): LogDay[] {
  const seen: Seen = { sessions: new Map(), rollCalls: new Map() };
  const kinds = new Map<string, string>();
  const ofPupils = new Set<string>();
  const restated = restatements(entries.slice(0, trusted).filter((entry) => entry !== null));
  const positions = new Map(entries.flatMap((entry, position) => (entry === null ? [] : [[entry.id, position]])));
  const placed: { readonly at: number; readonly item: LogItem }[] = [];
  entries.forEach((entry, position) => {
    if (entry === null) return;
    kinds.set(entry.id, entry.kind);
    let line: LogLine | null;
    if (position >= trusted) line = { kind: 'unverified', entryKind: entry.kind };
    else if (restated.replaced.has(entry.id)) line = null;
    else if (entry.kind === ERASURE) {
      const ids = erasedIds(entry) ?? [];
      line = ids.some((id) => ofPupils.has(id)) ? null : erasedLine(ids, kinds);
    } else {
      const event = eventOf(entry);
      if (event?.kind === 'pupil.erased') for (const id of event.erased.entries) ofPupils.add(id);
      line = event === null ? null : lineOf(event, seen);
    }
    const stands = restated.of.get(entry.id) ?? entry;
    const at = positions.get(stands.id) ?? position;
    if (line !== null)
      placed.push({ at, item: { seq: stands.seq, day: stands.day, category: categoryOf(line), line } });
  });
  const items = placed.sort((a, b) => a.at - b.at).map((one) => one.item);
  const days = new Map<Day, LogItem[]>();
  for (const item of items.reverse()) days.set(item.day, [...(days.get(item.day) ?? []), item]);
  return [...days].sort(([a], [b]) => compareDays(b, a)).map(([day, dayItems]) => ({ day, items: dayItems }));
}
