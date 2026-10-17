// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

/** Made-up content for the sheet previews, never a real class or session. */
export type SheetTexts = {
  readonly open: string;
  readonly openLong: string;
  readonly openForm: string;
  readonly title: string;
  readonly context: string;
  readonly chosen: string;
  readonly cancelled: string;
};

/** The sheet previews' own words, kept out of release catalogues. */
export const sheetTexts: Readonly<Record<Language, SheetTexts>> = {
  ar: {
    open: 'عرض الخيارات',
    openLong: 'خيارات طويلة',
    openForm: 'خيار مع ملاحظة',
    title: 'كيف سارت الحصة؟',
    context: 'القسم التجريبي · حصة الرياضيات',
    chosen: 'اختيار تجريبي: {{choice}}',
    cancelled: 'أُغلقت المعاينة دون اختيار.',
  },
  fr: {
    open: 'Voir les choix',
    openLong: 'Choix longs',
    openForm: 'Choix et note',
    title: 'Comment s’est passée la séance ?',
    context: 'Classe de démonstration · Mathématiques',
    chosen: 'Choix de démonstration : {{choice}}',
    cancelled: 'Aperçu fermé sans choix.',
  },
  en: {
    open: 'Show choices',
    openLong: 'Long choices',
    openForm: 'Choice and note',
    title: 'How did the session go?',
    context: 'Demo class · Mathematics',
    chosen: 'Demo choice: {{choice}}',
    cancelled: 'Preview closed without choosing.',
  },
};
