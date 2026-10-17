// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up content for the TextField samples, in each interface language:
// never a real pupil, teacher or school.

import type { Language } from '../text/i18n';

export type FieldTexts = {
  readonly label: string;
  readonly example: string;
  readonly value: string;
  readonly areaLabel: string;
  readonly areaValue: string;
  readonly noteLabel: string;
  readonly optionalLabel: string;
  readonly error: string;
  readonly codeLabel: string;
  readonly codeExample: string;
  readonly codeValue: string;
  readonly numberLabel: string;
  readonly numberExample: string;
  readonly numberValue: string;
};

/** The TextField samples' texts, by interface language. */
export const fieldTexts: Readonly<Record<Language, FieldTexts>> = {
  ar: {
    label: 'الواجب',
    example: 'مثال: التمرين 5',
    value: 'التمرين 5',
    areaLabel: 'المحتوى',
    areaValue: 'مراجعة الجمع.\nحلّ التمرين 5.\nتصحيح الحلّ.',
    noteLabel: 'ملاحظة',
    optionalLabel: 'اختياري',
    error: 'أدخل الواجب.',
    codeLabel: 'الرمز',
    codeExample: 'مثال: CEM-01',
    codeValue: 'CEM-01',
    numberLabel: 'العدد',
    numberExample: 'مثال: 12',
    numberValue: '12',
  },
  fr: {
    label: 'Devoir',
    example: 'Ex. : exercice 5',
    value: 'Exercice 5',
    areaLabel: 'Contenu',
    areaValue: 'Réviser l’addition.\nFaire l’exercice 5.\nCorriger les réponses.',
    noteLabel: 'Note',
    optionalLabel: 'facultatif',
    error: 'Indiquez le devoir.',
    codeLabel: 'Code',
    codeExample: 'Ex. : CEM-01',
    codeValue: 'CEM-01',
    numberLabel: 'Nombre',
    numberExample: 'Ex. : 12',
    numberValue: '12',
  },
  en: {
    label: 'Homework',
    example: 'e.g. Exercise 5',
    value: 'Exercise 5',
    areaLabel: 'Content',
    areaValue: 'Revise addition.\nDo exercise 5.\nCorrect the answers.',
    noteLabel: 'Note',
    optionalLabel: 'optional',
    error: 'Enter the homework.',
    codeLabel: 'Code',
    codeExample: 'e.g. CEM-01',
    codeValue: 'CEM-01',
    numberLabel: 'Number',
    numberExample: 'e.g. 12',
    numberValue: '12',
  },
};
