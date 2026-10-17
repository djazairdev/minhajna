// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The shared core of Minhajna's apps. It has no platform code, so the
// Android app and the web app give the same results (PRD §5.2).

export * from './calendar.ts';
export * from './calendar-read.ts';
export * from './canonical.ts';
export { courseSetup, refOf, type Choice, type CourseSetup, type Details } from './choices.ts';
export * from './context.ts';
export * from './day.ts';
export * from './demo-pupils.ts';
export * from './engine.ts';
export * from './events.ts';
export * from './format.ts';
export * from './history.ts';
export * from './id.ts';
export * from './layers.ts';
export * from './memory-store.ts';
export * from './pacing.ts';
export * from './pack.ts';
export * from './progress.ts';
export type { ParseProblem, ParseProblemKind, ParseResult } from './read.ts';
export * from './records.ts';
export * from './record-book.ts';
export * from './reference.ts';
export * from './reference-read.ts';
export * from './roll-call.ts';
export * from './roll-call-counts.ts';
export * from './sessions.ts';
export * from './state.ts';
export * from './today.ts';
