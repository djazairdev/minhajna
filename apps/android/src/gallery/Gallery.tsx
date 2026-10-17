// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The component gallery (#20): each component in each of its states, with
// made-up content, for whoever builds or reviews one. It opens from React
// Native's developer menu, in debug builds only, so teachers never see it.
// The direction switch lays the components out right to left or left to
// right, whatever the interface language; the phone's own text size shows at
// the top, so that 200% is checked by changing it in the phone's settings.

import { LocaleDirContext } from '@react-navigation/native';
import { useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colorRoles, colors, fontFamilies, radius, sizes, spacing, typography } from '../design/tokens';
import { currentLanguage, LANGUAGES } from '../text/i18n';
import { entries } from './entries';
import { GalleryScroll } from './GalleryScroll';
import { fill, samples } from './samples';

type Direction = 'rtl' | 'ltr';

/** No insets for the samples: a bar in the middle of the gallery is not at the screen's edge. */
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

/** Shows every component on the gallery, laid out in the chosen direction. */
export function Gallery() {
  const insets = useSafeAreaInsets();
  const language = currentLanguage();
  const sample = samples[language];
  const [direction, setDirection] = useState<Direction>(LANGUAGES[language].rightToLeft ? 'rtl' : 'ltr');
  return (
    <GalleryScroll
      contentContainerStyle={{
        paddingBottom: spacing['space-20'] + insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <View style={styles.controls}>
        <Text style={styles.note}>
          {fill(sample.textSize, { percent: Math.round(PixelRatio.getFontScale() * 100) })}
        </Text>
        <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel={sample.direction}>
          {(['rtl', 'ltr'] as const).map((choice) => (
            <Pressable
              key={choice}
              testID={`gallery-${choice}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: choice === direction }}
              onPress={() => setDirection(choice)}
              style={[styles.choice, choice === direction && styles.chosen]}
            >
              <Text style={[styles.choiceLabel, choice === direction && styles.chosenLabel]}>{sample[choice]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {entries.map((entry) => (
        <View key={entry.name} testID={`gallery-entry-${entry.name}`} style={styles.entry}>
          <View style={styles.entryHead}>
            <Text accessibilityRole="header" style={styles.name}>
              {entry.name}
            </Text>
            <Text style={styles.design}>{sample.design}</Text>
            <Text style={styles.path}>{entry.design}</Text>
          </View>
          <SafeAreaInsetsContext.Provider value={NO_INSETS}>
            <LocaleDirContext.Provider value={direction}>
              <View style={[styles.states, { direction }]}>{entry.render(sample)}</View>
            </LocaleDirContext.Provider>
          </SafeAreaInsetsContext.Provider>
        </View>
      ))}
    </GalleryScroll>
  );
}

const styles = StyleSheet.create({
  controls: { padding: spacing['space-16'], gap: spacing['space-12'] },
  note: { ...typography.body, color: colors.ink2 },
  switch: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  choice: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-16'],
    borderRadius: radius['radius-chip'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    backgroundColor: colors.sheet,
  },
  chosen: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceLabel: { ...typography.button, color: colors.ink },
  chosenLabel: { color: colors.sheet },
  entry: { marginTop: spacing['space-16'], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  entryHead: { padding: spacing['space-16'], gap: spacing['space-4'] },
  name: { ...typography.h3, color: colors.ink },
  design: { ...typography.fact, color: colors.ink2 },
  path: {
    ...typography.fact,
    color: colors.ink2,
    fontFamily: fontFamilies.latin,
    writingDirection: 'ltr',
  },
  states: { gap: spacing['space-12'], backgroundColor: colors.paper },
});
