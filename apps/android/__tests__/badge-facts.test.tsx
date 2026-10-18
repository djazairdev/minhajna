// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View } from 'react-native';
import type { ImageProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Badge } from '../src/components/Badge';
import { Facts } from '../src/components/Facts';
import { colors, typography } from '../src/design/tokens';
import { badgeTexts } from '../src/gallery/badge-texts';
import { factsTexts } from '../src/gallery/facts-texts';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

async function render(element: ReactElement, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

function wrapping(props: TextProps) {
  expect(props.allowFontScaling).not.toBe(false);
  expect(props.maxFontSizeMultiplier).toBeUndefined();
  expect(props.numberOfLines).toBeUndefined();
  expect(props.adjustsFontSizeToFit).not.toBe(true);
  expect(StyleSheet.flatten(props.style)?.height).toBeUndefined();
}

const cases = (['ar', 'fr', 'en'] as const).flatMap((language) =>
  (['rtl', 'ltr'] as const).flatMap((direction) =>
    ([1, 2] as const).map((scale) => [language, direction, scale] as const),
  ),
);

test.each(cases)(
  'static badge states wrap without becoming controls (%s, %s, %s)',
  async (language, direction, scale) => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
    const words = badgeTexts[language];
    const states = [
      ['default', colors.ink2, colors['pill-on']],
      ['done', colors['ok-ink'], colors.ok],
      ['warning', colors['notice-ink'], colors['notice-strong']],
    ] as const;
    for (const [variant, color, backgroundColor] of states) {
      await render(<Badge label={words[variant]} variant={variant} />, direction);
      const props = tree!.root.findByType(Text).props as TextProps;
      expect(props.children).toBe(words[variant]);
      expect(props.accessibilityRole).toBe('text');
      expect(props.accessibilityLiveRegion).toBeUndefined();
      expect(props.onPress).toBeUndefined();
      expect(StyleSheet.flatten(props.style)).toMatchObject({ color, backgroundColor, writingDirection: direction });
      wrapping(props);
      expect(accessibilityProblems(tree!.root)).toEqual([]);
      await ReactTestRenderer.act(() => tree?.unmount());
      tree = undefined;
    }
    await render(<Badge label={words.long} />, direction);
    const props = tree!.root.findByType(Text).props as TextProps;
    expect(props.children).toBe(words.long);
    expect(StyleSheet.flatten(props.style)).toMatchObject({
      ...typography.badge,
      maxWidth: '100%',
      flexShrink: 1,
      color: colors.ink2,
      backgroundColor: colors['pill-on'],
    });
    wrapping(props);
  },
);

test.each(cases)(
  'kept results name exclusions, not just colours or a strike (%s, %s, %s)',
  async (language, direction, scale) => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
    const words = factsTexts[language];
    const kept = [
      { id: 'class', text: words.classes, kept: true },
      { id: 'week', text: words.week, kept: true },
      { id: 'long', text: words.long, kept: true },
      { id: 'excluded', text: words.excluded, kept: false },
    ];
    await render(<Facts kept={kept} keptLabel={words.kept} notKeptLabel={words.notKept} />, direction);
    const rows = tree!.root
      .findAllByType(View)
      .filter((node) => (node.props as ViewProps).accessibilityRole === 'text');
    expect(rows.map((node) => (node.props as ViewProps).accessibilityLabel)).toEqual(
      kept.map((fact) => `${fact.kept ? words.kept : words.notKept}: ${fact.text}`),
    );
    expect(rows).toHaveLength(4);
    expect(StyleSheet.flatten(tree!.root.findAllByType(View)[0].props.style)).toMatchObject({ direction });
    const icons = tree!.root.findAllByType(Image).map((node) => node.props as ImageProps);
    expect(icons.map((icon) => icon.source)).toEqual([
      { uri: 'icon_check' },
      { uri: 'icon_check' },
      { uri: 'icon_check' },
      { uri: 'icon_cross' },
    ]);
    for (const icon of icons) {
      expect(icon.accessible).toBe(false);
      expect(icon.importantForAccessibility).toBe('no-hide-descendants');
    }
    const texts = tree!.root.findAllByType(Text).map((node) => node.props as TextProps);
    expect(texts.map((props) => props.children)).toEqual(kept.map((fact) => fact.text));
    expect(StyleSheet.flatten(texts[0].style)?.textDecorationLine).toBeUndefined();
    expect(StyleSheet.flatten(texts[3].style)).toMatchObject({
      color: colors.ink2,
      textDecorationLine: 'line-through',
    });
    for (const props of texts) {
      wrapping(props);
      expect(StyleSheet.flatten(props.style)).toMatchObject({
        writingDirection: direction,
        textAlign: 'start',
        flex: 1,
      });
    }
    expect(accessibilityProblems(tree!.root)).toEqual([]);
  },
);

test('keeps the original welcome promises and their three-item limit', async () => {
  const facts = [
    { icon: 'no_account', text: 'Synthetic promise one' },
    { icon: 'offline', text: 'Synthetic promise two' },
    { icon: 'phone', text: 'Synthetic promise three' },
    { icon: 'info', text: 'Synthetic fourth promise' },
  ] as const;
  await render(<Facts facts={facts} />, 'rtl');
  expect(tree!.root.findAllByType(Text).map((node): unknown => node.props.children)).toEqual(
    facts.slice(0, 3).map((fact) => fact.text),
  );
  expect(tree!.root.findAllByType(Image).map((node): unknown => node.props.source)).toEqual(
    facts.slice(0, 3).map((fact) => ({ uri: `icon_${fact.icon}` })),
  );
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('an empty kept result invents no promises or saved records', async () => {
  await render(<Facts kept={[]} keptLabel={factsTexts.en.kept} notKeptLabel={factsTexts.en.notKept} />, 'ltr');
  expect(tree!.root.findAllByType(Text)).toEqual([]);
  expect(tree!.root.findAllByType(Image)).toEqual([]);
});
