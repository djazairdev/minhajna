// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { RadioCard, RadioCardGroup, type RadioCardProps } from '../src/components/RadioCard';
import { colorRoles, colors } from '../src/design/tokens';
import { radioCardTexts } from '../src/gallery/radio-card-texts';

let tree: ReactTestRenderer.ReactTestRenderer;
const cases = (['ar', 'fr', 'en'] as const).flatMap((language) =>
  (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
);

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

async function render(element: ReactElement, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree?.unmount();
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

function control() {
  return tree.root.findAll((node) => !!node.props.onFocus && node.props.accessibilityRole === 'radio', {
    deep: false,
  })[0].props as PressableProps;
}

function box(pressed = false) {
  const style = control().style;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style) ?? {};
}

describe.each(cases)('RadioCard (%s, %s)', (language, direction) => {
  test.each([false, true].flatMap((selected) => [false, true].map((disabled) => [selected, disabled] as const)))(
    'selected=%s disabled=%s is one named radio, with a non-colour mark and a caller-owned value',
    async (selected, disabled) => {
      const text = radioCardTexts[language];
      const onPress = jest.fn();
      await render(
        <RadioCard
          label={text.first}
          description={text.firstDescription}
          selected={selected}
          disabled={disabled}
          onPress={onPress}
        />,
        direction,
      );
      expect(accessibilityProblems(tree.root)).toEqual([]);
      expect(control()).toMatchObject({
        accessible: true,
        accessibilityRole: 'radio',
        accessibilityLabel: `${text.first}. ${text.firstDescription}`,
        accessibilityState: { checked: selected, disabled },
        disabled,
      });
      expect(control().accessibilityState).not.toHaveProperty('selected');
      expect(box()).toMatchObject({
        width: '100%',
        minWidth: 48,
        minHeight: 56,
        direction,
        borderColor: selected ? colors.board : colorRoles.controlBorder,
      });
      expect(box().opacity).toBe(disabled ? 0.45 : undefined);
      const drawings = tree.root
        .findAllByType(View)
        .filter((node) => node.props.importantForAccessibility === 'no-hide-descendants');
      expect(drawings).toHaveLength(selected ? 2 : 1);
      for (const drawing of drawings) expect(drawing.props.pointerEvents).toBe('none');
      expect(drawings[0].findAllByType(View)).toHaveLength(selected ? 2 : 1);
      if (selected)
        expect(StyleSheet.flatten((drawings[1].props as ViewProps).style)).toMatchObject({
          borderWidth: 1,
          borderColor: colors.board,
          top: 1,
          bottom: 1,
          start: 1,
          end: 1,
        });
      await ReactTestRenderer.act(() => {
        control().onPress?.({} as never);
      });
      expect(onPress).toHaveBeenCalledTimes(!disabled && !selected ? 1 : 0);
      expect(control().accessibilityState?.checked).toBe(selected);
    },
  );

  test('long words stay uncapped at 200%, with pressed and focus feedback', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    const text = radioCardTexts[language];
    await render(
      <RadioCard label={text.second} description={text.longDescription} selected onPress={() => undefined} />,
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
      expect(StyleSheet.flatten(props.style)?.height).toBeUndefined();
    }
    expect(box(true).backgroundColor).toBe(colors.soft);
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    const ring = tree.root.findAllByType(View).find((node) => node.props.accessible === false)!;
    expect(StyleSheet.flatten((ring.props as ViewProps).style)).toMatchObject({
      borderWidth: 2,
      borderColor: colors.focus,
    });
    await ReactTestRenderer.act(() => control().onBlur?.({} as never));
    expect(tree.root.findAllByType(View).filter((node) => node.props.accessible === false)).toHaveLength(0);
    await render(
      <RadioCard label={text.second} description={text.longDescription} selected disabled onPress={() => undefined} />,
      direction,
    );
    await ReactTestRenderer.act(() => control().onFocus?.({} as never));
    expect(tree.root.findAllByType(View).filter((node) => node.props.accessible === false)).toHaveLength(0);
  });

  test('the group allows no initial choice, requests one value and retains unavailable choices', async () => {
    const text = radioCardTexts[language];
    const onSelect = jest.fn();
    const choices = [
      { value: 'first', label: text.first, description: text.firstDescription },
      { value: 'second', label: text.second, description: text.longDescription, disabled: true },
    ];
    for (const disabled of [false, true]) {
      await render(
        <RadioCardGroup
          label={text.group}
          choices={choices}
          selected={null}
          onSelect={onSelect}
          disabled={disabled}
          testID="plans"
        />,
        direction,
      );
      const group = tree.root.findAllByType(View).find((node) => node.props.accessibilityRole === 'radiogroup')!;
      expect(group.props.accessibilityLabel).toBe(text.group);
      expect(group.props.accessible).not.toBe(true);
      const cards = tree.root
        .findAll((node) => !!node.props.onFocus && node.props.accessibilityRole === 'radio', { deep: false })
        .map((node) => node.props as PressableProps);
      expect(cards.map((card) => card.testID)).toEqual(['plans-first', 'plans-second']);
      expect(cards.map((card) => card.accessibilityState)).toEqual([
        { checked: false, disabled },
        { checked: false, disabled: true },
      ]);
      for (const card of cards)
        await ReactTestRenderer.act(() => {
          card.onPress?.({} as never);
        });
      expect(accessibilityProblems(tree.root)).toEqual([]);
    }
    expect(onSelect.mock.calls).toEqual([['first']]);
  });
});

/** A radio's selection, description and callback are supplied by its screen. */
function contracts() {
  // @ts-expect-error No implicit or internal selection.
  const stateless: RadioCardProps = { label: 'Demo', description: 'Made up', onPress: () => undefined };
  // @ts-expect-error Every card explains its choice.
  const unexplained: RadioCardProps = { label: 'Demo', selected: false, onPress: () => undefined };
  return [stateless, unexplained];
}

test('checks the caller-owned radio prop contract', () => expect(contracts()).toHaveLength(2));
