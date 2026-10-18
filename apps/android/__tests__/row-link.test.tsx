// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View } from 'react-native';
import type { ImageProps, PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { RowLink } from '../src/components/RowLink';
import { controlIcon } from '../src/design/Icon';
import { colorRoles, colors, sizes } from '../src/design/tokens';
import { rowLinkTexts } from '../src/gallery/row-link-texts';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

async function render(element: ReactElement, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

function control() {
  return tree!.root.findAll((node) => (node.props as PressableProps).accessibilityRole === 'button', { deep: false })[0]
    .props as PressableProps;
}

function style(pressed = false) {
  const props = control();
  return StyleSheet.flatten(typeof props.style === 'function' ? props.style({ pressed }) : props.style);
}

const cases = (['ar', 'fr', 'en'] as const).flatMap((language) =>
  (['rtl', 'ltr'] as const).flatMap((direction) =>
    ([1, 2] as const).map((scale) => [language, direction, scale] as const),
  ),
);

test.each(cases)('one named, growing navigation target (%s, %s, %s)', async (language, direction, scale) => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
  const words = rowLinkTexts[language];
  const onPress = jest.fn();
  await render(
    <RowLink icon={controlIcon('info')} title={words.long} description={words.description} onPress={onPress} />,
    direction,
  );
  const props = control();
  expect(props.accessibilityRole).toBe('button');
  expect(props.accessible).toBe(true);
  expect(props.accessibilityLabel).toBe(words.long);
  expect(props.accessibilityHint).toBe(words.description);
  expect(props.accessibilityState).toEqual({ disabled: false });
  expect(style()).toMatchObject({
    direction,
    width: '100%',
    minHeight: 56,
    minWidth: sizes.target,
    backgroundColor: colors.sheet,
  });
  expect(style()?.height).toBeUndefined();
  expect(style()?.borderColor).toBe(colorRoles.controlBorder);
  expect(style(true)).toMatchObject({ backgroundColor: colors['link-row'], borderColor: colors.ink });
  expect(tree!.root.findAll((node) => node.props.accessibilityRole === 'button', { deep: false })).toHaveLength(1);
  for (const node of tree!.root.findAllByType(Text)) {
    const text = node.props as TextProps;
    expect(text.numberOfLines).toBeUndefined();
    expect(text.allowFontScaling).not.toBe(false);
    expect(text.maxFontSizeMultiplier).toBeUndefined();
    expect(text.adjustsFontSizeToFit).not.toBe(true);
    expect(StyleSheet.flatten(text.style)).toMatchObject({ writingDirection: direction, textAlign: 'start' });
  }
  const images = tree!.root.findAllByType(Image).map((node) => node.props as ImageProps);
  expect(images.map((image) => image.source)).toEqual([{ uri: 'icon_info' }, { uri: 'icon_chevron' }]);
  expect(StyleSheet.flatten(images[1].style)?.transform).toEqual(direction === 'ltr' ? [{ scaleX: -1 }] : []);
  for (const image of images) expect(image.importantForAccessibility).toBe('no-hide-descendants');
  await ReactTestRenderer.act(() => {
    props.onPress?.({} as never);
  });
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('a title-only row adds no empty explanation or implicit hint', async () => {
  await render(<RowLink icon={controlIcon('info')} title={rowLinkTexts.en.short} onPress={jest.fn()} />);
  expect(tree!.root.findAllByType(Text)).toHaveLength(1);
  expect(control().accessibilityHint).toBeUndefined();
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test.each(cases)('a disabled row stays named and cannot navigate (%s, %s, %s)', async (language, direction, scale) => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
  const words = rowLinkTexts[language];
  const onPress = jest.fn();
  await render(
    <RowLink
      icon={controlIcon('lock')}
      title={words.disabled}
      description={words.unavailable}
      disabled
      onPress={onPress}
    />,
    direction,
  );
  expect(control().accessibilityLabel).toBe(words.disabled);
  expect(control().accessibilityHint).toBe(words.unavailable);
  expect(control().accessibilityState).toEqual({ disabled: true });
  expect(control().onPress).toBeUndefined();
  expect(style()).toMatchObject({ direction, minHeight: 56, minWidth: sizes.target, opacity: 0.45 });
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  expect(onPress).not.toHaveBeenCalled();
});

test('the caller may replace the spoken hint, without changing the title', async () => {
  const words = rowLinkTexts.en;
  await render(
    <RowLink
      icon={controlIcon('info')}
      title={words.long}
      description={words.description}
      accessibilityHint={words.unavailable}
      onPress={jest.fn()}
    />,
  );
  expect(control().accessibilityHint).toBe(words.unavailable);
  expect(control().accessibilityLabel).toBe(words.long);
});

test('focus has a visible inset ring; blur removes it and disabled rows cannot activate', async () => {
  const props = { icon: controlIcon('info'), title: rowLinkTexts.en.short, onPress: jest.fn() };
  await render(<RowLink {...props} />);
  const rings = () =>
    tree!.root
      .findAllByType(View)
      .filter((node) => StyleSheet.flatten((node.props as ViewProps).style)?.borderColor === colors.focus);
  expect(rings()).toHaveLength(0);
  await ReactTestRenderer.act(() => control().onFocus?.({} as never));
  expect(rings()).toHaveLength(1);
  expect(StyleSheet.flatten(rings()[0].props.style)).toMatchObject({
    borderWidth: 2,
    top: 2,
    bottom: 2,
    start: 2,
    end: 2,
  });
  await ReactTestRenderer.act(() => control().onBlur?.({} as never));
  expect(rings()).toHaveLength(0);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(<RowLink {...props} disabled />);
  expect(control().disabled).toBe(true);
  expect(control().accessibilityState).toEqual({ disabled: true });
  expect(control().onPress).toBeUndefined();
  await ReactTestRenderer.act(() => control().onFocus?.({} as never));
  expect(rings()).toHaveLength(0);
  expect(style()?.opacity).toBe(0.45);
  expect(props.onPress).not.toHaveBeenCalled();
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});
