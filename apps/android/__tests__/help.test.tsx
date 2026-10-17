// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Alert, Linking, ScrollView, StyleSheet, Text } from 'react-native';
import type { AlertButton, GestureResponderEvent, PressableProps, ScrollViewProps, TextProps } from 'react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import ReactTestRenderer from 'react-test-renderer';
import native, { type AppLicences } from '../src/native/NativeMinhajnaLicences';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { HelpPage, HelpRow } from '../src/help/HelpPage';
import { LicenceNoticeScreen, noticeTitle } from '../src/help/HelpScreens';
import { sourceUrl } from '../src/help/SourceLink';
import { sizes } from '../src/design/tokens';
import text from '../src/text/ar.json';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let read: jest.SpiedFunction<typeof native.readNotices>;
let openURL: jest.SpiedFunction<typeof Linking.openURL>;
const fixture: AppLicences = {
  version: '0.0.0',
  notices: [
    { name: 'data.txt', text: 'Synthetic public data attribution.' },
    {
      name: 'fonts.txt',
      text: 'Synthetic public font notice.\n\nSecond paragraph — حقوق الخطوط.\n\nحقوق الخطوط محفوظة.',
    },
    { name: 'minhajna.txt', text: 'Synthetic app licence.' },
    { name: 'new-notice.txt', text: 'A future public notice, without a UI code change.' },
  ],
};
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  read = jest.spyOn(native, 'readNotices').mockReset().mockResolvedValue(fixture);
  openURL = jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

async function press(label: string) {
  const button = tree!.root
    .findAll((node) => typeof (node.props as PressableProps).onPress === 'function')
    .find((node) => (node.props as PressableProps).accessibilityLabel === label);
  expect(button).toBeDefined();
  await ReactTestRenderer.act(async () => {
    (button!.props as PressableProps).onPress?.({} as GestureResponderEvent);
    await Promise.resolve();
  });
}

async function openLicences(direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<AppNavigator direction={direction} />);
    await Promise.resolve();
  });
  await press(text.help.title);
  await press(text.help.licences);
}

function shown() {
  return tree!.root
    .findAllByType(Text)
    .map((node) => (node.props as TextProps).children)
    .flat();
}

test.each(['rtl', 'ltr'] as const)(
  'lists every asset, including unknown future names, and reads it offline (%s)',
  async (direction) => {
    await openLicences(direction);
    expect(shown()).toEqual(
      expect.arrayContaining([
        text.help.appLicence,
        i18n.t('help.version', { version: fixture.version }),
        'new-notice.txt',
      ]),
    );
    expect(tree!.root.findAllByType(HelpRow).map((node): unknown => node.props.label)).toEqual(
      expect.arrayContaining([
        text.help.noticeTitles['data.txt'],
        text.help.noticeTitles['fonts.txt'],
        text.help.noticeTitles['minhajna.txt'],
        'new-notice.txt',
      ]),
    );
    await press(text.help.noticeTitles['fonts.txt']);
    const paragraphs = tree!.root
      .findByType(LicenceNoticeScreen)
      .findAllByType(Text)
      .filter((node) => (node.props as TextProps).selectable);
    expect(paragraphs.map((node): unknown => node.props.children).join('\n\n')).toBe(fixture.notices[1].text);
    expect(paragraphs.map((node) => StyleSheet.flatten((node.props as TextProps).style)?.direction)).toEqual([
      'ltr',
      'ltr',
      'rtl',
    ]);
    const header = tree!.root.findAllByType(TopBar).at(-1)!.props as NativeStackHeaderProps;
    expect(header.route.params).toEqual({ name: 'fonts.txt' });
    const page = tree!.root.findAllByType(HelpPage).at(-1)!.findByType(ScrollView).props as ScrollViewProps;
    expect(StyleSheet.flatten(page.contentContainerStyle)).toMatchObject({ flexGrow: 1, direction });
    await press(text.navigation.back);
    expect(shown()).toContain('new-notice.txt');
    expect(openURL).not.toHaveBeenCalled();
  },
);

test('uses wrapping, scalable text and labelled touch targets of at least 48 dp', async () => {
  await openLicences();
  for (const node of tree!.root.findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
    expect(props.numberOfLines).toBeUndefined();
  }
  for (const row of tree!.root.findAllByType(HelpRow)) {
    const node = row.findAll(
      (item) =>
        (item.props as PressableProps).accessibilityRole === 'button' ||
        (item.props as PressableProps).accessibilityRole === 'link',
    )[0];
    const props = node.props as PressableProps;
    expect(props.accessibilityLabel).toBeTruthy();
    expect(StyleSheet.flatten(props.style as object)).toMatchObject({ minHeight: sizes.target });
  }
});

test('future filenames cannot inherit an object-prototype title', () => {
  for (const name of ['constructor', '__proto__', 'toString']) expect(noticeTitle(name, i18n.t)).toBe(name);
});

test('shows a generic failure and retries without the network', async () => {
  read.mockRejectedValueOnce(new Error('synthetic read failure'));
  await openLicences();
  expect(shown()).toContain(text.help.refused);
  expect(shown()).not.toContain('synthetic read failure');
  await press(text.help.retry);
  expect(shown()).toContain('new-notice.txt');
  expect(read).toHaveBeenCalledTimes(2);
  expect(openURL).not.toHaveBeenCalled();
});

test('refuses a missing notice instead of showing another licence', async () => {
  await openLicences();
  read.mockResolvedValueOnce({ ...fixture, notices: [] });
  await press(text.help.noticeTitles['fonts.txt']);
  expect(shown()).toContain(text.help.refused);
  expect(shown()).not.toContain(fixture.notices[0].text);
});

test('shows loading and ignores a completion after leaving the screen', async () => {
  let resolve!: (value: AppLicences) => void;
  read.mockReturnValueOnce(
    new Promise<AppLicences>((done) => {
      resolve = done;
    }),
  );
  await openLicences();
  expect(shown()).toContain(text.help.loading);
  await press(text.navigation.back);
  await ReactTestRenderer.act(() => resolve(fixture));
  expect(shown()).toContain(text.help.about);
  expect(openURL).not.toHaveBeenCalled();
});

test('asks before opening only the fixed public source address', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await openLicences();
  expect(alert).not.toHaveBeenCalled();
  await press(text.help.source);
  expect(alert).toHaveBeenCalledWith(text.help.source, text.help.browserNotice, expect.any(Array));
  expect(openURL).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2] as AlertButton[];
  expect(buttons[0]).toMatchObject({ text: text.help.cancel, style: 'cancel' });
  expect(buttons[0].onPress).toBeUndefined();
  await ReactTestRenderer.act(() => {
    buttons[1].onPress?.();
  });
  expect(openURL).toHaveBeenCalledTimes(1);
  expect(openURL).toHaveBeenCalledWith(sourceUrl);
});

test('keeps offline notices usable when no browser can open the source', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  openURL.mockRejectedValueOnce(new Error('synthetic unavailable browser'));
  await openLicences();
  await press(text.help.source);
  await ReactTestRenderer.act(() => {
    alert.mock.calls[0][2]![1].onPress?.();
  });
  expect(alert).toHaveBeenLastCalledWith(text.help.source, text.help.browserRefused);
  await press('new-notice.txt');
  expect(shown()).toContain(fixture.notices[3].text);
});
