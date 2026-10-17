// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up content for the SessionCard samples, in each interface language:
// never a real pupil, teacher or school.

import type { Language } from '../text/i18n';

export type SessionCardTexts = {
  readonly classes: readonly [string, string, string];
  readonly slots: readonly [string, string, string];
  readonly subject: string;
  readonly confirm: string;
  readonly other: string;
  readonly details: string;
  readonly lesson: string;
  readonly continued: string;
  readonly continuedNote: string;
  readonly written: string;
  readonly where: string;
  readonly show: string;
};

/** The SessionCard samples' texts, by interface language. */
export const sessionCardTexts: Readonly<Record<Language, SessionCardTexts>> = {
  ar: {
    classes: ['4م2', '4م1', '4م3'],
    slots: ['08:00 – 09:00', '10:00 – 11:00', '14:00 – 15:00'],
    subject: 'اللغة العربية',
    confirm: 'تمّت كما هو مقترح',
    other: 'نتيجة أخرى',
    details: 'تفاصيل الحصة',
    lesson: 'إنتاج المكتوب: خصائص القصة',
    continued: 'تابع: التضامن الاجتماعي',
    continuedNote: 'يتابع من الحصة السابقة: تحليل الخطاب ومناقشته',
    written: 'أعمال موجهة: مراجعة العدد والمعدود',
    where: 'كُتبت في دفتر النصوص، الصفحة 10',
    show: 'عرض',
  },
  fr: {
    classes: ['4AM2', '4AM1', '4AM3'],
    slots: ['08:00 – 09:00', '10:00 – 11:00', '14:00 – 15:00'],
    subject: 'Langue arabe',
    confirm: 'Faite comme proposé',
    other: 'Autre résultat',
    details: 'Détails de la séance',
    lesson: 'Production écrite : les traits du récit',
    continued: 'Suite : la solidarité sociale',
    continuedNote: 'Suite de la séance précédente : analyse et discussion du discours',
    written: 'Travaux dirigés : révision du nombre et du dénombré',
    where: 'Écrite dans le cahier de textes, page 10',
    show: 'Voir',
  },
  en: {
    classes: ['4AM2', '4AM1', '4AM3'],
    slots: ['08:00 – 09:00', '10:00 – 11:00', '14:00 – 15:00'],
    subject: 'Arabic',
    confirm: 'Done as proposed',
    other: 'Another outcome',
    details: 'Session details',
    lesson: 'Written production: what makes a story',
    continued: 'Continued: social solidarity',
    continuedNote: 'Continues from last session: analysing and discussing the speech',
    written: 'Guided work: revising numbers and counted nouns',
    where: 'Written in the texts book, page 10',
    show: 'Show',
  },
};
