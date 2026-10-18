// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

/** Synthetic content states, never an assessment or ranking of a teacher. */
export const badgeTexts: Readonly<Record<Language, { default: string; done: string; warning: string; long: string }>> =
  {
    ar: { default: 'مثال', done: 'مؤكّدة', warning: 'بانتظار', long: 'التوزيع التجريبي' },
    fr: { default: 'Exemple', done: 'Confirmée', warning: 'En attente', long: 'Exemple pédagogique' },
    en: { default: 'Example', done: 'Confirmed', warning: 'Pending', long: 'Demonstration distribution' },
  };
