// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { CheckRow, type CheckRowProps } from '../src/components/CheckRow';
import { OptionRow, type OptionRowProps } from '../src/components/OptionRow';
import type { ControlIcon } from '../src/components/control';
import { colorRoles, colors } from '../src/design/tokens';
import { samples } from '../src/gallery/samples';

const icon: ControlIcon = ({ size, color }) => (
  <View testID="row-icon" style={{ width: size, height: size, backgroundColor: color }} />
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

function control() {
  return tree.root.findAll((node) => !!node.props.onFocus && !!node.props.accessibilityRole)[0].props as PressableProps;
}

function box(pressed = false) {
  const style = control().style;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style) ?? {};
}

function decorations() {
  return tree.root.findAllByType(View).filter((node) => node.props.importantForAccessibility === 'no-hide-descendants');
}

function rings() {
  return tree.root.findAllByType(View).filter((node) => node.props.accessible === false);
}

function ticks() {
  return tree.root
    .findAllByType(View)
    .filter((node) => StyleSheet.flatten((node.props as ViewProps).style)?.borderEndWidth === 2);
}

function expectGrowingText() {
  expect(box().height).toBeUndefined();
  for (const node of tree.root.findAllByType(Text)) {
    const props = node.props as TextProps;
    const style = StyleSheet.flatten(props.style);
    expect(props.numberOfLines).toBeUndefined();
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
    expect(props.adjustsFontSizeToFit).not.toBe(true);
    expect(style?.height).toBeUndefined();
    expect(style?.maxHeight).toBeUndefined();
    expect(style?.textAlign).toBe('start');
  }
}

describe.each(['rtl', 'ltr'] as const)('CheckRow (%s)', (direction) => {
  test.each([false, true].flatMap((checked) => [false, true].map((disabled) => [checked, disabled] as const)))(
    'checked=%s disabled=%s exposes one checkbox and requests the next value',
    async (checked, disabled) => {
      const onCheckedChange = jest.fn();
      const label = samples.ar.choices.check;
      await render(
        <CheckRow label={label} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />,
        direction,
      );
      expect(accessibilityProblems(tree.root)).toEqual([]);
      expect(control()).toMatchObject({
        accessible: true,
        accessibilityRole: 'checkbox',
        accessibilityLabel: label,
        accessibilityState: { checked, disabled },
        disabled,
      });
      expect(box()).toMatchObject({ minWidth: 48, minHeight: 48, width: '100%', direction });
      const square = decorations()[0].findAllByType(View)[1];
      expect(StyleSheet.flatten((square.props as ViewProps).style)).toMatchObject({
        direction: 'ltr',
        width: 22,
        height: 22,
        borderColor: checked ? colors.board : colorRoles.controlBorder,
        backgroundColor: checked ? colors.board : colors.sheet,
      });
      expect(ticks()).toHaveLength(checked ? 1 : 0);
      expect(decorations()[0].props.pointerEvents).toBe('none');
      await ReactTestRenderer.act(() => {
        control().onPress?.({} as never);
      });
      expect(onCheckedChange.mock.calls).toEqual(disabled ? [] : [[!checked]]);
      expect(control().accessibilityState?.checked).toBe(checked);
      expect(box().opacity).toBe(disabled ? 0.45 : undefined);
    },
  );

  test('wraps long labels, keeps direction and shows pressed/focus feedback', async () => {
    await render(<CheckRow label={samples.ar.longHeading} checked onCheckedChange={() => undefined} />, direction);
    expectGrowingText();
    expect(StyleSheet.flatten((tree.root.findByType(Text).props as TextProps).style)?.writingDirection).toBe(direction);
    expect(box(true).backgroundColor).toBe(colors.soft);
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    expect(StyleSheet.flatten((rings()[0].props as ViewProps).style)).toMatchObject({
      borderColor: colors.focus,
      borderWidth: 2,
    });
    await ReactTestRenderer.act(() => control().onBlur?.({} as never));
    expect(rings()).toHaveLength(0);
    await render(
      <CheckRow label={samples.ar.longHeading} checked disabled onCheckedChange={() => undefined} />,
      direction,
    );
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    expect(rings()).toHaveLength(0);
  });
});

