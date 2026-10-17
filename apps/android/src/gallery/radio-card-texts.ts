// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

type Texts = {
  readonly group: string;
  readonly first: string;
  readonly firstDescription: string;
  readonly second: string;
  readonly longDescription: string;
};

/** Entirely synthetic plan choices, never an official plan or a real class assignment. */
export const radioCardTexts: Readonly<Record<Language, Texts>> = {
  ar: {
    group: 'خطط تجريبية',
    first: 'الخطة التجريبية أ',
    firstDescription: 'مثال مصطنع لعرض الاختيار فقط، وليس خطة رسمية.',
    second: 'الخطة التجريبية ب',
    longDescription:
      'مثال مصطنع بشرح طويل للتحقق من ظهور الكلمات كاملة عند تكبير الخط. لا يربط هذا الاختيار أي قسم بخطة ولا يحفظ سجلاً؛ تبقى كل التغييرات في هذا العرض التجريبي فقط.',
  },
  fr: {
    group: 'Plans fictifs',
    first: 'Plan fictif A',
    firstDescription: 'Exemple inventé pour montrer le choix, et non un plan officiel.',
    second: 'Plan fictif B',
    longDescription:
      'Exemple inventé avec une longue explication pour vérifier que tous les mots restent visibles avec un texte agrandi. Ce choix ne lie aucune classe à un plan et ne crée aucun registre ; les changements restent dans cet aperçu.',
  },
  en: {
    group: 'Demo plans',
    first: 'Demo plan A',
    firstDescription: 'An invented choice example, not an official plan.',
    second: 'Demo plan B',
    longDescription:
      'An invented example with a long explanation to check that every word remains visible with enlarged text. This choice does not assign any class to a plan or create a record; changes remain in this preview only.',
  },
};
