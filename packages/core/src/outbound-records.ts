// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What may leave the teacher (PRD §5.4, §7.6): the current version of each
// record whose layer a route takes, as the event that sets it, with nothing
// from its history entry. A class's own changes to its plan travel in their
// order, which their meaning needs, without the day each was made (#225).

import { compareDays } from './day.ts';
import { compareDuties } from './exam-duties.ts';
import { compareExtras } from './extra-records.ts';
import { mayTravelAs, type OutboundRoute } from './layers.ts';
import { compareHalves, compareSlots } from './records.ts';
import { layerOf, type RecordEvent } from './events.ts';
import { countOf } from './homework.ts';
import { isChange } from './plan-layer.ts';
import { current, type State } from './state.ts';

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * The current version of each record, as the event that sets it, with
 * nothing from its history entry: no ID, place in the history, day or hash.
 * Sessions and roll calls come in the order of their own days, so not even
 * the order shows when they were recorded (PRD §7.6).
 *
 * A version names the first day it applies, which can be later than the day the teacher gave it.
 */
function currentRecords(state: State): RecordEvent[] {
  const records: RecordEvent[] = [];
  if (state.teacher !== null) records.push({ kind: 'teacher.set', card: state.teacher });
  if (state.personal !== null) records.push({ kind: 'teacher.personal.set', personal: state.personal });
  for (const school of state.schools.values()) records.push({ kind: 'school.set', school });
  for (const schoolClass of state.classes.values()) records.push({ kind: 'class.set', schoolClass });
  for (const pupil of state.pupils.values()) records.push({ kind: 'pupil.set', pupil });
  for (const course of state.courses.values()) records.push({ kind: 'course.set', course });
  for (const { version, from } of state.timetables)
    records.push({ kind: 'timetable.set', version: { ...version, from } });
  for (const entry of state.calendar) records.push({ kind: 'calendar.set', entry });
  for (const applied of state.calendarUpdates) records.push({ kind: 'calendar.updated', applied });
  for (const added of state.addedPacks) records.push({ kind: 'pack.added', added });
  for (const added of state.layers) records.push({ kind: 'layer.added', added });
  for (const switched of state.layerSwitches.values()) records.push({ kind: 'layer.switched', switched });
  for (const list of state.lists.values()) records.push({ kind: 'list.set', list });
  const sessions = [...state.sessions.values()]
    .flatMap((versions) => versions.slice(-1))
    .flatMap(({ value }) => (value === null ? [] : [value]))
    .sort(
      (a, b) =>
        compareDays(a.session.day, b.session.day) ||
        compareSlots(a.session.slot, b.session.slot) ||
        compareText(a.session.key, b.session.key),
    );
  for (const record of sessions) records.push({ kind: 'session.recorded', record });
  for (const note of state.notes.values()) records.push({ kind: 'session.noted', note });
  const extras = [...state.extras.values()].flatMap((versions) => {
    const extra = current(versions);
    return extra === null ? [] : [extra];
  });
  for (const extra of extras.sort(compareExtras)) records.push({ kind: 'extra.logged', extra });
  const counts = [...state.homeworkCounts.keys()].flatMap((key) => {
    const count = countOf(state, key);
    return count === null ? [] : [count];
  });
  for (const count of counts.sort((a, b) => compareText(a.sessionKey, b.sessionKey))) {
    records.push({ kind: 'homework.counted', count });
  }
  const rollCalls = [...state.rollCalls.values()]
    .flatMap((versions) => versions.slice(-1))
    .sort(
      (a, b) =>
        compareDays(a.value.day, b.value.day) ||
        compareHalves(a.value.half, b.value.half) ||
        compareText(a.value.unit, b.value.unit),
    );
  for (const { value, reason } of rollCalls) {
    records.push({ kind: 'roll-call.taken', rollCall: value, ...(reason !== undefined && { reason }) });
  }
  for (const plan of state.seating.values()) records.push({ kind: 'seating.set', plan });
  if (state.counting !== null) records.push({ kind: 'counting.set', rules: state.counting });
  if (state.setupFinished) records.push({ kind: 'setup.finished' });
  for (const print of state.prints) records.push({ kind: 'print.recorded', print: print.value });
  for (const test of [...state.tests.values()].sort((a, b) => compareDays(a.day, b.day) || compareText(a.id, b.id))) {
    records.push({ kind: 'test.set', test });
  }
  const decisions = [...state.decisions.values()].sort(
    (a, b) => compareText(a.courseId, b.courseId) || compareText(a.id, b.id),
  );
  for (const decision of decisions) {
    const undated = isChange(decision)
      ? (Object.fromEntries(Object.entries(decision).filter(([key]) => key !== 'day')) as typeof decision)
      : decision;
    records.push({ kind: 'plan.decided', decision: undated });
  }
  for (const duty of [...state.duties.values()].sort(compareDuties)) records.push({ kind: 'duty.set', duty });
  const catchUps = [...state.catchUps.values()].sort(
    (a, b) => compareDays(a.day, b.day) || compareSlots(a.slot, b.slot) || compareText(a.id, b.id),
  );
  for (const catchUp of catchUps) records.push({ kind: 'catchup.set', catchUp });
  const queues = [...state.supportQueues.values()].sort((a, b) => compareText(a.courseId, b.courseId));
  for (const queue of queues) records.push({ kind: 'support.set', queue });
  return records;
}

/**
 * What may leave the teacher on `route`: the current version of each record
 * whose layer the route takes. History entries stay with the teacher, so no
 * entry's day or place in the history travels, and nobody can work out when
 * a record was made, such as the day a session was confirmed (PRD §5.4,
 * §7.6).
 */
export function recordsForRoute(state: State, route: OutboundRoute): RecordEvent[] {
  return currentRecords(state).filter((record) => mayTravelAs(layerOf(record), record.kind, route));
}
