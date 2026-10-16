// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every text the interface shows comes from a catalogue in i18next's JSON v4
// form, bundled with the app so that it works offline (docs/checks/message-catalogue.md).
// Arabic is the source language and the fallback. Counts come in as numbers
// and are written with Western digits (PRD §3.8). The interface stays in
// Arabic until the language choice and the French and English catalogues,
// which #21 adds next.

import i18next, { type TFunction } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import ar from './ar.json';
import { installPluralRules } from './plural-rules';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ar };
  }
}

/** The catalogues, by language code. */
export const catalogues = { ar } as const;

/** Keys asked for that no catalogue holds, for the tests: a screen must never show a key. */
export const missingKeys: string[] = [];

installPluralRules();

/** The app's one i18next instance, ready at import, since its catalogues ship in the APK. */
export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: 'ar',
  fallbackLng: 'ar',
  supportedLngs: Object.keys(catalogues),
  resources: { ar: { translation: ar } },
  initAsync: false,
  interpolation: { escapeValue: false },
  saveMissing: true,
  missingKeyHandler: (_languages, _namespace, key) => missingKeys.push(key),
  react: { useSuspense: false },
});

/** The function that turns a catalogue key into the interface's text. */
export function useText(): TFunction {
  return useTranslation().t;
}
