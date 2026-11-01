// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ar from './text/ar.json';
import fr from './text/fr.json';
import en from './text/en.json';
import eraseAr from './text/erase/ar.json';
import eraseFr from './text/erase/fr.json';
import eraseEn from './text/erase/en.json';

/** Settings' bundled namespace; no translation is downloaded. */
export const settingsCatalogues = {
  ar: { ...ar, eraseTransfer: eraseAr },
  fr: { ...fr, eraseTransfer: eraseFr },
  en: { ...en, eraseTransfer: eraseEn },
} as const;
