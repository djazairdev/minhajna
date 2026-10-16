// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The gallery's own words and its made-up content, in each interface language.
// The gallery is a developer's tool in debug builds only, so these texts stay
// out of the catalogues and out of Weblate. A component's own texts, such as
// its screen-reader labels, still come from the catalogue. Content is made up:
// never a real pupil, teacher or school.

import type { Language } from '../text/i18n';

export type Sample = {
  readonly title: string;
  readonly textSize: string;
  readonly direction: string;
  readonly rtl: string;
  readonly ltr: string;
  readonly design: string;
  readonly heading: string;
  readonly longHeading: string;
  readonly tabs: readonly [string, string, string];
  readonly longTabs: readonly [string, string, string];
};

/** The gallery's texts and made-up content, by interface language. */
export const samples: Readonly<Record<Language, Sample>> = {
  ar: {
    title: 'معرض المكوّنات',
    textSize: 'حجم الخط: {{percent}}%. غيّره من إعدادات الهاتف.',
    direction: 'الاتجاه',
    rtl: 'من اليمين',
    ltr: 'من اليسار',
    design: 'صفحته في نظام التصميم:',
    heading: 'حصة الرياضيات',
    longHeading: 'تصحيح الفرض المحروس الأول في الرياضيات مع القسم الأول متوسط',
    tabs: ['اليوم', 'الأقسام', 'الوثائق'],
    longTabs: ['حصص اليوم كلها', 'أقسامي هذه السنة', 'وثائق المؤسسة'],
  },
  fr: {
    title: 'Galerie des composants',
    textSize: 'Taille du texte : {{percent}} %. Changez-la dans les réglages du téléphone.',
    direction: 'Sens',
    rtl: 'De droite à gauche',
    ltr: 'De gauche à droite',
    design: 'Sa page dans le système de conception :',
    heading: 'Séance de mathématiques',
    longHeading: 'Correction du premier devoir surveillé de mathématiques avec la première année moyenne',
    tabs: ['Aujourd’hui', 'Classes', 'Documents'],
    longTabs: ['Toutes les séances du jour', 'Mes classes de l’année', 'Documents de l’établissement'],
  },
  en: {
    title: 'Component gallery',
    textSize: 'Text size: {{percent}}%. Change it in the phone’s settings.',
    direction: 'Direction',
    rtl: 'Right to left',
    ltr: 'Left to right',
    design: 'Its page in the design system:',
    heading: 'Mathematics lesson',
    longHeading: 'Going over the first mathematics test with the first year of middle school',
    tabs: ['Today', 'Classes', 'Documents'],
    longTabs: ['All of today’s lessons', 'My classes this year', 'The school’s documents'],
  },
};

/** Fills a sample's {{name}} placeholders. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => String(values[name] ?? whole));
}
