// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import type { TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Notice, type NoticeProps } from '../src/components/Notice';
import type { ControlIcon } from '../src/components/control';
import { colors, typography } from '../src/design/tokens';
import { feedbackTexts } from '../src/gallery/feedback-texts';

const icon: ControlIcon = ({ size, color }) => (
  <View testID="notice-drawing" style={{ width: size, height: size, backgroundColor: color }} />
);
let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
});

describe.each(['rtl', 'ltr'] as const)('Notice (%s)', (direction) => {
  test.each(['reassurance', 'notice'] as const)('%s has readable words without relying on colour', async (variant) => {
    const text = feedbackTexts.ar;
    const props: NoticeProps =
      variant === 'reassurance'
        ? { message: text.reassurance, icon }
        : { variant, message: text.instruction, badge: text.badge, title: text.title };
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <LocaleDirContext.Provider value={direction}>
          <Notice {...props} testID="notice" />
        </LocaleDirContext.Provider>,
      );
    });
    expect(accessibilityProblems(tree.root)).toEqual([]);
    const root = tree.root.findAllByType(View).find((node) => node.props.testID === 'notice')!;
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityLabel).toBe(
      variant === 'notice' ? `${text.badge}. ${text.title}. ${text.instruction}` : text.reassurance,
    );
    const box = StyleSheet.flatten((root.props as ViewProps).style);
    expect(box).toMatchObject({ direction });
    expect(box?.height).toBeUndefined();
    if (variant === 'notice') {
      expect(box).toMatchObject({ borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: colors.notice });
    } else {
      const drawing = tree.root.findByProps({ testID: 'notice-drawing' });
      expect(StyleSheet.flatten((drawing.props as ViewProps).style)).toMatchObject({ width: 18, height: 18 });
      expect(drawing.parent?.props).toMatchObject({
        importantForAccessibility: 'no-hide-descendants',
        accessibilityElementsHidden: true,
        pointerEvents: 'none',
      });
      expect(StyleSheet.flatten((tree.root.findByType(Text).props as TextProps).style)).toMatchObject({
        ...typography.small,
        color: colors.ink2,
      });
    }
    for (const node of tree.root.findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
      expect(StyleSheet.flatten(props.style)).toMatchObject({
        writingDirection: direction,
        textAlign: 'start',
      });
    }
  });
});

test('a notice without a heading still has the badge and the instruction as its name', async () => {
  const text = feedbackTexts.en;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Notice variant="notice" badge={text.badge} message={text.instruction} />);
  });
  const root = tree.root.findAllByType(View).find((node) => node.props.accessible)!;
  expect(root.props.accessibilityLabel).toBe(`${text.badge}. ${text.instruction}`);
});
