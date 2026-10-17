// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Button } from '../src/components/Button';
import { PageHeading } from '../src/components/PageHeading';
import { SectionHeader } from '../src/components/SectionHeader';
import type { ControlIcon } from '../src/components/control';
import { colors, typography } from '../src/design/tokens';
import { samples } from '../src/gallery/samples';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const window = { width: 360, height: 800, scale: 2, fontScale: 1 };
beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue(window);
});

const icon: ControlIcon = ({ size, color }) => (
  <View testID="fact-drawing" style={{ width: size, height: size, backgroundColor: color }} />
);
let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
});

async function render(element: ReactElement, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

function header() {
  return tree.root.findAllByType(Text).find((node) => node.props.accessibilityRole === 'header')!;
}

function expectGrowingText() {
  for (const node of tree.root.findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
    expect(props.adjustsFontSizeToFit).not.toBe(true);
    const style = StyleSheet.flatten(props.style);
    expect(style?.height).toBeUndefined();
    expect(style?.maxHeight).toBeUndefined();
  }
}

describe.each(['rtl', 'ltr'] as const)('PageHeading (%s)', (direction) => {
  test.each(['today', 'long', 'scope', 'actions'] as const)(
    '%s keeps the title a header and actions separate',
    async (state) => {
      const words = samples.ar.headings;
      const title = state === 'long' ? samples.ar.longHeading : words.day;
      const onPress = jest.fn();
      const actions =
        state === 'actions' ? <Button variant="line" label={words.addSession} onPress={onPress} /> : undefined;
      await render(
        <PageHeading
          testID="page"
          title={title}
          scope={words.date}
          fact={state === 'scope' ? undefined : { text: words.fact, icon }}
          actions={actions}
        />,
        direction,
      );
      expect(accessibilityProblems(tree.root)).toEqual([]);
      expect(header().props.children).toBe(title);
      expect(StyleSheet.flatten((header().props as TextProps).style)).toMatchObject({
        fontFamily: typography.day.fontFamily,
        fontSize: typography.day.fontSize,
        fontWeight: typography.day.fontWeight,
        color: colors.ink,
        textAlign: 'start',
      });
      expect(StyleSheet.flatten((header().props as TextProps).style)?.lineHeight).toBeUndefined();
      const scope = tree.root.findAllByType(Text).find((node) => node.props.children === words.date)!;
      expect(StyleSheet.flatten((scope.props as TextProps).style)).toMatchObject({
        ...typography.fact,
        color: colors.ink2,
      });
      const root = tree.root.findAllByType(View).find((node) => node.props.testID === 'page')!;
      expect(root.props.accessible).not.toBe(true);
      expect(StyleSheet.flatten((root.props as ViewProps).style)).toMatchObject({ direction });
      expectGrowingText();
      const drawings = tree.root.findAllByProps({ testID: 'fact-drawing' });
      expect(drawings).toHaveLength(state === 'scope' ? 0 : 2);
      if (state !== 'scope') {
        const drawing = drawings.find((node) => node.type === View)!;
        expect(StyleSheet.flatten((drawing.props as ViewProps).style)).toMatchObject({ width: 18, height: 18 });
        expect(drawing.parent?.props).toMatchObject({
          importantForAccessibility: 'no-hide-descendants',
          accessibilityElementsHidden: true,
          pointerEvents: 'none',
        });
      }
      if (actions) {
        const control = tree.root.findAll(
          (node) => node.props.accessibilityRole === 'button' && !!node.props.onFocus,
        )[0];
        await ReactTestRenderer.act(() => {
          (control.props as PressableProps).onPress?.({} as never);
        });
        expect(onPress).toHaveBeenCalledTimes(1);
      }
    },
  );
});

describe.each(['rtl', 'ltr'] as const)('SectionHeader (%s)', (direction) => {
  test.each(['plain', 'count', 'empty', 'action', 'long'] as const)(
    '%s has a heading, including its count when present',
    async (state) => {
      const words = samples.ar.headings;
      const label = state === 'long' ? samples.ar.longHeading : words.section;
      const count =
        state === 'count' || state === 'long' ? words.count : state === 'empty' ? words.emptyCount : undefined;
      const onPress = jest.fn();
      const action =
        state === 'action' ? <Button variant="plain" label={samples.ar.buttons.line} onPress={onPress} /> : undefined;
      await render(<SectionHeader testID="section" label={label} count={count} action={action} />, direction);
      expect(accessibilityProblems(tree.root)).toEqual([]);
      expect(header().props).toMatchObject({
        children: label,
        accessibilityLabel: count === undefined ? label : `${label}. ${count}`,
      });
      expect(StyleSheet.flatten((header().props as TextProps).style)).toMatchObject({
        ...typography.label,
        color: colors.ink2,
        textAlign: 'start',
      });
      const root = tree.root.findAllByType(View).find((node) => node.props.testID === 'section')!;
      expect(root.props.accessible).not.toBe(true);
      expect(StyleSheet.flatten((root.props as ViewProps).style)).toMatchObject({ direction, flexWrap: 'wrap' });
      if (count !== undefined) {
        const text = tree.root.findAllByType(Text).find((node) => node.props.children === count)!;
        expect(text.props).toMatchObject({ accessible: false, importantForAccessibility: 'no-hide-descendants' });
      }
      if (action) {
        const control = tree.root.findAll(
          (node) => node.props.accessibilityRole === 'button' && !!node.props.onFocus,
        )[0];
        await ReactTestRenderer.act(() => {
          (control.props as PressableProps).onPress?.({} as never);
        });
        expect(onPress).toHaveBeenCalledTimes(1);
      }
      expectGrowingText();
    },
  );
});

test('uses the caller’s date verbatim, without parsing, generating or falling back to another date', async () => {
  const scope = '2026-10-04';
  await render(<PageHeading title={samples.en.headings.day} scope={scope} />, 'ltr');
  expect(tree.root.findAllByType(Text).map((node) => (node.props as TextProps).children)).toEqual([
    samples.en.headings.day,
    scope,
  ]);
});

test('scales display-font ink space at 200% without a fixed line height or size cap', async () => {
  jest.mocked(useWindowDimensions).mockReturnValue({ ...window, fontScale: 2 });
  await render(<PageHeading title={samples.ar.longHeading} scope={samples.ar.headings.date} />, 'rtl');
  expect(StyleSheet.flatten((header().props as TextProps).style)).toMatchObject({
    paddingVertical: 24,
    paddingHorizontal: 4,
  });
  expectGrowingText();
  expect(
    tree.root
      .findAllByType(View)
      .some((node) => StyleSheet.flatten((node.props as ViewProps).style)?.flexDirection === 'column'),
  ).toBe(true);
});
