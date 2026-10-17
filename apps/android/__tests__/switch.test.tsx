// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Switch, type SwitchProps } from '../src/components/Switch';
import { colorRoles, colors } from '../src/design/tokens';
import { switchTexts } from '../src/gallery/switch-texts';

let tree: ReactTestRenderer.ReactTestRenderer;
const cases = (['ar', 'fr', 'en'] as const).flatMap((language) =>
  (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
);

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

async function render(props: SwitchProps, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree?.unmount();
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <Switch {...props} />
      </LocaleDirContext.Provider>,
    );
  });
}

function control() {
  return tree.root.findAll((node) => node.props.accessibilityRole === 'switch' && !!node.props.onFocus)[0]
    .props as PressableProps;
}

function box(pressed = false) {
  const { style } = control();
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style) ?? {};
}

describe.each(cases)('Switch (%s, %s)', (language, direction) => {
  test.each(
    [false, true].flatMap((value) =>
      [false, true].flatMap((disabled) => [false, true].map((description) => [value, disabled, description] as const)),
    ),
  )(
    'value=%s disabled=%s description=%s is one full-row target with a caller-owned value',
    async (value, disabled, described) => {
      const text = switchTexts[language];
      const onValueChange = jest.fn();
      const description = described ? text.description : undefined;
      await render({ label: text.label, description, value, disabled, onValueChange, testID: 'setting' }, direction);
      expect(accessibilityProblems(tree.root)).toEqual([]);
      expect(control()).toMatchObject({
        accessible: true,
        accessibilityRole: 'switch',
        accessibilityLabel: described ? `${text.label}. ${description}` : text.label,
        accessibilityState: { checked: value, disabled },
        disabled,
        testID: 'setting',
      });
      expect(box()).toMatchObject({ direction, width: '100%', minWidth: 48, minHeight: 56 });
      expect(box().opacity).toBe(disabled ? 0.45 : undefined);
      const track = tree.root
        .findAllByType(View)
        .find((node) => node.props.importantForAccessibility === 'no-hide-descendants')!;
      expect(track.props.pointerEvents).toBe('none');
      expect(StyleSheet.flatten((track.props as ViewProps).style)).toMatchObject({
        width: 44,
        height: 26,
        backgroundColor: value ? colors.board : colors.rule,
        borderColor: value ? colors.board : colorRoles.controlBorder,
        justifyContent: value ? 'flex-end' : 'flex-start',
      });
      const thumb = track.findAllByType(View)[1];
      expect(StyleSheet.flatten((thumb.props as ViewProps).style)).toMatchObject({
        width: 20,
        height: 20,
        backgroundColor: colors.sheet,
        borderColor: colors.board,
      });
      await ReactTestRenderer.act(() => {
        control().onPress?.({} as never);
      });
      expect(onValueChange.mock.calls).toEqual(disabled ? [] : [[!value]]);
      expect(control().accessibilityState?.checked).toBe(value);
    },
  );

  test('keeps long text uncapped at 200%, with contrasting pressed and focus feedback', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    const text = switchTexts[language];
    await render(
      { label: text.details, description: text.description, value: false, onValueChange: () => undefined },
      direction,
    );
    expect(box().height).toBeUndefined();
    for (const node of tree.root.findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
      expect(props.adjustsFontSizeToFit).not.toBe(true);
      expect(StyleSheet.flatten(props.style)).toMatchObject({ writingDirection: direction, textAlign: 'start' });
    }
    expect(box(true)).toMatchObject({ backgroundColor: colors.sheet, borderColor: colors.ink });
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    const rings = () => tree.root.findAllByType(View).filter((node) => node.props.accessible === false);
    expect(StyleSheet.flatten((rings()[0].props as ViewProps).style)).toMatchObject({
      borderWidth: 2,
      borderColor: colors.focus,
    });
    await ReactTestRenderer.act(() => control().onBlur?.({} as never));
    expect(rings()).toHaveLength(0);
    await render({ label: text.label, value: true, disabled: true, onValueChange: () => undefined }, direction);
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    expect(rings()).toHaveLength(0);
  });
});

/** Neither the default nor persistence can be inferred by this control. */
function contracts() {
  // @ts-expect-error A caller must explicitly provide the initial/current value.
  const implicit: SwitchProps = { label: 'Demo', onValueChange: () => undefined };
  // @ts-expect-error A value without a caller callback is not a switch.
  const noChange: SwitchProps = { label: 'Demo', value: false };
  return [implicit, noChange];
}

test('checks the caller-owned switch value and callback contracts', () => expect(contracts()).toHaveLength(2));
