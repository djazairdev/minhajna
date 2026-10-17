// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

type Texts = {
  readonly view: string;
  readonly views: readonly [string, string];
  readonly period: string;
  readonly periods: readonly [string, string, string];
};

/** Made-up view switches; these do not open a real register or calendar. */
export const segmentedControlTexts: Readonly<Record<Language, Texts>> = {
  ar: {
    view: 'عرض تجريبي',
    views: ['القائمة', 'الجلوس'],
    period: 'فترة تجريبية',
    periods: ['اليوم', 'الأسبوع', 'الشهر'],
  },
  fr: {
    view: 'Vue fictive',
    views: ['Liste', 'Places'],
    period: 'Période fictive',
    periods: ['Jour', 'Semaine', 'Mois'],
  },
  en: { view: 'Demo view', views: ['List', 'Seats'], period: 'Demo period', periods: ['Day', 'Week', 'Month'] },
};
