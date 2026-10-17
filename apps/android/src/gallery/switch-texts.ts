// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

type Texts = { readonly label: string; readonly details: string; readonly description: string };

/** Synthetic display preferences, never a real sharing, signature or notification setting. */
export const switchTexts: Readonly<Record<Language, Texts>> = {
  ar: {
    label: 'إظهار عنوان تجريبي',
    details: 'عرض تفاصيل تجريبية',
    description:
      'شرح طويل لاختبار التفاف الكلمات عند تكبير الخط. هذا عرض وهمي فقط، لا يغيّر إعدادات التطبيق ولا يحفظ أو يرسل أي بيانات.',
  },
  fr: {
    label: 'Afficher un titre fictif',
    details: 'Afficher les détails fictifs',
    description:
      'Une longue explication pour vérifier les retours à la ligne avec un texte agrandi. Cet aperçu fictif ne change aucun réglage et ne conserve ni ne transmet aucune donnée.',
  },
  en: {
    label: 'Show a demo title',
    details: 'Show demo details',
    description:
      'A long explanation to check wrapping with enlarged text. This is only a made-up preview; it changes no app setting and neither saves nor sends any data.',
  },
};
