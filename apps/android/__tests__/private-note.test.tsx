// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { createRef } from 'react';
import { Image, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { TextInputInstance, TextInputProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { PrivateNote, type PrivateNoteProps } from '../src/components/PrivateNote';
import { colors, typography } from '../src/design/tokens';
import { PrivateNoteSamples } from '../src/gallery/private-note-samples';
import { privateNoteTexts } from '../src/gallery/private-note-texts';
import { samples } from '../src/gallery/samples';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const window = { width: 360, height: 800, scale: 2, fontScale: 1 };
const base = { ...privateNoteTexts.ar, value: '', onChangeText: jest.fn() };
let tree: ReactTestRenderer.ReactTestRenderer;

beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue(window);
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

function panel(props: Partial<PrivateNoteProps> = {}, direction: 'rtl' | 'ltr' = 'rtl') {
  return (
    <LocaleDirContext.Provider value={direction}>
      <PrivateNote {...base} {...props} />
    </LocaleDirContext.Provider>
  );
}

async function render(element = panel()) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
}

function input(testID?: string) {
  return tree.root.findAllByType(TextInput).find((node) => !testID || node.props.testID === testID)!
    .props as TextInputProps;
}

function label() {
  return tree.root.findByProps({ nativeID: input().accessibilityLabelledBy }).props as TextProps;
}

describe.each(['ar', 'fr', 'en'] as const)('PrivateNote (%s)', (language) => {
  test.each(
    (['rtl', 'ltr'] as const).flatMap((direction) => [1, 2].map((fontScale) => [direction, fontScale] as const)),
  )('keeps the label, assurance, input and reminder readable (%s, %sx)', async (direction, fontScale) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ ...window, fontScale });
    const text = privateNoteTexts[language];
    await render(panel({ ...text, value: text.long }, direction));
    expect(accessibilityProblems(tree.root)).toEqual([]);
    expect(label().children).toBe(`${text.label} · ${text.assurance}`);
    expect(label().accessibilityLabel).toBe(`${text.label} · ${text.assurance}`);
    expect(input()).toMatchObject({ value: text.long, placeholder: text.placeholder, multiline: true });
    expect(input().accessibilityRole).toBeUndefined();
    const box = StyleSheet.flatten(input().style)!;
    expect(box).toMatchObject({
      minHeight: 80,
      minWidth: 48,
      width: '100%',
      writingDirection: direction,
      textAlign: direction === 'rtl' ? 'right' : 'left',
    });
    expect(box.height).toBeUndefined();
    expect(box.maxHeight).toBeUndefined();
    expect(input().numberOfLines).toBeUndefined();
    expect(input().allowFontScaling).not.toBe(false);
    expect(input().maxFontSizeMultiplier).toBeUndefined();
    const words = tree.root.findAllByType(Text);
    expect(words.map((node) => (node.props as TextProps).children)).toEqual([
      `${text.label} · ${text.assurance}`,
      text.reminder,
    ]);
    for (const node of words) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
    }
    expect(StyleSheet.flatten((words[1].props as TextProps).style)).toMatchObject({
      ...typography.small,
      writingDirection: direction,
      color: colors.ink2,
    });
    const root = tree.root.findAllByType(View)[0].props as ViewProps;
    expect(StyleSheet.flatten(root.style)).toMatchObject({ backgroundColor: colors.private, direction });
    expect(root.accessible).not.toBe(true);
  });
});

