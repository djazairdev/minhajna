// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

/** A made-up world's date, as the band writes it in each language. */
export const demoBandTexts: Readonly<Record<Language, { date: string }>> = {
  ar: { date: 'الأحد 2 جوان 2030' },
  fr: { date: 'Dimanche 2 juin 2030' },
  en: { date: 'Sunday 2 June 2030' },
};
