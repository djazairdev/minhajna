// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ar from './text/ar.json';
import fr from './text/fr.json';
import en from './text/en.json';

/** Calendar words ship with the app; no translation is fetched. */
export const calendarCatalogues = { ar, fr, en } as const;
