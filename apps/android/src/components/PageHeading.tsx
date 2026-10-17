// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../design/tokens';
import type { ControlIcon } from './control';

/** Screens supply translated, neutral wording; dates/scopes are already formatted, never inferred here. */
export type PageHeadingProps = {
  readonly title: string;
  readonly scope: string;
  readonly fact?: { readonly text: string; readonly icon: ControlIcon };
  /** Independent labelled controls, not part of the heading's accessible group. */
  readonly actions?: ReactNode;
  readonly testID?: string;
};

/** A wrapping display heading, with enough line space for the bundled Ruqaa face rather than clipping its ink. */
export function PageHeading({ title, scope, fact, actions, testID }: PageHeadingProps) {
  const { direction } = useLocale();
  const { fontScale } = useWindowDimensions();
  const textDirection = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID={testID} style={[styles.group, { direction }]}>
      <View style={[styles.top, fontScale >= 1.5 && styles.stacked]}>
        <View style={[styles.heading, fontScale >= 1.5 && styles.stackedHeading]}>
          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              textDirection,
              { paddingVertical: spacing['space-12'] * fontScale, paddingHorizontal: spacing['space-2'] * fontScale },
            ]}
          >
            {title}
          </Text>
          <Text style={[styles.scope, textDirection]}>{scope}</Text>
        </View>
        {actions != null && <View style={styles.actions}>{actions}</View>}
      </View>
      {fact && (
        <View style={styles.fact}>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {fact.icon({ size: sizes['icon-small'], color: colors.ink2 })}
          </View>
          <Text style={[styles.factText, textDirection]}>{fact.text}</Text>
        </View>
      )}
    </View>
  );
}

/** Native font metrics leave room for Ruqaa's overhangs; the canvas's fixed 1.2 line height clips on Android. */
const styles = StyleSheet.create({
  group: {
    paddingHorizontal: spacing['space-20'],
    paddingTop: spacing['space-14'],
    paddingBottom: spacing['space-8'],
    gap: spacing['space-2'],
  },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing['space-8'] },
  heading: { flexGrow: 1, flexShrink: 1, flexBasis: '40%', minWidth: 0, gap: spacing['space-2'] },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  stackedHeading: { flexBasis: 'auto', width: '100%' },
  title: {
    fontFamily: typography.day.fontFamily,
    fontSize: typography.day.fontSize,
    fontWeight: typography.day.fontWeight,
    color: colors.ink,
  },
  scope: { ...typography.fact, color: colors.ink2 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '100%',
    marginStart: 'auto',
    gap: spacing['space-8'],
  },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-6'] },
  factText: { ...typography.fact, color: colors.ink2, flex: 1 },
});
