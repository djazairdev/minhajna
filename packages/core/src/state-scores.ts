// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The assessment records of the state (#238 to #241): each course's setups in
// recorded order, the last mark, capture, descriptive observation and
// appreciation for each cell, and the last averaging formula recorded for each
// course. The state passes every event it does not keep itself here, and the
// others are left alone.

import type { AssessmentSetup, FormulaId } from './assessment.ts';
import { captureKey, type SessionCapture } from './captures.ts';
import type { RecordEvent } from './events.ts';
import { markKey, type MarkEntry } from './marks.ts';
import { observationKey, type ObservationEntry } from './observations.ts';
import { appreciationKey, type AppreciationEntry } from './appreciations.ts';

export interface Scores {
  readonly assessment: Map<string, AssessmentSetup[]>;
  readonly marks: Map<string, MarkEntry>;
  readonly captures: Map<string, SessionCapture>;
  readonly formulas: Map<string, FormulaId>;
  readonly observations: Map<string, ObservationEntry>;
  readonly appreciations: Map<string, AppreciationEntry>;
}

export function newScores(): Scores {
  return {
    assessment: new Map(),
    marks: new Map(),
    captures: new Map(),
    formulas: new Map(),
    observations: new Map(),
    appreciations: new Map(),
  };
}

/** Keeps a setup, a mark, a capture, a formula, an observation or an appreciation; any other changes nothing. */
export function addScore(scores: Scores, event: RecordEvent): void {
  if (event.kind === 'assessment.set') {
    const { courseId } = event.setup;
    scores.assessment.set(courseId, [...(scores.assessment.get(courseId) ?? []), event.setup]);
  }
  if (event.kind === 'mark.set') scores.marks.set(markKey(event.mark), event.mark);
  if (event.kind === 'capture.set') scores.captures.set(captureKey(event.capture), event.capture);
  if (event.kind === 'formula.set') scores.formulas.set(event.courseId, event.formula);
  if (event.kind === 'observation.set') {
    scores.observations.set(observationKey(event.observation), event.observation);
  }
  if (event.kind === 'appreciation.set') {
    scores.appreciations.set(appreciationKey(event.appreciation), event.appreciation);
  }
}
