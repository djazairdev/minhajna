// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet, Text, TextInput } from 'react-native';
import type { PressableProps, StyleProp, TextInputProps, ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { sizes } from '../src/design/tokens';

/** What TalkBack reads for a control: its label, or else the text inside it. */
function spokenName(control: ReactTestInstance): string {
  const { accessibilityLabel } = control.props as PressableProps;
  if (typeof accessibilityLabel === 'string') return accessibilityLabel.trim();
  return control
    .findAllByType(Text)
    .map((text) => [text.props.children as unknown].flat().join(''))
    .join(' ')
    .trim();
}

/** The smallest a control's box can be, from its fixed or minimum size. */
function smallest(style: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>)) {
  const flat = StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) ?? {};
  const size = (fixed: unknown, minimum: unknown) =>
    Math.max(typeof fixed === 'number' ? fixed : 0, typeof minimum === 'number' ? minimum : 0);
  return { height: size(flat.height, flat.minHeight), width: size(flat.width, flat.minWidth) };
}

/** Include inactive choice controls too; their native state must not hide a missing name or target. */
function isControl(node: ReactTestInstance): boolean {
  const props = node.props as PressableProps;
  return (
    typeof props.onPress === 'function' ||
    (['button', 'checkbox', 'radio', 'tab', 'switch'].includes(props.accessibilityRole ?? '') &&
      props.accessibilityState?.disabled === true)
  );
}

/** How many native views a node draws. */
function views(node: ReactTestInstance): number {
  return node.findAll((inner) => typeof inner.type === 'string').length;
}

/**
 * A wrapper, such as Button around its Pressable, draws nothing but an inner
 * control. A control that draws more, such as a card holding a button, is a
 * control of its own and is checked too.
 */
function wraps(control: ReactTestInstance): boolean {
  return control.findAll(isControl).some((inner) => inner !== control && views(inner) === views(control));
}

/** Native edit boxes keep their intrinsic role; resolve their associated label, not their current value. */
function inputProblems(root: ReactTestInstance): string[] {
  return root.findAllByType(TextInput).flatMap((input) => {
    const props = input.props as TextInputProps;
    const ids = [props.accessibilityLabelledBy ?? []].flat();
    const labels = ids.map((id) => root.findAll((node) => node.props.nativeID === id)[0]);
    const name = ids.length
      ? labels
          .map((label) => (label ? spokenName(label) : ''))
          .join(' ')
          .trim()
      : spokenName(input);
    const where = name || props.testID || 'an input';
    const box = smallest(props.style);
    return [
      ...(labels.some((label) => !label) ? [`${where}: broken accessibilityLabelledBy`] : []),
      ...(name ? [] : [`${where}: nothing for TalkBack to read`]),
      ...(box.height >= sizes.target && box.width >= sizes.target
        ? []
        : [`${where}: smaller than ${sizes.target}dp (${box.width}×${box.height})`]),
    ];
  });
}

/**
 * Every control under a node that TalkBack or a thumb would miss: one with no
 * role, one with nothing to read out, or one smaller than 48dp either way
 * (PRD §6.8, docs/design/system/accessibility.md). Returns a line per
 * problem, so that a test can expect an empty list and show what is wrong.
 * A component that only wraps another control is checked through it.
 */
export function accessibilityProblems(root: ReactTestInstance): string[] {
  const controls = root.findAll(isControl).filter((control) => !wraps(control));
  const presses = controls.flatMap((control) => {
    const props = control.props as PressableProps;
    const name = spokenName(control);
    const where = name || props.testID || 'a control';
    const box = smallest(props.style);
    return [
      ...(props.accessibilityRole ? [] : [`${where}: no accessibilityRole`]),
      ...(name ? [] : [`${where}: nothing for TalkBack to read`]),
      ...(box.height >= sizes.target && box.width >= sizes.target
        ? []
        : [`${where}: smaller than ${sizes.target}dp (${box.width}×${box.height})`]),
    ];
  });
  return [...presses, ...inputProblems(root)];
}
