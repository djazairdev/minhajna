// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Help follows the newly selected interface language, but legal text stays verbatim.
// Browser confirmation and failures must never fall back to another language.

import { Alert, Linking, Text } from 'react-native';
import type { GestureResponderEvent, PressableProps, TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { AppNavigator } from '../src/navigation/AppNavigator';
import native from '../src/native/NativeMinhajnaLicences';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const fixture = {
  version: '0.0.0',
  notices: [{ name: 'fonts.txt', text: 'Synthetic public font notice.' }],
};

async function press(label: string) {
  const button = tree!.root.findAll(
    (node) =>
      typeof (node.props as PressableProps).onPress === 'function' &&
      (node.props as PressableProps).accessibilityLabel === label,
  )[0];
  expect(button).toBeDefined();
  await ReactTestRenderer.act(async () => {
    (button.props as PressableProps).onPress?.({} as GestureResponderEvent);
    await Promise.resolve();
  });
}

function shown() {
  return tree!.root.findAllByType(Text).flatMap((node) => (node.props as TextProps).children);
}

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test.each(Object.keys(catalogues) as Language[])(
  'translates Help, titles, failures and browser confirmation (%s)',
  async (language) => {
    const text = catalogues[language];
    missingKeys.length = 0;
    const read = jest.spyOn(native, 'readNotices').mockReset().mockResolvedValue(fixture);
    read.mockRejectedValueOnce(new Error('Synthetic unreadable notices'));
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert');
    await ReactTestRenderer.act(async () => {
      await i18n.changeLanguage(language);
      tree = ReactTestRenderer.create(
        <AppNavigator initialRouteName="Home" direction={language === 'ar' ? 'rtl' : 'ltr'} />,
      );
    });
    await press(text.help.title);
    expect(shown()).toContain(text.help.about);
    await press(text.help.licences);
    expect(shown()).toContain(text.help.refused);
    await press(text.help.retry);
    expect(shown()).toEqual(
      expect.arrayContaining([
        text.help.appLicence,
        i18n.t('help.version', { version: fixture.version }),
        text.help.noticeTitles['fonts.txt'],
      ]),
    );
    if (language !== 'ar') expect(shown()).not.toContain(catalogues.ar.help.appLicence);
    await press(text.help.source);
    expect(alert).toHaveBeenCalledWith(text.help.source, text.help.browserNotice, expect.any(Array));
    expect(alert.mock.calls[0][2]?.map((button) => button.text)).toEqual([text.help.cancel, text.help.openBrowser]);
    expect(typeof alert.mock.calls[0][2]?.[1].onPress).toBe('function');
    expect(openURL).not.toHaveBeenCalled();
    await press(text.help.noticeTitles['fonts.txt']);
    expect(shown()).toContain(fixture.notices[0].text);
    await press(text.navigation.back);
    expect(shown()).toContain(text.help.noticeTitles['fonts.txt']);
    expect(missingKeys).toEqual([]);
  },
);

test('updates Help labels on a same-direction language change', async () => {
  jest.spyOn(native, 'readNotices').mockReset().mockResolvedValue(fixture);
  await ReactTestRenderer.act(async () => {
    await i18n.changeLanguage('en');
    tree = ReactTestRenderer.create(<AppNavigator initialRouteName="Home" direction="ltr" />);
  });
  await press(catalogues.en.help.title);
  await press(catalogues.en.help.licences);
  await ReactTestRenderer.act(async () => {
    await i18n.changeLanguage('fr');
  });
  expect(shown()).toContain(catalogues.fr.help.appLicence);
  expect(shown()).not.toContain(catalogues.en.help.appLicence);
  await press(catalogues.fr.help.noticeTitles['fonts.txt']);
  expect(shown()).toContain(catalogues.fr.help.noticeTitles['fonts.txt']);
});
