// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome page's «لغة الواجهة» row (Setup-1-Welcome): one chip per
// language, each named in its own language and script, so a teacher finds
// theirs whatever the interface shows.

import { ChipGroup } from '../components/Chip';
import { catalogues, chooseLanguage, currentLanguage, LANGUAGES, useText, type Language } from '../text/i18n';

/** Offers the interface languages; choosing one keeps it on this phone. */
export function LanguageChoice() {
  const t = useText();
  return (
    <ChipGroup
      testID="language"
      label={t('language.label')}
      choices={(Object.keys(catalogues) as Language[]).map((code) => ({
        value: code,
        label: t(`language.${code}`),
        script: LANGUAGES[code].rightToLeft ? 'arabic' : 'latin',
      }))}
      selected={currentLanguage()}
      onSelect={(code) => chooseLanguage(code)}
    />
  );
}