test('the lock is decorative and cannot replace the words or become a focus stop', async () => {
  await render();
  const icon = tree.root.findByType(Image);
  expect(icon.props).toMatchObject({
    testID: 'icon-lock',
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
  const decoration = tree.root.findAllByType(View).find((node) => node.props.pointerEvents === 'none');
  expect(decoration?.props).toMatchObject({ importantForAccessibility: 'no-hide-descendants' });
  expect(decoration?.findAllByType(Image)).toHaveLength(1);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
});

test('forwards editing unchanged and keeps the associated label when the caller supplies a filled value', async () => {
  const onChangeText = jest.fn();
  await render(panel({ onChangeText }));
  const id = input().accessibilityLabelledBy;
  const value = 'مثال مختلق — activité 2\nتحضير وسائل الإيضاح';
  await ReactTestRenderer.act(() => {
    input().onChangeText?.(value);
  });
  expect(onChangeText).toHaveBeenCalledTimes(1);
  expect(onChangeText).toHaveBeenCalledWith(value);
  expect(input().value).toBe('');
  await ReactTestRenderer.act(() => tree.update(panel({ value, onChangeText })));
  expect(input().value).toBe(value);
  expect(input().accessibilityLabelledBy).toBe(id);
  expect(label().accessibilityLabel).toBe(`${base.label} · ${base.assurance}`);
  expect(input().autoComplete).toBe('off');
  expect(input().importantForAutofill).toBe('noExcludeDescendants');
  expect(input().autoCorrect).toBe(false);
  expect(input().spellCheck).toBe(false);
});

test('reuses native content measurements to grow and shrink without a fixed maximum', async () => {
  await render();
  for (const [height, expected] of [
    [520.2, 521],
    [20, 80],
  ]) {
    await ReactTestRenderer.act(() => {
      input().onContentSizeChange?.({ nativeEvent: { contentSize: { width: 300, height } } } as never);
    });
    expect(StyleSheet.flatten(input().style)?.height).toBe(expected);
  }
});

test('preserves caller focus, ref, editability, optional text, length and visible validation', async () => {
  const ref = createRef<TextInputInstance>();
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  await render(
    panel({ ref, onFocus, onBlur, editable: false, maxLength: 50, optionalLabel: 'اختياري', error: 'مثال' }),
  );
  expect(ref.current).not.toBeNull();
  expect(input()).toMatchObject({ editable: false, maxLength: 50 });
  expect(label().accessibilityLabel).toBe(`${base.label} · ${base.assurance} (اختياري). مثال`);
  expect(
    tree.root.findAllByType(Text).find((node) => node.props.accessibilityLiveRegion === 'polite')?.props.children,
  ).toBe('مثال');
  const event = {} as never;
  await ReactTestRenderer.act(() => {
    input().onFocus?.(event);
  });
  expect(onFocus).toHaveBeenCalledWith(event);
  await ReactTestRenderer.act(() => {
    input().onBlur?.(event);
  });
  expect(onBlur).toHaveBeenCalledWith(event);
  expect(accessibilityProblems(tree.root)).toEqual([]);
});

test.each(['ar', 'fr', 'en'] as const)('gallery edits are isolated and disappear on remount (%s)', async (language) => {
  const example = <PrivateNoteSamples language={language} sample={samples[language]} />;
  await render(example);
  const text = privateNoteTexts[language];
  expect(input('private-note-empty').value).toBe('');
  expect(input('private-note-long').value).toBe(text.long);
  expect(
    new Set(tree.root.findAllByType(TextInput).map((node) => (node.props as TextInputProps).accessibilityLabelledBy))
      .size,
  ).toBe(2);
  await ReactTestRenderer.act(() => {
    input('private-note-empty').onChangeText?.(text.long);
  });
  await ReactTestRenderer.act(() => {
    input('private-note-long').onChangeText?.('');
  });
  expect(input('private-note-empty').value).toBe(text.long);
  expect(input('private-note-long').value).toBe('');
  expect(accessibilityProblems(tree.root)).toEqual([]);
  await ReactTestRenderer.act(() => tree.update(<View />));
  await ReactTestRenderer.act(() => tree.update(example));
  expect(input('private-note-empty').value).toBe('');
  expect(input('private-note-long').value).toBe(text.long);
});

test('the Arabic reminder retains the agreed wording', () => {
  expect(privateNoteTexts.ar.assurance).toBe('لا تغادر أجهزتك');
  expect(privateNoteTexts.ar.reminder).toBe('يُرجى عدم كتابة تفاصيل صحية أو تأديبية تخص التلاميذ، هنا أو في الدفتر.');
});
