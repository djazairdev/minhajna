// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome page's «لغة الواجهة» row (Setup-1-Welcome): one chip per
// language, each named in its own language and script, so a teacher finds
// theirs whatever the interface shows. As the design's chips: the chosen one
// is board with chalk text, the others sheet with an outline that keeps 3:1.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilyForWeight } from '../design/fonts';
import { useLocale } from '@react-navigation/native';
import { colorRoles, colors, fontFamilies, radius, sizes, spacing, typography } from '../design/tokens';
import { catalogues, chooseLanguage, currentLanguage, LANGUAGES, useText, type Language } from '../text/i18n';

/** Offers the interface languages; choosing one keeps it on this phone. */
export function LanguageChoice() {
  const t = useText();
  const current = currentLanguage();
  const { direction } = useLocale();
  return (
    <View style={[styles.row, { direction }]} accessibilityRole="radiogroup" accessibilityLabel={t('language.label')}>
      <Text style={[styles.label, { writingDirection: direction, textAlign: 'start' }]}>{t('language.label')}</Text>
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
  row: { alignSelf: 'stretch', gap: spacing['space-6'] },
  label: { ...typography.label, color: colors.ink2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  chip: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-14'],
    borderRadius: radius['radius-chip'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    backgroundColor: colors.sheet,
  },
  chosen: { backgroundColor: colors.board, borderColor: colors.board },
  name: { ...typography.chip, color: colors.ink, textAlign: 'center' },
  arabic: { writingDirection: 'rtl' },
  latin: { fontFamily: fontFamilyForWeight(fontFamilies.latin, '500'), writingDirection: 'ltr' },
  chosenName: { color: colors.chalk },
});
