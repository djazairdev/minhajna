// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up content for the CheckRow and OptionRow samples, in each interface
// language: never a real pupil, teacher or school.

import type { Language } from '../text/i18n';

export type ChoiceTexts = {
  readonly check: string;
  readonly stage: string;
  readonly option: string;
  readonly other: string;
  readonly privacy: string;
};

/** The CheckRow and OptionRow samples' texts, by interface language. */
export const choiceTexts: Readonly<Record<Language, ChoiceTexts>> = {
  ar: {
    check: 'أُجري فرض في هذه الحصة',
    stage: 'تصحيح الواجب المنزلي',
    option: 'لم تُعقد الحصة',
    other: 'إعادة درس سابق',
    privacy: 'ذكر السبب اختياري، ويبقى على الهاتف',
  },
  fr: {
    check: 'Un devoir a eu lieu pendant cette séance',
    stage: 'Correction du travail à la maison',
    option: 'Séance non tenue',
    other: 'Reprendre une leçon',
    privacy: 'Le motif est facultatif et reste sur le téléphone',
  },
  en: {
    check: 'A test took place in this session',
    stage: 'Going over homework',
    option: 'Session not held',
    other: 'Re-teach a lesson',
    privacy: 'A reason is optional and stays on this phone',
  },
};
