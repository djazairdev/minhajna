// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

type Texts = {
  readonly label: string;
  readonly unit: string;
  readonly longUnit: string;
  readonly decrease: string;
  readonly increase: string;
  readonly fixed: string;
};

/** Made-up exercise counts only; no pupil, mark, attendance or other record is held. */
export const stepperTexts: Readonly<Record<Language, Texts>> = {
  ar: {
    label: 'أمثلة غير منجزة',
    unit: 'من 3 أمثلة تجريبية',
    longUnit:
      'من 36 مثالاً تجريبياً؛ شرح طويل للتحقق من ظهور الكلمات كاملة عند تكبير الخط، ولا يُحفظ هذا العدد في أي سجل.',
    decrease: 'تقليل عدد الأمثلة غير المنجزة',
    increase: 'زيادة عدد الأمثلة غير المنجزة',
    fixed: 'عدد تجريبي ثابت',
  },
  fr: {
    label: 'Exemples non terminés',
    unit: 'Sur 3 exemples fictifs',
    longUnit:
      'Sur 36 exemples fictifs ; une longue explication pour vérifier que tous les mots restent visibles avec un texte agrandi. Ce nombre ne rejoint aucun registre.',
    decrease: 'Réduire le nombre d’exemples non terminés',
    increase: 'Augmenter le nombre d’exemples non terminés',
    fixed: 'Nombre fictif fixe',
  },
  en: {
    label: 'Unfinished examples',
    unit: 'Out of 3 demo examples',
    longUnit:
      'Out of 36 made-up examples; a long explanation to check that every word remains visible with enlarged text. This count is not saved in any record.',
    decrease: 'Decrease the number of unfinished examples',
    increase: 'Increase the number of unfinished examples',
    fixed: 'Fixed demo count',
  },
};
