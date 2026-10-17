// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import type { ControlIcon } from './control';

/** Translated instructions belong to the screen; a notice badge is a concise word, not a colour-only warning. */
export type NoticeProps = {
  readonly message: string;
  readonly testID?: string;
} & (
  | { readonly variant?: 'reassurance'; readonly icon: ControlIcon; readonly badge?: never; readonly title?: never }
  | { readonly variant: 'notice'; readonly badge: string; readonly title?: string; readonly icon?: never }
);

/** A quiet reassurance or a dashed instruction, grouped once; logical text alignment avoids Android's RTL left/right swap. */
export function Notice(props: NoticeProps) {
  const { direction } = useLocale();
  const textDirection = { writingDirection: direction, textAlign: 'start' } as const;
  const boxed = props.variant === 'notice';
  const name = boxed ? [props.badge, props.title, props.message].filter(Boolean).join('. ') : props.message;
  return (
    <View
      testID={props.testID}
      accessible
      accessibilityLabel={name}
      style={[boxed ? styles.notice : styles.reassurance, { direction }]}
    >
      {props.variant === 'notice' ? (
        <>
          <Text style={[styles.badge, textDirection]}>{props.badge}</Text>
          {!!props.title && <Text style={[styles.title, textDirection]}>{props.title}</Text>}
          <Text style={[styles.instruction, textDirection]}>{props.message}</Text>
        </>
      ) : (
        <>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {props.icon({ size: sizes['icon-small'], color: colors.ink2 })}
          </View>
          <Text style={[styles.message, textDirection]}>{props.message}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  reassurance: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-6'] },
  message: { ...typography.small, color: colors.ink2, flex: 1 },
  notice: {
    gap: spacing['space-8'],
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors['notice-edge'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.notice,
  },
  badge: {
    ...typography.badge,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-2'],
    borderRadius: radius['radius-badge'],
    color: colors['notice-ink'],
    backgroundColor: colors['notice-strong'],
  },
  title: { ...typography.label, color: colors.ink },
  instruction: { ...typography.caption, color: colors.ink },
});
