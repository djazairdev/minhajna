// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Button, type ButtonProps, type ButtonVariant } from '../src/components/Button';
import { IconButton, type IconButtonProps } from '../src/components/IconButton';
import type { ControlIcon } from '../src/components/control';
import { colorRoles, colors, sizes, typography } from '../src/design/tokens';
import { samples } from '../src/gallery/samples';

const variants: readonly ButtonVariant[] = ['primary', 'line', 'soft', 'plain', 'danger'];
const directions = ['rtl', 'ltr'] as const;
const icon: ControlIcon = ({ size, color }) => (
  <View testID="drawing" style={{ width: size, height: size, backgroundColor: color }} />
);
let tree: ReactTestRenderer.ReactTestRenderer;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
});

async function render(element: ReactElement, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree?.unmount();
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

/** Pressable's memo wrapper is unwrapped by React 19; query its native-control contract. */
function control() {
  const [node] = tree.root.findAll((node) => node.props.accessibilityRole === 'button' && !!node.props.onFocus);
  return node.props as PressableProps;
}

function box(pressed = false) {
  const { style } = control();
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style) ?? {};
}

describe.each(directions)('Button (%s)', (direction) => {
  test.each(variants.flatMap((variant) => [false, true].map((disabled) => [variant, disabled] as const)))(
    '%s, disabled=%s has a name, target, state and safe activation',
    async (variant, disabled) => {
      const onPress = jest.fn();
      const label = samples.ar.buttons[variant];
      await render(<Button variant={variant} label={label} disabled={disabled} onPress={onPress} />, direction);
      expect(accessibilityProblems(tree.root)).toEqual([]);
      expect(control()).toMatchObject({
        accessibilityRole: 'button',
        accessibilityLabel: label,
        disabled,
        accessibilityState: { disabled },
      });
      expect(box()).toMatchObject({ minWidth: sizes.target, minHeight: variant === 'primary' ? 56 : 48, direction });
      await ReactTestRenderer.act(() => {
        control().onPress?.({} as never);
      });
      expect(onPress).toHaveBeenCalledTimes(disabled ? 0 : 1);
      expect(box().opacity).toBe(disabled ? 0.45 : undefined);
    },
  );

  test.each(variants)('%s uses its colour roles and typography without clipping enlarged labels', async (variant) => {
    await render(<Button variant={variant} label={samples.ar.longHeading} onPress={() => undefined} />, direction);
    const label = tree.root.findByType(Text).props as TextProps;
    const dark = variant === 'primary' || variant === 'danger';
    const backgrounds = {
      primary: colors.board,
      line: colors.sheet,
      soft: colors.soft,
      plain: 'transparent',
      danger: colors.danger,
    };
    expect(box().backgroundColor).toBe(backgrounds[variant]);
    expect(box().height).toBeUndefined();
    expect(box().width).toBe(variant === 'primary' ? '100%' : undefined);
    expect(box().borderColor).toBe(variant === 'line' ? colorRoles.controlBorder : 'transparent');
    expect(box(true).borderColor).toBe(dark ? colors.chalk : colors.ink);
    expect(StyleSheet.flatten(label.style)).toMatchObject({
      ...(variant === 'primary' ? typography['button-primary'] : typography.button),
      color: dark ? colors.chalk : colors.ink,
      flexShrink: 1,
    });
    expect(label.allowFontScaling).not.toBe(false);
    expect(label.maxFontSizeMultiplier).toBeUndefined();
    expect(label.numberOfLines).toBeUndefined();
  });

  test('defaults to primary and keeps its leading icon decorative', async () => {
    await render(<Button label={samples.ar.buttons.primary} icon={icon} onPress={() => undefined} />, direction);
    expect(box().width).toBe('100%');
    const drawing = tree.root.findByProps({ testID: 'drawing' });
    expect(StyleSheet.flatten((drawing.props as ViewProps).style)).toMatchObject({
      width: 22,
      height: 22,
      backgroundColor: colors.chalk,
    });
    expect(drawing.parent?.props).toMatchObject({
      importantForAccessibility: 'no-hide-descendants',
      accessibilityElementsHidden: true,
      pointerEvents: 'none',
    });
    expect(accessibilityProblems(tree.root)).toEqual([]);
  });

  test.each(variants)('%s shows a focus ring, clears it on blur and hides it when disabled', async (variant) => {
    await render(<Button variant={variant} label={samples.ar.buttons[variant]} onPress={() => undefined} />, direction);
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    const rings = () => tree.root.findAll((node) => (node.props as ViewProps).accessible === false);
    expect(rings().length).toBeGreaterThan(0);
    expect(StyleSheet.flatten((rings()[0].props as ViewProps).style)).toMatchObject({
      top: 2,
      borderWidth: 2,
      borderColor: variant === 'primary' || variant === 'danger' ? colors.chalk : colors.ink,
    });
    await ReactTestRenderer.act(() => control().onBlur?.({} as never));
    expect(rings()).toHaveLength(0);
    await render(
      <Button variant={variant} label={samples.ar.buttons[variant]} disabled onPress={() => undefined} />,
      direction,
    );
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    expect(rings()).toHaveLength(0);
  });
});

