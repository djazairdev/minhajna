// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A problem report as it leaves the phone (#249, Report, R-1.5-10, answer
// 483): what happened, in the teacher's words with every pupil's name
// replaced, the part of the app, the version, Android's version and the
// last screens opened, by name only. Its lines are shown as they are shared
// through Android's share sheet; the app adds no class, school, pupil or
// record, and bidi controls are taken out of what the teacher types.

import { replaceNames, type NamedPupil } from '@minhajna/core';
import { plain } from '../plan/error-report';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;

export const PARTS = ['today', 'classes', 'roll', 'marks', 'plan', 'documents', 'settings', 'other'] as const;
export type Part = (typeof PARTS)[number];

/** The longest note a report takes. */
export const NOTE_LIMIT = 1000;

export type ProblemReport = {
  readonly note: string;
  readonly part: Part;
  /** The app's version, as Help shows it. */
  readonly version: string;
  /** Android's version, such as 14. */
  readonly android: string;
  readonly steps: readonly string[];
};

/** The note as it is sent: bidi controls out, and every pupil's name replaced. */
export function safeNote(t: Translate, note: string, pupils: readonly NamedPupil[]): string {
  return replaceNames(plain(note).trim(), pupils, (n) => t('report.pupil', { n }));
}

/** The report's lines, in the teacher's language, exactly as they are shared. */
export function problemLines(t: Translate, report: ProblemReport): string[] {
  return [
    t('report.heading'),
    t('report.lineNote', { note: isolate(report.note) }),
    t('report.linePart', { part: t(`report.parts.${report.part}`) }),
    t('report.lineVersion', { version: isolate(report.version), android: isolate(report.android) }),
    t('report.lineSteps', {
      steps: report.steps.length === 0 ? t('report.noSteps') : isolate(report.steps.join(' › ')),
    }),
  ];
}
