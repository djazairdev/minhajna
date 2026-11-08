// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard's words (answers 821 and 855): its own catalogue, which only
// the dashboard app ships, added under the `dashboard` key of the teacher
// app's text instance as this module loads, so the shared components keep
// their words beside it. A key is typed from the Arabic catalogue; the
// teacher app's keys stay readable, as the week's day names.

import type { TFunction, TOptions } from 'i18next';
import { useDeviceText } from '../../android/src/text/device-text';
import { i18n } from '../../android/src/text/i18n';
import { dashboardCatalogues } from './catalogues';

for (const [language, words] of Object.entries(dashboardCatalogues))
  i18n.addResourceBundle(language, 'translation', { dashboard: words }, true, true);

/** Every key of a catalogue under `prefix`, its parts joined by dots. */
type Keys<T, Prefix extends string> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Keys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** A key of the dashboard's catalogue. */
export type DashboardKey = Keys<typeof dashboardCatalogues.ar, 'dashboard.'>;

/** The dashboard's text function, which reads the teacher app's keys too. */
export type DashboardText = ((key: DashboardKey, options?: TOptions) => string) & TFunction;

/** The dashboard's words on this device, the PC's wording first where it has one. */
export function useDashboardText(): DashboardText {
  return useDeviceText() as unknown as DashboardText;
}

/** A word of the dashboard outside a screen, as the page's title, in the interface's language. */
export function dashboardWord(key: DashboardKey): string {
  return (i18n.t as unknown as DashboardText)(key);
}
