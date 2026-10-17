// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { SegmentedControl, type SegmentedControlProps } from '../src/components/SegmentedControl';
import { colorRoles, colors } from '../src/design/tokens';
import { segmentedControlTexts } from '../src/gallery/segmented-control-texts';

let tree: ReactTestRenderer.ReactTestRenderer;
const cases = (['ar', 'fr', 'en'] as const).flatMap((language) =>
  (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
);

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

async function render(props: SegmentedControlProps<string>, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree?.unmount();
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <SegmentedControl {...props} />
      </LocaleDirContext.Provider>,
    );
  });
}

function tabs() {
  return tree.root
    .findAll((node) => !!node.props.onFocus && node.props.accessibilityRole === 'tab', { deep: false })
    .map((node) => node.props as PressableProps);
}

function box(props: PressableProps, pressed = false) {
  return StyleSheet.flatten(typeof props.style === 'function' ? props.style({ pressed }) : props.style) ?? {};
}

describe.each(cases)('SegmentedControl (%s, %s)', (language, direction) => {
  test.each([2, 3])(
    '%s tabs expose every selected state, request changes and never choose internally',
    async (count) => {
      const text = segmentedControlTexts[language];
      const choices = text.periods.slice(0, count).map((label, index) => ({
        value: String(index),
        label,
      })) as unknown as SegmentedControlProps<string>['choices'];
      for (const selected of choices) {
        const onSelect = jest.fn();
        const props = { label: text.period, choices, selected: selected.value, onSelect, testID: 'period' };
        await render(props, direction);
        expect(accessibilityProblems(tree.root)).toEqual([]);
        const group = tree.root.findAllByType(View).find((node) => node.props.accessibilityRole === 'tablist')!;
        expect(group.props.accessibilityLabel).toBe(text.period);
        expect(group.props.accessible).not.toBe(true);
        expect(StyleSheet.flatten((group.props as ViewProps).style)).toMatchObject({
          direction,
          borderColor: colorRoles.controlBorder,
          borderWidth: 1.5,
        });
        expect(tabs()).toHaveLength(count);
        for (const [index, choice] of choices.entries()) {
          const tab = tabs()[index];
          const chosen = choice.value === selected.value;
          expect(tab).toMatchObject({
            accessible: true,
            accessibilityRole: 'tab',
            accessibilityLabel: choice.label,
            accessibilityState: { selected: chosen, disabled: false },
            testID: `period-${choice.value}`,
          });
          expect(box(tab)).toMatchObject({ minHeight: 48, minWidth: 48, flex: 1 });
          expect(box(tab).height).toBeUndefined();
          expect(box(tab).backgroundColor).toBe(chosen ? colors.board : undefined);
          expect(box(tab).borderStartWidth).toBe(index > 0 ? 1.5 : undefined);
          await ReactTestRenderer.act(() => {
            tab.onPress?.({} as never);
          });
          expect(tabs()[index].accessibilityState?.selected).toBe(chosen);
        }
        expect(onSelect.mock.calls).toEqual(
          choices.filter((choice) => choice !== selected).map((choice) => [choice.value]),
        );
        const marks = tree.root
          .findAllByType(View)
          .filter((node) => node.props.importantForAccessibility === 'no-hide-descendants');
        expect(marks).toHaveLength(1);
        expect(marks[0].props.pointerEvents).toBe('none');
        expect(StyleSheet.flatten((marks[0].props as ViewProps).style)).toMatchObject({
          height: 2,
          backgroundColor: colors.chalk,
        });
      }
    },
  );

  test('keeps text uncapped at 200% and shows contrasting pressed and focus feedback', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    const text = segmentedControlTexts[language];
    await render(
      {
        label: text.view,
        choices: [
          { value: 'list', label: text.views[0] },
          { value: 'seats', label: text.views[1] },
        ],
        selected: 'list',
        onSelect: () => undefined,
      },
      direction,
    );
    for (const node of tree.root.findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
      expect(props.adjustsFontSizeToFit).not.toBe(true);
      expect(StyleSheet.flatten(props.style)).toMatchObject({ writingDirection: direction });
    }
    expect(box(tabs()[1], true).backgroundColor).toBe(colors.soft);
    expect(box(tabs()[0], true).backgroundColor).toBe(colors.board);
    for (const index of [0, 1]) {
      await ReactTestRenderer.act(() => tabs()[index].onFocus?.({} as never));
      const ring = tree.root.findAllByType(View).find((node) => node.props.accessible === false)!;
      expect(StyleSheet.flatten((ring.props as ViewProps).style)).toMatchObject({
        borderWidth: 2,
        borderColor: index === 0 ? colors['focus-on-board'] : colors.focus,
      });
      await ReactTestRenderer.act(() => tabs()[index].onBlur?.({} as never));
      expect(tree.root.findAllByType(View).filter((node) => node.props.accessible === false)).toHaveLength(0);
    }
  });

  test('disabled tabs retain their names, targets and selection but cannot change it', async () => {
    const text = segmentedControlTexts[language];
    const onSelect = jest.fn();
    await render(
      {
        label: text.view,
        choices: [
          { value: 'list', label: text.views[0] },
          { value: 'seats', label: text.views[1] },
        ],
        selected: 'seats',
        onSelect,
        disabled: true,
      },
      direction,
    );
    expect(accessibilityProblems(tree.root)).toEqual([]);
    for (const tab of tabs()) {
      expect(tab.disabled).toBe(true);
      expect(tab.accessibilityState?.disabled).toBe(true);
      expect(box(tab).opacity).toBe(0.45);
      await ReactTestRenderer.act(() => {
        tab.onPress?.({} as never);
        tab.onFocus?.({} as never);
      });
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(View).filter((node) => node.props.accessible === false)).toHaveLength(0);
  });
});

/** Invalid choices remain compile errors rather than unsupported layouts. */
function contracts() {
  const base = { label: 'Demo', selected: 'a', onSelect: () => undefined };
  // @ts-expect-error One segment is not a view switch.
  const one: SegmentedControlProps<string> = { ...base, choices: [{ value: 'a', label: 'A' }] };
  const four: SegmentedControlProps<string> = {
    ...base,
    // @ts-expect-error Four segments are outside the design's contract.
    choices: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
      { value: 'd', label: 'D' },
    ],
  };
  // @ts-expect-error The caller must own the current view.
  const noSelection: SegmentedControlProps<string> = {
    label: 'Demo',
    choices: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
    onSelect: () => undefined,
  };
  return [one, four, noSelection];
}

test('checks the two-or-three and controlled-value prop contracts', () => expect(contracts()).toHaveLength(3));
