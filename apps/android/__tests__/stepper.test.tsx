// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Stepper, type StepperProps } from '../src/components/Stepper';
import { colorRoles, colors, typography } from '../src/design/tokens';
import { stepperTexts } from '../src/gallery/stepper-texts';

let tree: ReactTestRenderer.ReactTestRenderer;
const cases = (['ar', 'fr', 'en'] as const).flatMap((language) =>
  (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
);
const text = stepperTexts.ar;
const base: StepperProps = {
  label: text.label,
  unit: text.unit,
  decreaseLabel: text.decrease,
  increaseLabel: text.increase,
  value: 1,
  min: 0,
  max: 2,
  onValueChange: () => undefined,
  testID: 'count',
};

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

async function render(props: StepperProps, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree?.unmount();
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <Stepper {...props} />
      </LocaleDirContext.Provider>,
    );
  });
}

function controls() {
  return tree.root
    .findAll((node) => node.props.accessibilityRole === 'button' && !!node.props.onFocus, { deep: false })
    .map((node) => node.props as PressableProps);
}

function box(props: PressableProps, pressed = false) {
  return StyleSheet.flatten(typeof props.style === 'function' ? props.style({ pressed }) : props.style) ?? {};
}

describe.each(cases)('Stepper (%s, %s)', (language, direction) => {
  test.each([0, 1, 2].flatMap((value) => [false, true].map((disabled) => [value, disabled] as const)))(
    'value=%s disabled=%s names both buttons, respects bounds and leaves the current value to its caller',
    async (value, disabled) => {
      const words = stepperTexts[language];
      const onValueChange = jest.fn();
      await render(
        {
          ...base,
          label: words.label,
          unit: words.unit,
          decreaseLabel: words.decrease,
          increaseLabel: words.increase,
          value,
          disabled,
          onValueChange,
        },
        direction,
      );
      expect(accessibilityProblems(tree.root)).toEqual([]);
      const buttons = controls();
      expect(buttons).toHaveLength(2);
      const limits = [disabled || value === 0, disabled || value === 2];
      for (const [index, button] of buttons.entries()) {
        expect(button).toMatchObject({
          accessible: true,
          accessibilityRole: 'button',
          accessibilityLabel: index === 0 ? words.decrease : words.increase,
          accessibilityState: { disabled: limits[index] },
          disabled: limits[index],
        });
        expect(box(button)).toMatchObject({
          width: 48,
          height: 48,
          minWidth: 48,
          minHeight: 48,
          borderWidth: 1.5,
          borderColor: colorRoles.controlBorder,
        });
        expect(box(button, true)).toMatchObject({ backgroundColor: colors.soft, borderColor: colors.ink });
        await ReactTestRenderer.act(() => {
          button.onPress?.({} as never);
        });
      }
      expect(onValueChange.mock.calls).toEqual([
        ...(limits[0] ? [] : [[value - 1]]),
        ...(limits[1] ? [] : [[value + 1]]),
      ]);
      const output = tree.root.findAllByType(Text).find((node) => node.props.testID === 'count-value')!;
      expect(output.props).toMatchObject({
        accessible: true,
        accessibilityLiveRegion: 'polite',
        accessibilityLabel: `${words.label}: ${value}. ${words.unit}`,
        children: String(value),
      });
      expect(String(output.props.children)).toMatch(/^\d+$/);
      expect(StyleSheet.flatten((output.props as TextProps).style)).toMatchObject({
        ...typography.stepper,
        writingDirection: 'ltr',
        textAlign: 'center',
      });
      const unit = tree.root
        .findAllByType(Text)
        .find((node) => node.props.importantForAccessibility === 'no-hide-descendants')!;
      expect(unit.props.children).toBe(words.unit);
      expect(StyleSheet.flatten((unit.props as TextProps).style)?.writingDirection).toBe(direction);
      expect(StyleSheet.flatten((tree.root.findAllByType(View)[0].props as ViewProps).style)?.direction).toBe(
        direction,
      );
    },
  );

  test('leaves large text uncapped and keeps focus feedback on the individual button', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    const words = stepperTexts[language];
    await render({ ...base, unit: words.longUnit }, direction);
    for (const node of tree.root.findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
      expect(props.adjustsFontSizeToFit).not.toBe(true);
      expect(StyleSheet.flatten(props.style)?.height).toBeUndefined();
    }
    for (const at of [0, 1]) {
      await ReactTestRenderer.act(() => controls()[at].onFocus?.({} as never));
      const rings = () => tree.root.findAllByType(View).filter((node) => node.props.accessible === false);
      expect(StyleSheet.flatten((rings()[0].props as ViewProps).style)).toMatchObject({
        borderWidth: 2,
        borderColor: colors.focus,
      });
      await ReactTestRenderer.act(() => controls()[at].onBlur?.({} as never));
      expect(rings()).toHaveLength(0);
    }
    await render({ ...base, disabled: true }, direction);
    await ReactTestRenderer.act(() => controls()[0].onFocus?.({} as never));
    expect(tree.root.findAllByType(View).filter((node) => node.props.accessible === false)).toHaveLength(0);
  });
});

