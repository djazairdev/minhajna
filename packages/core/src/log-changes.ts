// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a correction changed, for «سجل النشاط» (#235, answer 425): the fields
// of a session record that differ between two versions, in the order the
// texts book shows them, and each pupil whose mark differs between two
// versions of a roll call. Only which ones changed, never their content.

import type { RollCall } from './attendance-records.ts';
import { canonicalJson } from './canonical.ts';
import type { SessionRecord } from './records.ts';
import { markOf, type PupilMark } from './roll-call-fix.ts';

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
