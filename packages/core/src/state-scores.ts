// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The assessment records of the state (#238, #239): each course's setups in
// recorded order, and the last mark and capture for each cell. The state
// passes every event it does not keep itself here, and the others are left
// alone.

import type { AssessmentSetup } from './assessment.ts';
import { captureKey, type SessionCapture } from './captures.ts';
import type { RecordEvent } from './events.ts';
import { markKey, type MarkEntry } from './marks.ts';

export interface Scores {
  readonly assessment: Map<string, AssessmentSetup[]>;
  readonly marks: Map<string, MarkEntry>;
  readonly captures: Map<string, SessionCapture>;
}

export function newScores(): Scores {
  return { assessment: new Map(), marks: new Map(), captures: new Map() };
}

/** Keeps an assessment setup, a mark or a capture; any other event changes nothing. */
export function addScore(scores: Scores, event: RecordEvent): void {
  if (event.kind === 'assessment.set') {
    const { courseId } = event.setup;
    scores.assessment.set(courseId, [...(scores.assessment.get(courseId) ?? []), event.setup]);
  }
  if (event.kind === 'mark.set') scores.marks.set(markKey(event.mark), event.mark);
  if (event.kind === 'capture.set') scores.captures.set(captureKey(event.capture), event.capture);
}
