// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

type ChartFigureTexts = {
  readonly label: string;
  readonly categoryLabel: string;
  readonly categories: readonly string[];
  readonly latest: string;
  readonly earlier: string;
};

/** A made-up chart of how far three wilayas got, read on two days, in each language. */
export const chartFigureTexts: Readonly<Record<Language, ChartFigureTexts>> = {
  ar: {
    label: 'نسبة ما أُنجز من المخطط، بالمائة',
    categoryLabel: 'الولاية',
    categories: ['الولاية أ', 'الولاية ب', 'الولاية ج'],
    latest: 'يوم الأرقام 25/04',
    earlier: 'نهاية الفصل الثاني 21/03',
  },
  fr: {
    label: 'Part du plan faite, en pourcentage',
    categoryLabel: 'Wilaya',
    categories: ['Wilaya A', 'Wilaya B', 'Wilaya C'],
    latest: 'Jour des chiffres 25/04',
    earlier: 'Fin du 2e trimestre 21/03',
  },
  en: {
    label: 'Share of the plan done, in percent',
    categoryLabel: 'Wilaya',
    categories: ['Wilaya A', 'Wilaya B', 'Wilaya C'],
    latest: 'Figures day 25/04',
    earlier: 'End of term 2, 21/03',
  },
};
