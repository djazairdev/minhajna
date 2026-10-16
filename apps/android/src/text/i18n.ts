// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every text the interface shows comes from a catalogue in i18next's JSON v4
// form, bundled with the app so that it works offline (docs/checks/message-catalogue.md).
// Arabic is the source language and the fallback. Counts come in as numbers
// and are written with Western digits (PRD §3.8). The interface opens in
// Arabic, right to left, until the teacher chooses another language, whatever
// the phone's own language (#21, answer 157).

import i18next, { type TFunction } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import NativeInterface, { type Spec as InterfaceSettings } from '../native/NativeMinhajnaInterface';
import ar from './ar.json';
import en from './en.json';
import fr from './fr.json';
import { installPluralRules } from './plural-rules';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ar };
  }
}

/** The catalogues, by language code, in the order the interface offers them. */
export const catalogues = { ar, fr, en } as const;

export type Language = keyof typeof catalogues;

/** The interface languages, and whether each reads right to left. */
export const LANGUAGES: Readonly<Record<Language, { readonly rightToLeft: boolean }>> = {
  ar: { rightToLeft: true },
  fr: { rightToLeft: false },
  en: { rightToLeft: false },
};

/** Keys asked for that no catalogue holds, for the tests: a screen must never show a key. */
export const missingKeys: string[] = [];

export function isLanguage(code: unknown): code is Language {
  return typeof code === 'string' && Object.hasOwn(catalogues, code);
}

/** The language kept on this phone, or Arabic before any choice. */
export function startLanguage(settings: InterfaceSettings = NativeInterface): Language {
  const kept = settings.language();
  return isLanguage(kept) ? kept : 'ar';
}

installPluralRules();

/** The app's one i18next instance, ready at import, since its catalogues ship in the APK. */
export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: startLanguage(),
  fallbackLng: 'ar',
  supportedLngs: Object.keys(catalogues),
  resources: { ar: { translation: ar }, fr: { translation: fr }, en: { translation: en } },
  initAsync: false,
  interpolation: { escapeValue: false },
  saveMissing: true,
  missingKeyHandler: (_languages, _namespace, key) => missingKeys.push(key),
  react: { useSuspense: false },
});

/** The interface's current language. */
export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : 'ar';
}

/**
 * Keeps the teacher's choice. A language with the same direction applies at
 * once. One with the other direction restarts the interface, since Android
 * sets the direction only as React Native starts; the texts change with it,
 * so no screen shows one language in the other's direction.
 */
export function chooseLanguage(code: Language, settings: InterfaceSettings = NativeInterface): void {
  const current = currentLanguage();
  if (code === current) return;
  settings.setLanguage(code);
  if (LANGUAGES[code].rightToLeft === LANGUAGES[current].rightToLeft) void i18n.changeLanguage(code);
  else settings.restart();
}

/** The function that turns a catalogue key into the interface's text. */
export function useText(): TFunction {
  return useTranslation().t;
}
