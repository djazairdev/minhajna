// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome page's «لغة الواجهة» row (Setup-1-Welcome): one chip per
// language, each named in its own language and script, so a teacher finds
// theirs whatever the interface shows. On the board, the chosen chip is chalk
// with board text, as the design's selected chips invert their ground.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, sizes, spacing, typography } from '../design/tokens';
import { catalogues, chooseLanguage, currentLanguage, LANGUAGES, useText, type Language } from '../text/i18n';

/** Offers the interface languages; choosing one keeps it on this phone. */
export function LanguageChoice() {
  const t = useText();
  const current = currentLanguage();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('language.label')}>
      <Text style={styles.label}>{t('language.label')}</Text>
      <View style={styles.chips}>
        {(Object.keys(catalogues) as Language[]).map((code) => {
          const chosen = code === current;
          return (
            <Pressable
              key={code}
              testID={`language-${code}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              onPress={() => chooseLanguage(code)}
              style={[styles.chip, chosen && styles.chosen]}
            >
              <Text
                style={[
                  styles.name,
                  LANGUAGES[code].rightToLeft ? styles.arabic : styles.latin,
                  chosen && styles.chosenName,
                ]}
              >
                {t(`language.${code}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'stretch', alignItems: 'center', marginTop: spacing['space-20'] },
  label: { ...typography.label, color: colors.chalk, textAlign: 'center' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing['space-8'],
    marginTop: spacing['space-8'],
  },
  chip: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-16'],
    borderRadius: radius['radius-chip'],
    borderWidth: 1.5,
    borderColor: colors.chalk,
  },
  chosen: { backgroundColor: colors.chalk },
  name: { ...typography.button, color: colors.chalk, textAlign: 'center' },
  arabic: { writingDirection: 'rtl' },
  latin: { fontFamily: fontFamilyForWeight(fontFamilies.latin, '600'), writingDirection: 'ltr' },
  chosenName: { color: colors.board },
});
