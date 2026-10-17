// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up weeks for the WeekGrid samples, in each interface language: a
// middle-school teacher of three classes, and a primary French specialist
// whose classes come to them by turn. Never a real teacher or school.

import type { Language } from '../text/i18n';

export type WeekGridTexts = {
  readonly middle: string;
  readonly primary: string;
  readonly days: readonly [string, string, string, string, string];
  readonly morning: string;
  readonly afternoon: string;
  readonly halves: readonly [string, string];
  /** The slot's short label, such as «ص1». */
  readonly short: string;
  readonly spoken: string;
  readonly name: string;
  readonly empty: string;
  readonly own: string;
  readonly hint: string;
  readonly middleClasses: readonly [string, string, string];
  readonly primaryClasses: readonly [string, string, string, string];
};

/** The WeekGrid samples' texts, by interface language. */
export const weekGridTexts: Readonly<Record<Language, WeekGridTexts>> = {
  ar: {
    middle: 'أستاذ متوسط: ثلاثة أقسام',
    primary: 'أستاذ فرنسية في الابتدائي: الخانات قابلة للنقر',
    days: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
    morning: 'ص',
    afternoon: 'م',
    halves: ['صباحاً', 'مساءً'],
    short: '{{half}}{{index}}',
    spoken: 'الحصة {{index}} {{half}}',
    name: '{{day}}، {{slot}}: {{content}}',
    empty: 'فارغة',
    own: 'وقت خاص',
    hint: 'يغيّر الخانة',
    middleClasses: ['4م1', '4م2', '4م3'],
    primaryClasses: ['3إ1', '3إ2', '4إ1', '5إ1'],
  },
  fr: {
    middle: 'Professeur de collège : trois classes',
    primary: 'Professeur de français au primaire : cases à toucher',
    days: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi'],
    morning: 'M',
    afternoon: 'S',
    halves: ['matin', 'après-midi'],
    short: '{{half}}{{index}}',
    spoken: 'séance {{index}} du {{half}}',
    name: '{{day}}, {{slot}} : {{content}}',
    empty: 'libre',
    own: 'Temps propre',
    hint: 'Change la case',
    middleClasses: ['4AM1', '4AM2', '4AM3'],
    primaryClasses: ['3AP1', '3AP2', '4AP1', '5AP1'],
  },
  en: {
    middle: 'Middle-school teacher: three classes',
    primary: 'Primary French specialist: cells can be tapped',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    morning: 'M',
    afternoon: 'A',
    halves: ['Morning', 'Afternoon'],
    short: '{{half}}{{index}}',
    spoken: '{{half}} session {{index}}',
    name: '{{day}}, {{slot}}: {{content}}',
    empty: 'empty',
    own: 'Own time',
    hint: 'Changes the slot',
    middleClasses: ['4AM1', '4AM2', '4AM3'],
    primaryClasses: ['3AP1', '3AP2', '4AP1', '5AP1'],
  },
};