describe.each(['rtl', 'ltr'] as const)('OptionRow (%s)', (direction) => {
  test.each(
    [undefined, false, true].flatMap((selected) =>
      [undefined, samples.ar.choices.privacy].flatMap((sub) =>
        [false, true].map((disabled) => [selected, sub, disabled] as const),
      ),
    ),
  )('selected=%s sub=%s disabled=%s keeps words and selection on one action', async (selected, sub, disabled) => {
    const onPress = jest.fn();
    const label = samples.ar.choices.option;
    await render(
      <OptionRow label={label} sub={sub} icon={icon} selected={selected} disabled={disabled} onPress={onPress} />,
      direction,
    );
    expect(accessibilityProblems(tree.root)).toEqual([]);
    expect(control()).toMatchObject({
      accessible: true,
      accessibilityRole: 'button',
      accessibilityLabel: sub ? `${label}. ${sub}` : label,
      accessibilityState: selected === undefined ? { disabled } : { disabled, selected },
      disabled,
    });
    expect(control().accessibilityState).not.toHaveProperty('checked');
    expect(box()).toMatchObject({
      minWidth: 48,
      minHeight: 52,
      width: '100%',
      direction,
      borderWidth: 1.5,
      backgroundColor: colors.sheet,
      borderColor: selected ? colors.board : colorRoles.controlBorder,
    });
    const drawing = tree.root.findByProps({ testID: 'row-icon' });
    expect(StyleSheet.flatten((drawing.props as ViewProps).style)).toMatchObject({
      width: 22,
      height: 22,
      backgroundColor: colors.ink,
    });
    expect(drawing.parent?.props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(decorations()).toHaveLength(selected === undefined ? 1 : 2);
    expect(ticks()).toHaveLength(selected ? 1 : 0);
    await ReactTestRenderer.act(() => {
      control().onPress?.({} as never);
    });
    expect(onPress).toHaveBeenCalledTimes(disabled ? 0 : 1);
    expect(control().accessibilityState?.selected).toBe(selected);
    expectGrowingText();
  });

  test.each([false, true])('directional=%s mirrors only the requested icon, not its label', async (directional) => {
    await render(
      <OptionRow
        label={samples.ar.longHeading}
        sub={samples.ar.choices.privacy}
        icon={icon}
        directional={directional}
        onPress={() => undefined}
      />,
      direction,
    );
    const drawing = tree.root.findByProps({ testID: 'row-icon' });
    expect(StyleSheet.flatten((drawing.parent?.props as ViewProps).style)).toMatchObject({
      direction: 'ltr',
      transform: [{ scaleX: directional && direction === 'rtl' ? -1 : 1 }],
    });
    for (const node of tree.root.findAllByType(Text))
      expect(StyleSheet.flatten((node.props as TextProps).style)?.writingDirection).toBe(direction);
    expectGrowingText();
    expect(box(true)).toMatchObject({ backgroundColor: colors.soft, borderColor: colors.ink });
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    expect(StyleSheet.flatten((rings()[0].props as ViewProps).style)).toMatchObject({
      borderColor: colors.focus,
      borderWidth: 2,
    });
    await ReactTestRenderer.act(() => control().onBlur?.({} as never));
    expect(rings()).toHaveLength(0);
    await render(
      <OptionRow label={samples.ar.choices.option} icon={icon} disabled onPress={() => undefined} />,
      direction,
    );
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    expect(rings()).toHaveLength(0);
  });
});

/** The screens must supply both the state and a callback; an option also needs a meaningful label and icon. */
function propContracts() {
  // @ts-expect-error Checkboxes cannot infer their state.
  const stateless: CheckRowProps = { label: samples.ar.choices.check, onCheckedChange: () => undefined };
  // @ts-expect-error Checkboxes cannot request a change without a callback.
  const inactive: CheckRowProps = { label: samples.ar.choices.check, checked: false };
  // @ts-expect-error Options require a visible and spoken label.
  const unnamed: OptionRowProps = { icon, onPress: () => undefined };
  return [stateless, inactive, unnamed];
}

test('keeps the controlled-state and label prop contracts checked by TypeScript', () => {
  expect(propContracts()).toHaveLength(3);
});
