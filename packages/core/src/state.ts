// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the screens show is worked out from the history (PRD §5.5).

import type { Day } from './day.ts';
import type { ExtraSession } from './extra-records.ts';
import type { Entry } from './history.ts';
import type { HomeworkCount } from './homework.ts';
import type { CatchUpSession } from './catch-up-sessions.ts';
import type { ExamDuty } from './exam-duties.ts';
import type { PlanDecision } from './plan-decisions.ts';
import type { PrintRecord } from './prints.ts';
import type { AppliedUpdate } from './calendar-update.ts';
import type { AddedPack } from './pack-update.ts';
import { freeListFits, type FreeList } from './free-list.ts';
import { layerKey, signedAsItsLevel, switchKey, type AddedLayer, type LayerSwitch } from './variant-layers.ts';
import { packKey, type CalendarEntry } from './reference.ts';
import type { CountingRules } from './roll-call-counts.ts';
import type { Repace } from './repace-records.ts';
import type { KeptClash, SessionMove } from './session-moves.ts';
import type { LessonNote } from './lesson-notes.ts';
import type { Retention } from './retention.ts';
import { readPersonal } from './signature.ts';
import { kindOf, listKey, type SupportQueue } from './support-queue.ts';
import type { ScheduledTest } from './test-schedule.ts';
import type {
  Course,
  PrivateNote,
  Pupil,
  RollCall,
  School,
  SchoolClass,
  SeatingPlan,
  SessionRecord,
  TeacherCard,
  TeacherPersonal,
} from './records.ts';
import { eventOf } from './events.ts';
import { erasedPupils } from './erased-pupils.ts';
import { withMovements, type Membership, type Movement } from './pupil-history.ts';
import { restatements, standingOrder } from './restated.ts';
import { addTimetable, type RecordedTimetable } from './timetable-history.ts';
import { addScore, newScores } from './state-scores.ts';
import type { State } from './state-type.ts';
import { versionOf, type Version } from './versions.ts';

export type { RecordedTimetable } from './timetable-history.ts';
export { current, type Version } from './versions.ts';
export type { State } from './state-type.ts';

