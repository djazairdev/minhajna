// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Roll-print's words for each choice (#217, answers 260 to 265): the choices
// with their lines, the slip only where the roll is called per session and
// the seating plan only for a class with one, the note under them, and what
// the blank version keeps.

import type { RollPrintChoice } from '../documents/roll-print-output';
import type { useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

/** The choices of what prints, for the spread's month and the summary's first and last months. */
export function whatChoices(
  t: Translate,
  options: {
    readonly month: string;
    readonly from: string;
    readonly to: string;
    readonly slip: boolean;
    readonly seats: boolean;
  },
): { value: RollPrintChoice; label: string; description: string }[] {
  return [
    { value: 'spread', label: t('rollPrint.spread', { month: options.month }), description: t('rollPrint.spreadLine') },
    {
      value: 'year',
      label: t('rollPrint.year'),
      description: t('rollPrint.yearLine', { from: options.from, to: options.to }),
    },
    { value: 'front', label: t('rollPrint.front.name'), description: t('rollPrint.front.line') },
    { value: 'day', label: t('rollPrint.day.name'), description: t('rollPrint.day.line') },
    ...(options.slip
      ? [{ value: 'slip' as const, label: t('rollPrint.slip.name'), description: t('rollPrint.slip.line') }]
      : []),
    ...(options.seats
      ? [{ value: 'seats' as const, label: t('rollPrint.seats.name'), description: t('rollPrint.seats.line') }]
      : []),
  ];
}

/** The note under the choices. */
export function choiceNote(t: Translate, choice: RollPrintChoice): string {
  const notes = {
    spread: 'rollPrint.spreadNote',
    year: 'rollPrint.yearNote',
    front: 'rollPrint.front.note',
    day: 'rollPrint.day.note',
    slip: 'rollPrint.slip.note',
    seats: 'rollPrint.seats.note',
  } as const satisfies Record<RollPrintChoice, string>;
  return t(notes[choice]);
}

/** What the blank version keeps, for the choices that have one. */
export function blankLine(t: Translate, choice: RollPrintChoice): string {
  if (choice === 'year') return t('rollPrint.blankYear');
  if (choice === 'front') return t('rollPrint.front.blank');
  return t('documents.output.blankRoll');
}
