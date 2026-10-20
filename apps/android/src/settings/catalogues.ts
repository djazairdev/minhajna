// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ar from './text/ar.json';
import fr from './text/fr.json';
import en from './text/en.json';

/** Settings' bundled namespace; no translation is downloaded. */
export const settingsCatalogues = { ar, fr, en } as const;
