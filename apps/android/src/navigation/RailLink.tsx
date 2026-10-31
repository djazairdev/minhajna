// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the PC's rails share (#251 and #562), after the design's WebShell: the
// board at the start of the window, the project's name in `brand` or a
// deployment's in bold Naskh at 20px, who and where in `chalk-75`, links in
// `chalk-82` with the current one on `chalk-14`, and the outlined buttons at
// the foot.

import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { controlStyles } from '../components/control';
import { fontFamilyForWeight } from '../design/fonts';
import { colorRoles, colors, fontFamilies, radius, sizes, spacing, typography } from '../design/tokens';

export type RailLinkProps = {
  readonly testID: string;
  readonly label: string;
  readonly selected: boolean;
  /** A tab of the rail's list, rather than a button below it. */
  readonly tab: boolean;
  readonly round?: boolean;
  readonly onPress: () => void;
};

/** One link of a rail, its line icon then its label. */
export function RailLink({ testID, label, selected, tab, round = false, onPress }: RailLinkProps) {
  const { direction } = useLocale();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={tab ? 'tab' : 'button'}
      accessibilityLabel={label}
      aria-selected={tab ? selected : undefined}
      onPress={onPress}
      style={[styles.link, selected && styles.selected]}
    >
      <View importantForAccessibility="no-hide-descendants" style={[styles.icon, round && styles.round]}>
        <View style={styles.rule} />
      </View>
      <Text
        style={[styles.label, selected && styles.selectedLabel, { writingDirection: direction, textAlign: 'start' }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** An outlined button at a rail's foot. */
export function RailButton({
  testID,
  label,
  disabled = false,
  onPress,
}: Pick<RailLinkProps, 'testID' | 'label' | 'onPress'> & { readonly disabled?: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && controlStyles.disabled]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export const railStyles = StyleSheet.create({
  rail: {
    width: sizes['web-sidebar'],
    gap: spacing['space-4'],
    paddingTop: spacing['space-20'],
    paddingBottom: spacing['space-16'],
    paddingHorizontal: spacing['space-14'],
    backgroundColor: colors.board,
  },
  brand: {
    ...typography.brand,
    fontSize: 40,
    lineHeight: 46,
    color: colors.chalk,
    paddingHorizontal: spacing['space-10'],
  },
  who: {
    ...typography.caption,
    color: colors['chalk-75'],
    paddingHorizontal: spacing['space-10'],
    paddingBottom: spacing['space-14'],
  },
  dep: {
    fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'),
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 28,
    color: colors.chalk,
    paddingTop: spacing['space-6'],
    paddingHorizontal: spacing['space-10'],
    paddingBottom: spacing['space-10'],
  },
  links: { gap: spacing['space-4'] },
  foot: { marginTop: 'auto', gap: spacing['space-8'], paddingHorizontal: spacing['space-10'] },
  line: { ...typography.caption, color: colors['chalk-75'] },
});

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-10'],
    minHeight: sizes.target,
    paddingHorizontal: spacing['space-12'],
    borderRadius: radius['radius-button'],
  },
  selected: { backgroundColor: colors['chalk-14'] },
  icon: {
    width: sizes['icon-small'],
    height: sizes['icon-small'],
    borderWidth: 1.5,
    borderRadius: 3,
    borderColor: colors['chalk-82'],
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  round: { borderRadius: sizes['icon-small'] / 2 },
  rule: { height: 1.5, backgroundColor: colors['chalk-82'] },
  label: { ...typography.body, flexShrink: 1, color: colors['chalk-82'] },
  selectedLabel: {
    color: colors.chalk,
    fontWeight: '700',
    fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'),
  },
  button: {
    minHeight: sizes.target,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: radius['radius-button'],
    borderColor: colorRoles.boardControlBorder,
  },
  buttonLabel: { ...typography.button, color: colors.chalk },
});