/** Builds the state from the history entries; a restated roll call stands as the entry it replaced (answer 473). */
export function buildState(entries: readonly Entry[]): State {
  let teacher: TeacherCard | null = null;
  let personal: TeacherPersonal | null = null;
  const schools = new Map<string, School>();
  const classes = new Map<string, SchoolClass>();
  const pupilSets = new Map<string, { readonly pupil: Pupil; readonly order: number }>();
  const moved = new Map<string, Movement[]>();
  const memberships = new Map<string, Membership[]>();
  const rollCallOrders = new Map<string, number>();
  const courses = new Map<string, Course>();
  const timetables: RecordedTimetable[] = [];
  let firstTimetable: string | undefined;
  const calendar = new Map<string, CalendarEntry>();
  const calendarUpdates = new Map<string, AppliedUpdate>();
  const calendarUpdatedOn = new Map<string, Day>();
  const addedPacks = new Map<string, AddedPack>();
  const layers = new Map<string, AddedLayer>();
  const layerSwitches = new Map<string, LayerSwitch>();
  const lists = new Map<string, FreeList>();
  const sessions = new Map<string, Version<SessionRecord | null>[]>();
  const notes = new Map<string, PrivateNote>();
  const extras = new Map<string, Version<ExtraSession | null>[]>();
  const homeworkCounts = new Map<string, Version<HomeworkCount | null>[]>();
  const rollCalls = new Map<string, Version<RollCall>[]>();
  const seating = new Map<string, SeatingPlan>();
  let counting: CountingRules | null = null;
  let setupFinished = false;
  let retention: Retention | null = null;
  const scores = newScores();
  const prints: Version<PrintRecord>[] = [];
  const tests = new Map<string, ScheduledTest>();
  const decisions = new Map<string, PlanDecision>();
  const duties = new Map<string, ExamDuty>();
  const catchUps = new Map<string, CatchUpSession>();
  const supportQueues = new Map<string, SupportQueue>();
  const repaces = new Map<string, Repace>();
  const keptClashes = new Map<string, KeptClash>();
  const moves = new Map<string, SessionMove>();
  const lessonNotes = new Map<string, LessonNote>();
  const restated = restatements(entries);

  for (const [order, entry] of entries.entries()) {
    const event = restated.replaced.has(entry.id) ? null : eventOf(entry);
    if (event === null) continue;
    switch (event.kind) {
      case 'teacher.set':
        teacher = event.card;
        break;
      case 'teacher.personal.set':
        personal = readPersonal(event.personal);
        break;
      case 'school.set':
        schools.set(event.school.id, event.school);
        break;
      case 'class.set':
        classes.set(event.schoolClass.id, event.schoolClass);
        break;
      case 'pupil.set':
        pupilSets.set(event.pupil.id, { pupil: event.pupil, order });
        memberships.set(event.pupil.id, [
          ...(memberships.get(event.pupil.id) ?? []),
          { day: entry.day, order: entry.seq, groups: event.pupil.groups },
        ]);
        break;
      case 'pupil.moved':
        moved.set(event.pupilId, [...(moved.get(event.pupilId) ?? []), { movement: event.movement, order }]);
        break;
      case 'course.set':
        courses.set(event.course.id, event.course);
        break;
      case 'timetable.set':
        firstTimetable ??= event.version.id;
        addTimetable(timetables, event.version, entry.day, firstTimetable);
        break;
      case 'calendar.set':
        calendar.delete(event.entry.id);
        calendar.set(event.entry.id, event.entry);
        break;
      case 'calendar.removed':
        calendar.delete(event.id);
        break;
      case 'calendar.updated':
        calendarUpdates.set(event.applied.update.release, event.applied);
        if (!calendarUpdatedOn.has(event.applied.update.release))
          calendarUpdatedOn.set(event.applied.update.release, entry.day);
        break;
      case 'pack.added':
        addedPacks.set(packKey(event.added.update.pack.id, event.added.update.pack.release), event.added);
        break;
      case 'layer.added':
        if (!layers.has(layerKey(event.added.layer)) && signedAsItsLevel(event.added))
          layers.set(layerKey(event.added.layer), event.added);
        break;
      case 'layer.switched':
        layerSwitches.set(switchKey(event.switched.courseId, event.switched.level), event.switched);
        break;
      case 'list.set':
        if (freeListFits(event.list)) lists.set(event.list.courseId, event.list);
        break;
      case 'session.recorded': {
        const key = event.record.session.key;
        sessions.set(key, [...(sessions.get(key) ?? []), versionOf(entry, event.record, event.correction)]);
        break;
      }
      case 'session.withdrawn': {
        const key = event.session.key;
        sessions.set(key, [...(sessions.get(key) ?? []), versionOf<SessionRecord | null>(entry, null)]);
        break;
      }
      case 'session.noted':
        notes.set(event.note.sessionKey, event.note);
        break;
      case 'homework.counted': {
        const key = event.count.sessionKey;
        homeworkCounts.set(key, [...(homeworkCounts.get(key) ?? []), versionOf(entry, event.count)]);
        break;
      }
      case 'homework.uncounted':
        homeworkCounts.set(event.sessionKey, [
          ...(homeworkCounts.get(event.sessionKey) ?? []),
          versionOf<HomeworkCount | null>(entry, null),
        ]);
        break;
      case 'extra.logged':
        extras.set(event.extra.id, [...(extras.get(event.extra.id) ?? []), versionOf(entry, event.extra)]);
        break;
      case 'extra.removed':
        extras.set(event.id, [...(extras.get(event.id) ?? []), versionOf<ExtraSession | null>(entry, null)]);
        break;
      case 'roll-call.taken': {
        const key = event.rollCall.unit;
        const { seq, day } = restated.of.get(entry.id) ?? entry;
        rollCallOrders.set(key, Math.min(rollCallOrders.get(key) ?? seq, seq));
        rollCalls.set(key, [...(rollCalls.get(key) ?? []), versionOf(entry, event.rollCall, event.reason, day)]);
        break;
      }
      case 'seating.set':
        seating.set(`${event.plan.classId}/${event.plan.groupId}`, event.plan);
        break;
      case 'counting.set':
        counting = event.rules;
        break;
      case 'setup.finished':
        setupFinished = true;
        break;
      case 'print.recorded':
        prints.push(versionOf(entry, event.print));
        break;
      case 'test.set':
        tests.set(event.test.id, event.test);
        break;
      case 'test.removed':
        tests.delete(event.id);
        break;
      case 'plan.decided':
        decisions.set(event.decision.id, event.decision);
        break;
      case 'plan.undecided':
        decisions.delete(event.id);
        break;
      case 'duty.set':
        duties.set(event.duty.id, event.duty);
        break;
      case 'duty.removed':
        duties.delete(event.id);
        break;
      case 'catchup.set':
        catchUps.set(event.catchUp.id, event.catchUp);
        break;
      case 'catchup.removed':
        catchUps.delete(event.id);
        break;
      case 'support.set':
        supportQueues.set(listKey(event.queue.courseId, kindOf(event.queue)), event.queue);
        break;
      case 'repace.set':
        repaces.set(event.repace.id, event.repace);
        break;
      case 'repace.removed':
        repaces.delete(event.id);
        break;
      case 'clash.kept':
        keptClashes.set(event.kept.id, event.kept);
        break;
      case 'clash.reopened':
        keptClashes.delete(event.id);
        break;
      case 'move.set':
        moves.set(event.move.id, event.move);
        break;
      case 'move.removed':
        moves.delete(event.id);
        break;
      case 'lesson-note.set':
        lessonNotes.set(event.note.id, event.note);
        break;
      case 'retention.set':
        retention = event.retention;
        break;
      default:
        addScore(scores, event, entry);
    }
  }
  if (restated.of.size > 0)
    for (const [key, list] of rollCalls) rollCalls.set(key, standingOrder(list, entries, restated));
  const pupils = new Map<string, Pupil>();
  for (const [id, { pupil, order }] of pupilSets) pupils.set(id, withMovements(pupil, order, moved.get(id) ?? []));

  return {
    teacher,
    personal,
    schools,
    classes,
    pupils,
    memberships,
    rollCallOrders,
    erasedPupils: erasedPupils(entries, memberships),
    courses,
    timetables,
    calendar: [...calendar.values()],
    calendarUpdates: [...calendarUpdates.values()],
    calendarUpdatedOn,
    addedPacks: [...addedPacks.values()],
    layers: [...layers.values()],
    layerSwitches,
    lists,
    sessions,
    notes,
    extras,
    homeworkCounts,
    rollCalls,
    seating,
    counting,
    setupFinished,
    prints,
    tests,
    decisions,
    duties,
    catchUps,
    supportQueues,
    repaces,
    keptClashes,
    moves,
    lessonNotes,
    retention,
    ...scores,
  };
}