describe.each(directions)('IconButton (%s)', (direction) => {
  test.each([false, true].flatMap((directional) => [false, true].map((disabled) => [directional, disabled] as const)))(
    'directional=%s, disabled=%s has one name, a round target and correct mirroring',
    async (directional, disabled) => {
      const onPress = jest.fn();
      await render(
        <IconButton
          icon={icon}
          accessibilityLabel={samples.ar.back}
          directional={directional}
          disabled={disabled}
          onPress={onPress}
        />,
        direction,
      );
      expect(accessibilityProblems(tree.root)).toEqual([]);
      expect(control()).toMatchObject({
        accessibilityLabel: samples.ar.back,
        disabled,
        accessibilityState: { disabled },
      });
      expect(box()).toMatchObject({ width: 48, height: 48, borderRadius: 24 });
      const drawing = tree.root.findByProps({ testID: 'drawing' });
      expect(StyleSheet.flatten((drawing.props as ViewProps).style)).toMatchObject({
        width: 22,
        height: 22,
        backgroundColor: colors.ink,
      });
      expect(drawing.parent?.props).toMatchObject({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      });
      expect(StyleSheet.flatten((drawing.parent?.props as ViewProps).style)).toMatchObject({
        direction: 'ltr',
        transform: [{ scaleX: directional && direction === 'rtl' ? -1 : 1 }],
      });
      await ReactTestRenderer.act(() => {
        control().onPress?.({} as never);
      });
      expect(onPress).toHaveBeenCalledTimes(disabled ? 0 : 1);
    },
  );

  test('uses a contrast-safe pressed ground and a focus ring without changing its target', async () => {
    await render(<IconButton icon={icon} accessibilityLabel={samples.ar.add} onPress={() => undefined} />, direction);
    expect(box(true)).toMatchObject({ width: 48, height: 48, backgroundColor: colors.soft });
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    const rings = () => tree.root.findAll((node) => node.props.accessible === false);
    expect(StyleSheet.flatten((rings()[0].props as ViewProps).style)).toMatchObject({
      borderColor: colors.focus,
      borderWidth: 2,
      borderRadius: 22,
    });
    await ReactTestRenderer.act(() => control().onBlur?.({} as never));
    expect(rings()).toHaveLength(0);
  });
});

/** Compile-time contracts matter: an unnamed icon control and an icon on a secondary action are invalid. */
function propContracts() {
  // @ts-expect-error Icon buttons must have a spoken name.
  const unnamed: IconButtonProps = { icon, onPress: () => undefined };
  // @ts-expect-error Only primary buttons have a leading icon.
  const secondary: ButtonProps = { variant: 'line', label: samples.ar.buttons.line, icon, onPress: () => undefined };
  return [unnamed, secondary];
}

test('keeps the accessibility and variant prop contracts checked by TypeScript', () => {
  expect(propContracts()).toHaveLength(2);
});
