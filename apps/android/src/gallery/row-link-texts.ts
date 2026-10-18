// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

/** Made-up destinations for local preview actions; no navigation, data or message is sent. */
export const rowLinkTexts: Readonly<
  Record<Language, { short: string; long: string; description: string; disabled: string; unavailable: string }>
> = {
  ar: {
    short: 'ملخص تجريبي',
    long: 'ملخص الحصص والأقسام في الأسبوع التجريبي',
    description: 'حصص وأقسام مختلقة لاختبار التفاف العنوان والوصف عند تكبير الخط.',
    disabled: 'ملخص غير متاح',
    unavailable: 'هذا المثال غير متاح ولا يفتح أي شاشة.',
  },
  fr: {
    short: 'Résumé fictif',
    long: 'Résumé des séances et des classes de la semaine fictive',
    description: 'Séances et classes inventées pour vérifier les retours à la ligne avec un texte agrandi.',
    disabled: 'Résumé indisponible',
    unavailable: 'Cet exemple est indisponible et n’ouvre aucun écran.',
  },
  en: {
    short: 'Example summary',
    long: 'Summary of lessons and classes in the example week',
    description: 'Invented lessons and classes to check title and description wrapping with enlarged text.',
    disabled: 'Unavailable summary',
    unavailable: 'This example is unavailable and opens no screen.',
  },
};
