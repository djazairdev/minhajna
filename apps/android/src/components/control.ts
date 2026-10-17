// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { PressableProps } from 'react-native';
import { spacing } from '../design/tokens';

/** Decorative icon supplied by the caller, using the control's size and foreground. */
export type ControlIcon = (props: { size: number; color: string }) => ReactNode;

/** Behaviour shared by labelled controls; screen text comes from the caller's catalogue. */
export type ControlProps = {
  readonly onPress: NonNullable<PressableProps['onPress']>;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

/** Inactive controls retain their target; an inset ring cannot be clipped by a parent's bounds. */
export const controlStyles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  focus: {
    position: 'absolute',
    top: spacing['space-2'],
    bottom: spacing['space-2'],
    start: spacing['space-2'],
    end: spacing['space-2'],
    borderWidth: 2,
  },
});
