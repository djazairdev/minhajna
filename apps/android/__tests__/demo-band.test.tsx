// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo band (#557): «نسخة تجريبية · بيانات مختلقة» and the world's date,
// in Arabic, French and English, right to left and left to right, read as one
// header in the notice's colours, below the status bar, free to wrap at
// enlarged text, announcing a changed date, with the date left out until it is
// known;
// the gallery shows it beside the notice; and the world's date is written
// with its weekday, month and year. The world and its date are made up.

import type { Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { DemoBand } from '../src/demo/DemoBand';
import { worldDate } from '../src/demo/world-date';
import { colors, spacing } from '../src/design/tokens';
import { demoBandTexts } from '../src/gallery/demo-band-texts';
import { entries } from '../src/gallery/entries';
import { samples } from '../src/gallery/samples';
import { bundledReference, readReference } from '../src/reference';
import { catalogues, i18n, type Language } from '../src/text/i18n';

const reference = readReference(bundledReference);
if (!reference.ok) throw new Error('The bundled reference data is refused');

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
/** A phone whose status bar the app draws under. */
const INSETS = { top: 24, bottom: 0, left: 0, right: 0 };

async function render(node: React.ReactNode, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree?.unmount();
    tree = ReactTestRenderer.create(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <LocaleDirContext.Provider value={direction}>{node}</LocaleDirContext.Provider>
      </SafeAreaInsetsContext.Provider>,
    );
  });
}

/** Changes the interface language, letting what is shown follow. */
const speak = (language: Language) =>
  ReactTestRenderer.act(async () => {
    await i18n.changeLanguage(language);
  });
/** The rendered tree's root. */
const root = () => tree!.root;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => node.props.children as string);
const band = (testID = 'demo-band') =>
  root()
    .findAllByType(View)
    .find((node) => node.props.testID === testID)!;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await speak('ar');
});

const languages = Object.keys(catalogues) as Language[];

test.each(
  languages.flatMap((language) => (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const)),
)('says it is a demo with made-up data, and the world’s date, as one header (%s, %s)', async (language, direction) => {
  await speak(language);
  const date = demoBandTexts[language].date;
  await render(<DemoBand date={date} />, direction);
  const words = catalogues[language].demo;
  const dated = words.date.replace('{{date}}', date);
  expect(shown()).toEqual([words.band, dated]);
  expect(band().props).toMatchObject({ accessible: true, accessibilityRole: 'header' });
  expect(band().props.accessibilityLabel).toBe(`${words.band}. ${dated}`);
  expect(band().props.accessibilityLiveRegion).toBe('polite');
  const style = StyleSheet.flatten(band().props.style as StyleProp<ViewStyle>);
  expect(style?.height).toBeUndefined();
  expect(style).toMatchObject({
    direction,
    paddingTop: INSETS.top + spacing['space-6'],
    backgroundColor: colors['notice-strong'],
    borderBottomColor: colors['notice-edge'],
  });
  for (const node of root().findAllByType(Text)) {
    expect(node.props.maxFontSizeMultiplier).toBeUndefined();
    expect(node.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(node.props.style)).toMatchObject({
      color: colors['notice-ink'],
      writingDirection: direction,
    });
  }
  expect(accessibilityProblems(root())).toEqual([]);
});

test('leaves the date out until it is known', async () => {
  await render(<DemoBand date={null} />);
  expect(shown()).toEqual([catalogues.ar.demo.band]);
  expect(band().props.accessibilityLabel).toBe('نسخة تجريبية · بيانات مختلقة');
});

test('shows on the gallery beside the notice, dated and not', async () => {
  for (const language of languages) {
    await speak(language);
    const notice = entries.find((entry) => entry.name === 'Notice')!;
    await render(<>{notice.render(samples[language], language)}</>);
    expect(band('demo-band-dated').props.accessibilityLabel).toContain(demoBandTexts[language].date);
    expect(band('demo-band-undated').props.accessibilityLabel).toBe(catalogues[language].demo.band);
  }
});

test('writes the world’s date with its weekday, month and year, in each language', async () => {
  const written: string[] = [];
  for (const language of languages) {
    await speak(language);
    written.push(worldDate(i18n.t, '2030-06-02' as Day, language, reference.profile));
  }
  expect(written).toEqual(languages.map((language) => demoBandTexts[language].date));
});
