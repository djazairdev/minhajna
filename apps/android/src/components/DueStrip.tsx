// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { Button } from './Button';
import type { ControlIcon } from './control';

export type DueStripProps = {
  readonly icon: ControlIcon;
  /** One plain fact, such as «لا غياب مسجّل» or «يُسلَّم اليوم: التمرين 2 ص 21». */
  readonly fact: string;
  /** The soft button's words, such as «المناداة». */
  readonly action: string;
  readonly onOpen: () => void;
  readonly testID?: string;
};

/**
 * What goes with a session, inside its card: the roll call, or homework due
 * back today, with one soft button that opens the task
 * (docs/design/system/components/DueStrip). The icon is decorative: the fact
 * carries the meaning.
 */
export function DueStrip({ icon, fact, action, onOpen, testID }: DueStripProps) {
  const { direction } = useLocale();
  return (
    <View testID={testID} style={[styles.strip, { direction }]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {icon({ size: sizes['icon-small'], color: colors.ink2 })}
      </View>
      <Text style={[styles.fact, { writingDirection: direction, textAlign: 'start' }]}>{fact}</Text>
      <Button
        testID={testID === undefined ? undefined : `${testID}-open`}
        variant="soft"
        label={action}
        onPress={onOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-10'],
    padding: spacing['space-4'],
    paddingStart: spacing['space-12'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.due,
  },
  fact: { ...typography.body, fontSize: 14, lineHeight: 14 * 1.45, color: colors.ink, flex: 1 },
});
