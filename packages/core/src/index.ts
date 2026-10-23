// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The shared core of Minhajna's apps. It has no platform code, so the
// Android app and the web app give the same results (PRD §5.2).

export * from './added-days.ts';
export * from './bells.ts';
export * from './bells-read.ts';
export * from './assessment.ts';
export * from './assessment-read.ts';
export * from './captures.ts';
export * from './marks.ts';
export * from './mark-fix.ts';
export * from './observations.ts';
export * from './appreciations.ts';
export * from './appreciations-read.ts';
export * from './mark-figures.ts';
export * from './capture-figures.ts';
export * from './component-figures.ts';
export * from './justification.ts';
export * from './grade-book.ts';
export * from './term-export.ts';
export * from './export-csv.ts';
export * from './export-check.ts';
export * from './calendar.ts';
export * from './rotating-groups.ts';
export { halfPair, halfPairs, type HalfTurn } from './half-pair.ts';
export { tdList, tdLists, type TdList, type TdRow } from './td-list.ts';
export { targetWeekOf, weekTargets, type WeekTarget } from './week-targets.ts';
export { ancestors, courseDecisions, lineageIds, type Ancestor } from './lineage.ts';
export { reorient, reorientedPupils, reorientRefusal, type Reorientation, type ReorientRefusal } from './reorient.ts';
export { halfTurns, rotationCredits, type Turns } from './rotation-sessions.ts';
export { keptClashAt, type KeptClash, type SessionMove } from './session-moves.ts';
export * from './lesson-notes.ts';
export * from './distributions.ts';
export {
  keepClash,
  moveRefusal,
  moveSession,
  reopenClash,
  unmoveSession,
  type MoveRefusal,
} from './session-move-add.ts';
export * from './calendar-read.ts';
export * from './calendar-edit.ts';
export * from './council.ts';
export * from './calendar-impact.ts';
export * from './calendar-lunar.ts';
export * from './calendar-notice-read.ts';
export * from './calendar-receive.ts';
export * from './calendar-received-match.ts';
export * from './canonical.ts';
export { courseSetup, refOf, type Choice, type CourseSetup, type Details } from './choices.ts';
export * from './context.ts';
export * from './day.ts';
export * from './demo-pupils.ts';
export * from './engine.ts';
export * from './events.ts';
export * from './extra.ts';
export * from './extra-records.ts';
export * from './format.ts';
export * from './hijri.ts';
export * from './hijri-read.ts';
export * from './history.ts';
export * from './history-inspection.ts';
export * from './history-damage.ts';
export * from './activity-log.ts';
export * from './retention.ts';
export * from './council-pack.ts';
export * from './homework.ts';
export * from './id.ts';
export * from './joint.ts';
export * from './layers.ts';
export * from './memory-store.ts';
export * from './pacing.ts';
export * from './carry-to.ts';
export * from './term-check-detail.ts';
export * from './plan-view.ts';
export * from './pack.ts';
export * from './pack-catalogue.ts';
export * from './progress.ts';
export * from './propose.ts';
export type { ParseProblem, ParseProblemKind, ParseResult } from './read.ts';
export * from './records.ts';
export * from './record-book.ts';
export * from './reference.ts';
export * from './reference-read.ts';
export * from './roll-call.ts';
export * from './roll-call-counts.ts';
export * from './roll-call-fix.ts';
export * from './roll-call-year.ts';
export * from './prints.ts';
export * from './corrections.ts';
export * from './exam-answers.ts';
export * from './catch-up.ts';
export * from './repace.ts';
export * from './repace-confirm.ts';
export * from './repace-print.ts';
export * from './repace-records.ts';
export * from './catch-up-add.ts';
export * from './catch-up-sessions.ts';
export * from './support-queue.ts';
export * from './list-pairs.ts';
export * from './exam-duties.ts';
export * from './exam-window.ts';
export * from './plan-decisions.ts';
export * from './plan-layer.ts';
export * from './plan-changes.ts';
export * from './plan-effects.ts';
export * from './plan-drift.ts';
export * from './digest.ts';
export * from './notify-times.ts';
export * from './signature.ts';
export * from './test-schedule.ts';
export * from './pupil-moves.ts';
export * from './seating.ts';
export * from './sessions.ts';
export * from './state.ts';
export * from './outbound-records.ts';
export * from './timings.ts';
export * from './today.ts';
export * from './backlog.ts';
export * from './week.ts';
export * from './calendar-update.ts';
export * from './pack-update.ts';
export * from './variant-layers.ts';
export * from './free-list.ts';
export * from './free-list-offer.ts';
export * from './variant-read.ts';
export * from './signed-read.ts';
