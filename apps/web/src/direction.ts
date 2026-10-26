// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The interface's direction on the web (#250): right to left unless the kept
// language is French or English, as the phone app starts in Arabic before
// any choice. The page's own lang and dir follow, for the browser's
// screen reader and text layout.

import { keptLanguage } from './native/web-settings.ts';

export function isRtl(): boolean {
  const language = keptLanguage();
  return language !== 'fr' && language !== 'en';
}

/** Sets the page's language and direction from the kept language, before the app draws. */
export function applyDirection(): void {
  const language = keptLanguage();
  document.documentElement.lang = language === 'fr' || language === 'en' ? language : 'ar';
  document.documentElement.dir = isRtl() ? 'rtl' : 'ltr';
}
