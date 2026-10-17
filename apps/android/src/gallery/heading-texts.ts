// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up content for the PageHeading and SectionHeader samples, in each
// interface language: never a real pupil, teacher or school.

import type { Language } from '../text/i18n';

export type HeadingTexts = {
  readonly day: string;
  readonly date: string;
  readonly fact: string;
  readonly scope: string;
  readonly settings: string;
  readonly addSession: string;
  readonly section: string;
  readonly count: string;
  readonly emptyCount: string;
};

/** The PageHeading and SectionHeader samples' texts, by interface language. */
export const headingTexts: Readonly<Record<Language, HeadingTexts>> = {
  ar: {
    day: 'الأحد',
    date: '4 أكتوبر 2026',
    fact: '3 حصص بانتظار التأكيد',
    scope: 'المؤسسة التجريبية · 2026/2027',
    settings: 'الإعدادات',
    addSession: '+ حصة',
    section: 'الفوج الأول',
    count: '18 تلميذاً',
    emptyCount: '0 تلاميذ',
  },
  fr: {
    day: 'Dimanche',
    date: '4 octobre 2026',
    fact: '3 séances attendent une confirmation',
    scope: 'Établissement de démonstration · 2026/2027',
    settings: 'Réglages',
    addSession: '+ Séance',
    section: 'Premier groupe',
    count: '18 élèves',
    emptyCount: '0 élève',
  },
  en: {
    day: 'Sunday',
    date: '4 October 2026',
    fact: '3 sessions await confirmation',
    scope: 'Demo school · 2026/2027',
    settings: 'Settings',
    addSession: '+ Session',
    section: 'First group',
    count: '18 pupils',
    emptyCount: '0 pupils',
  },
};
