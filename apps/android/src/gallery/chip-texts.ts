// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up content for the Chip and SetupSteps samples, in each interface
// language: never a real pupil, teacher or school.

import type { Language } from '../text/i18n';

export type ChipTexts = {
  readonly type: string;
  readonly types: readonly [string, string, string];
  readonly level: string;
  readonly levels: readonly [string, string, string];
  readonly levelHint: string;
  readonly long: string;
  readonly more: string;
  readonly step: string;
};

/** The Chip and SetupSteps samples' texts, by interface language. */
export const chipTexts: Readonly<Record<Language, ChipTexts>> = {
  ar: {
    type: 'نوع الحصة',
    types: ['حصة عادية', 'مراجعة', 'تقويم'],
    level: 'المستوى',
    levels: ['ابتدائي', 'متوسط', 'ثانوي'],
    levelHint: 'يمكن اختيار أكثر من مستوى.',
    long: 'التربية العلمية والتكنولوجية مع الأفواج الصغيرة',
    more: 'مستويات أخرى',
    step: 'الخطوة {{step}} من {{count}}',
  },
  fr: {
    type: 'Type de séance',
    types: ['Séance ordinaire', 'Révision', 'Évaluation'],
    level: 'Niveau',
    levels: ['Primaire', 'Moyen', 'Secondaire'],
    levelHint: 'Vous pouvez choisir plusieurs niveaux.',
    long: 'Éducation scientifique et technologique en petits groupes',
    more: 'Autres niveaux',
    step: 'Étape {{step}} sur {{count}}',
  },
  en: {
    type: 'Session type',
    types: ['Ordinary session', 'Revision', 'Assessment'],
    level: 'Level',
    levels: ['Primary', 'Middle school', 'Secondary'],
    levelHint: 'You can choose more than one level.',
    long: 'Science and technology with small groups',
    more: 'Other levels',
    step: 'Step {{step}} of {{count}}',
  },
};
