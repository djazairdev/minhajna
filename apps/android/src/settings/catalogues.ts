// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ar from './text/ar.json';
import fr from './text/fr.json';
import en from './text/en.json';
import arBackup from './text/backup/ar.json';
import frBackup from './text/backup/fr.json';
import enBackup from './text/backup/en.json';

/** Settings' bundled namespace; no translation is downloaded. */
export const settingsCatalogues = {
  ar: { ...ar, savedFile: arBackup },
  fr: { ...fr, savedFile: frBackup },
  en: { ...en, savedFile: enBackup },
} as const;
