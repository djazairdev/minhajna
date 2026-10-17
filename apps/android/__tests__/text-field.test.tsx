// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { createRef } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions } from 'react-native';
import type { TextInputInstance, TextInputProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { TextField, type TextFieldProps } from '../src/components/TextField';
import { colorRoles, colors, typography } from '../src/design/tokens';
import { samples } from '../src/gallery/samples';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const window = { width: 360, height: 800, scale: 2, fontScale: 1 };
beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue(window);
});

let tree: ReactTestRenderer.ReactTestRenderer;
const base = {
  label: samples.ar.fields.label,
  placeholder: samples.ar.fields.example,
  value: '',
  onChangeText: jest.fn(),
};

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

async function render(props: Partial<TextFieldProps> = {}, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <TextField {...base} {...props} />
      </LocaleDirContext.Provider>,
    );
  });
}

function input() {
  return tree.root.findByType(TextInput).props as TextInputProps;
}
function box() {
  return StyleSheet.flatten(input().style) ?? {};
}
function label() {
  return tree.root.findByProps({ nativeID: input().accessibilityLabelledBy }).props as TextProps;
}

describe.each(['rtl', 'ltr'] as const)('TextField (%s)', (direction) => {
  test.each(['empty', 'filled', 'area', 'optional', 'error', 'code', 'number'] as const)(
    '%s is named and large enough',
    async (state) => {
      const text = samples.ar.fields;
      const states: Record<typeof state, Partial<TextFieldProps>> = {
        empty: {},
        filled: { value: text.value },
        area: { multiline: true, value: text.areaValue },
        optional: { optionalLabel: text.optionalLabel },
        error: { error: text.error },
        code: { textDirection: 'ltr', value: text.codeValue },
        number: { textDirection: 'ltr', inputMode: 'numeric', value: text.numberValue },
      };
      await render(states[state], direction);
      expect(accessibilityProblems(tree.root)).toEqual([]);
      const display = state === 'optional' ? `${text.label} (${text.optionalLabel})` : text.label;
      expect(label().children).toBe(display);
      expect(label().accessibilityLabel).toBe(state === 'error' ? `${display}. ${text.error}` : display);
      expect(input().accessibilityRole).toBeUndefined();
      expect(box()).toMatchObject({
        minWidth: 48,
        minHeight: state === 'area' ? 80 : 48,
        borderColor: colorRoles.controlBorder,
        borderWidth: 1.5,
        backgroundColor: colors.sheet,
        color: colors.ink,
      });
      expect(input().placeholderTextColor).toBe(colors.pencil);
      const textDirection = state === 'code' || state === 'number' ? 'ltr' : direction;
      expect(box()).toMatchObject({
        direction: textDirection,
        writingDirection: textDirection,
        textAlign: textDirection === 'rtl' ? 'right' : 'left',
      });
      expect(input().autoComplete).toBe('off');
      expect(input().importantForAutofill).toBe('noExcludeDescendants');
      expect(input().autoCorrect).toBe(false);
      expect(input().spellCheck).toBe(false);
    },
  );

  test('forwards editing exactly, including Arabic, mixed scripts, digits and new lines', async () => {
    const onChangeText = jest.fn();
    await render({ onChangeText, multiline: true }, direction);
    const value = 'التمرين 5 — CEM-01\nمراجعة الجمع';
    await ReactTestRenderer.act(() => {
      input().onChangeText?.(value);
    });
    expect(onChangeText).toHaveBeenCalledWith(value);
    expect(input().value).toBe('');
  });

  test('grows and shrinks a text area from native measurements without counting padding twice', async () => {
    await render({ multiline: true }, direction);
    expect(box()).toMatchObject({ height: 80, textAlignVertical: 'top' });
    for (const [height, expected] of [
      [180.2, 181],
      [20, 80],
      [400, 400],
      [NaN, 400],
      [Infinity, 400],
      [-5, 400],
    ]) {
      await ReactTestRenderer.act(() => {
        input().onContentSizeChange?.({ nativeEvent: { contentSize: { height, width: 300 } } } as never);
      });
      expect(box().height).toBe(expected);
    }
    expect(input().numberOfLines).toBeUndefined();
    expect(box().maxHeight).toBeUndefined();
  });

  test('exposes a newly supplied error, keeps its spoken association and clears it', async () => {
    await render({}, direction);
    const id = input().accessibilityLabelledBy;
    await ReactTestRenderer.act(() =>
      tree.update(
        <LocaleDirContext.Provider value={direction}>
          <TextField {...base} error={samples.ar.fields.error} />
        </LocaleDirContext.Provider>,
      ),
    );
    expect(input().accessibilityLabelledBy).toBe(id);
    expect(label().accessibilityLabel).toContain(samples.ar.fields.error);
    const error = tree.root.findAllByType(Text).find((node) => node.props.accessibilityLiveRegion === 'polite');
    expect(error?.props.children).toBe(samples.ar.fields.error);
    expect(StyleSheet.flatten((error?.props as TextProps).style)).toMatchObject({ color: colors['error-ink'] });
    await ReactTestRenderer.act(() =>
      tree.update(
        <LocaleDirContext.Provider value={direction}>
          <TextField {...base} />
        </LocaleDirContext.Provider>,
      ),
    );
    expect(label().accessibilityLabel).toBe(base.label);
    expect(tree.root.findAll((node) => node.props.accessibilityLiveRegion === 'polite')).toHaveLength(0);
  });

  test('shows and clears focus feedback while preserving caller focus/blur callbacks', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render({ onFocus, onBlur }, direction);
    const event = {} as never;
    await ReactTestRenderer.act(() => {
      input().onFocus?.(event);
    });
    expect(onFocus).toHaveBeenCalledWith(event);
    const rings = () => tree.root.findAll((node) => node.props.accessible === false);
    expect(StyleSheet.flatten((rings()[0].props as ViewProps).style)).toMatchObject({
      borderWidth: 2,
      borderColor: colors.focus,
      top: 2,
    });
    await ReactTestRenderer.act(() => {
      input().onBlur?.(event);
    });
    expect(onBlur).toHaveBeenCalledWith(event);
    expect(rings()).toHaveLength(0);
  });
});

test.each([1, 2])('respects %sx text without capping, truncating or fixing single-line height', async (fontScale) => {
  jest.mocked(useWindowDimensions).mockReturnValue({ ...window, fontScale });
  await render();
  expect(box().minHeight).toBe(Math.max(48, typography.body.lineHeight * fontScale + 23));
  expect(box().height).toBeUndefined();
  expect(input().allowFontScaling).not.toBe(false);
  expect(input().maxFontSizeMultiplier).toBeUndefined();
  for (const text of tree.root.findAllByType(Text)) {
    expect(text.props.numberOfLines).toBeUndefined();
    expect(text.props.allowFontScaling).not.toBe(false);
  }
});

test('forwards keyboard, maximum length, submission, editability and a ref without exposing arbitrary style overrides', async () => {
  const ref = createRef<TextInputInstance>();
  const onSubmitEditing = jest.fn();
  await render({
    ref,
    editable: false,
    keyboardType: 'number-pad',
    maxLength: 4,
    returnKeyType: 'next',
    onSubmitEditing,
  });
  expect(input()).toMatchObject({ editable: false, keyboardType: 'number-pad', maxLength: 4, returnKeyType: 'next' });
  expect(input().onSubmitEditing).toBe(onSubmitEditing);
  expect(ref.current).not.toBeNull();
  expect(accessibilityProblems(tree.root)).toEqual([]);
});
