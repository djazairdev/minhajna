// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Snackbar } from '../src/components/Snackbar';
import { colors, shadows } from '../src/design/tokens';
import { feedbackTexts } from '../src/gallery/feedback-texts';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const window = { width: 360, height: 800, scale: 2, fontScale: 1 };
const insets = { top: 24, bottom: 24, left: 9, right: 11 };
let tree: ReactTestRenderer.ReactTestRenderer;
beforeEach(() => jest.mocked(useWindowDimensions).mockReturnValue(window));
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

function control() {
  return tree.root.findAll((node) => node.props.accessibilityRole === 'button' && !!node.props.onFocus)[0]
    .props as PressableProps;
}

function actionBox(pressed = false) {
  const style = control().style;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style) ?? {};
}

async function render(message: string, onUndo = jest.fn(), direction: 'rtl' | 'ltr' = 'rtl', bottomOffset = 88) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SafeAreaInsetsContext.Provider value={insets}>
        <LocaleDirContext.Provider value={direction}>
          <Snackbar message={message} undoLabel={feedbackTexts.ar.undo} onUndo={onUndo} bottomOffset={bottomOffset} />
        </LocaleDirContext.Provider>
      </SafeAreaInsetsContext.Provider>,
    );
  });
}

describe.each(['rtl', 'ltr'] as const)('Snackbar (%s)', (direction) => {
  test.each(['confirmation', 'longConfirmation'] as const)(
    '%s is a polite status with a separate Undo target',
    async (key) => {
      const message = feedbackTexts.ar[key];
      const onUndo = jest.fn();
      await render(message, onUndo, direction);
      expect(accessibilityProblems(tree.root)).toEqual([]);
      const status = tree.root.findAllByType(Text).find((node) => node.props.role === 'status')!;
      expect(status.props).toMatchObject({ children: message, accessibilityLiveRegion: 'polite' });
      expect(StyleSheet.flatten((status.props as TextProps).style)).toMatchObject({
        writingDirection: direction,
        textAlign: 'start',
      });
      const root = tree.root.findAllByType(View).find((node) => node.props.testID === 'snackbar')!;
      expect(root.props.accessible).not.toBe(true);
      expect(StyleSheet.flatten((root.props as ViewProps).style)).toMatchObject({
        position: 'absolute',
        bottom: 100,
        left: 21,
        right: 23,
        direction,
        minHeight: 52,
        backgroundColor: colors.board,
        boxShadow: shadows['shadow-snack'],
      });
      expect(control()).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: feedbackTexts.ar.undo });
      expect(actionBox()).toMatchObject({ minHeight: 48, minWidth: 48 });
      expect(actionBox(true).borderColor).toBe(colors.hi);
      await ReactTestRenderer.act(() => {
        control().onPress?.({} as never);
      });
      expect(onUndo).toHaveBeenCalledTimes(1);
      for (const node of tree.root.findAllByType(Text)) {
        const props = node.props as TextProps;
        expect(props.allowFontScaling).not.toBe(false);
        expect(props.maxFontSizeMultiplier).toBeUndefined();
        expect(props.numberOfLines).toBeUndefined();
        expect(props.adjustsFontSizeToFit).not.toBe(true);
      }
    },
  );

  test('shows a high-contrast inset focus ring without moving focus to the status', async () => {
    const moveFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    await render(feedbackTexts.ar.confirmation, jest.fn(), direction);
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    const rings = () => tree.root.findAll((node) => node.props.accessible === false);
    expect(StyleSheet.flatten((rings()[0].props as ViewProps).style)).toMatchObject({
      borderColor: colors['focus-on-board'],
      borderWidth: 2,
      top: 2,
    });
    await ReactTestRenderer.act(() => control().onBlur?.({} as never));
    expect(rings()).toHaveLength(0);
    expect(moveFocus).not.toHaveBeenCalled();
  });
});

test('a changed message remains a polite status and uses the new callback and actual navigation offset', async () => {
  await render(feedbackTexts.ar.confirmation);
  const onUndo = jest.fn();
  await ReactTestRenderer.act(() => {
    tree.update(
      <SafeAreaInsetsContext.Provider value={insets}>
        <Snackbar
          message={feedbackTexts.ar.longConfirmation}
          undoLabel={feedbackTexts.ar.undo}
          onUndo={onUndo}
          bottomOffset={112}
        />
      </SafeAreaInsetsContext.Provider>,
    );
  });
  const status = tree.root.findAllByType(Text).find((node) => node.props.role === 'status')!;
  expect(status.props).toMatchObject({
    children: feedbackTexts.ar.longConfirmation,
    accessibilityLiveRegion: 'polite',
  });
  const root = tree.root.findAllByType(View).find((node) => node.props.testID === 'snackbar')!;
  expect(StyleSheet.flatten((root.props as ViewProps).style)?.bottom).toBe(124);
  await ReactTestRenderer.act(() => {
    control().onPress?.({} as never);
  });
  expect(onUndo).toHaveBeenCalledTimes(1);
});

test('at 200% the message and Undo stack, with no fixed height or maximum text size', async () => {
  jest.mocked(useWindowDimensions).mockReturnValue({ ...window, fontScale: 2 });
  await render(feedbackTexts.ar.longConfirmation);
  const root = tree.root.findAllByType(View).find((node) => node.props.testID === 'snackbar')!;
  const style = StyleSheet.flatten((root.props as ViewProps).style);
  expect(style).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
  expect(style?.height).toBeUndefined();
  expect(actionBox().height).toBeUndefined();
  expect(accessibilityProblems(tree.root)).toEqual([]);
});

test('does not expire Undo or invoke it automatically', async () => {
  jest.useFakeTimers();
  try {
    const onUndo = jest.fn();
    await render(feedbackTexts.ar.confirmation, onUndo);
    await ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(tree.root.findAllByType(Snackbar)).toHaveLength(1);
    expect(onUndo).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