test('equal bounds disable both buttons without requesting a change', async () => {
  const onValueChange = jest.fn();
  await render({ ...base, min: 4, max: 4, value: 4, onValueChange });
  for (const button of controls()) {
    expect(button.accessibilityState?.disabled).toBe(true);
    await ReactTestRenderer.act(() => {
      button.onPress?.({} as never);
    });
  }
  expect(onValueChange).not.toHaveBeenCalled();
});

test('never increments beyond the largest safe count or localises the visible digits', async () => {
  const max = Number.MAX_SAFE_INTEGER;
  const onValueChange = jest.fn();
  await render({ ...base, value: max, min: max - 1, max, onValueChange });
  expect(controls()[1].disabled).toBe(true);
  await ReactTestRenderer.act(() => {
    controls()[1].onPress?.({} as never);
    controls()[0].onPress?.({} as never);
  });
  expect(onValueChange.mock.calls).toEqual([[max - 1]]);
  const output = tree.root.findAllByType(Text).find((node) => node.props.testID === 'count-value')!;
  expect(output.props.children).toBe('9007199254740991');
  const row = tree.root
    .findAllByType(View)
    .find((node) => StyleSheet.flatten((node.props as ViewProps).style)?.flexWrap === 'wrap')!;
  expect(row).toBeDefined();
});

test.each([
  { value: NaN },
  { value: Infinity },
  { value: 1.5 },
  { value: -1 },
  { value: 3 },
  { value: Number.MAX_SAFE_INTEGER + 1 },
  { min: -1 },
  { min: 2, max: 1 },
  { min: 0.5 },
  { max: Infinity },
  { max: Number.MAX_SAFE_INTEGER + 1 },
])('rejects invalid caller values without rounding, clamping or requesting a change (%j)', async (invalid) => {
  const onValueChange = jest.fn();
  await expect(render({ ...base, ...invalid, onValueChange })).rejects.toThrow(RangeError);
  expect(onValueChange).not.toHaveBeenCalled();
});

/** Every count and its spoken context must be explicitly supplied. */
function contracts() {
  // @ts-expect-error A caller must supply a count.
  const noValue: StepperProps = {
    label: 'Demo',
    unit: 'Made up',
    min: 0,
    max: 3,
    onValueChange: () => undefined,
    decreaseLabel: 'Less demo',
    increaseLabel: 'More demo',
  };
  // @ts-expect-error Buttons need translated names for the count they change.
  const unnamed: StepperProps = {
    label: 'Demo',
    unit: 'Made up',
    value: 1,
    min: 0,
    max: 3,
    onValueChange: () => undefined,
  };
  return [noValue, unnamed];
}

test('checks the controlled-value and button-label prop contracts', () => expect(contracts()).toHaveLength(2));
