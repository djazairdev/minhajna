// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

/** Made-up step results, including an exclusion whose meaning must be spoken. */
export const factsTexts: Readonly<
  Record<Language, { kept: string; notKept: string; classes: string; week: string; long: string; excluded: string }>
> = {
  ar: {
    kept: 'تم الاحتفاظ به',
    notKept: 'لم يتم الاحتفاظ به',
    classes: '3 أقسام تجريبية',
    week: 'الأسبوع التجريبي',
    long: 'التوزيع التجريبي للحصص والأقسام في المدرسة الأولى والمدرسة الثانية، بكامل تفاصيله المختلقة.',
    excluded: 'ملاحظة خاصة تجريبية',
  },
  fr: {
    kept: 'Conservé',
    notKept: 'Non conservé',
    classes: '3 classes fictives',
    week: 'La semaine fictive',
    long: 'La répartition fictive des séances et des classes dans la première et la deuxième école, avec tous ses détails inventés.',
    excluded: 'Une note privée fictive',
  },
  en: {
    kept: 'Kept',
    notKept: 'Not kept',
    classes: '3 example classes',
    week: 'The example week',
    long: 'The example allocation of lessons and classes in the first and second school, including all its invented details.',
    excluded: 'An example private note',
  },
};
