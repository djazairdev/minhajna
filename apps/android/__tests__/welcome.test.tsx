// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome and the privacy notice before first use (#24), and the notice
// and the connections page again from Help; the notice names Help as its
// screen is titled, where crash reports are turned on (#479), and both name
// the demo server a demo world connects to (#559).

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { BackHandler, Image, Text, TextInput } from 'react-native';
import type { GestureResponderEvent, ImageProps, PressableProps, TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { pickSchool, serveReference } from '../jest/directory-list';
import { RowLink } from '../src/components/RowLink';
import { LockStorage } from '../src/lock/lock-storage';
import { ReopenHistory } from '../src/restore/reopen';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer;
let data: TestData;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree.unmount());
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

async function mount(direction: 'rtl' | 'ltr' = 'rtl') {
  serveReference();
  data = await openTestData();
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LockStorage.Provider value={data.storage.asSpec()}>
        <ReopenHistory.Provider value={jest.fn()}>
          {withData(data, <AppNavigator direction={direction} />)}
        </ReopenHistory.Provider>
      </LockStorage.Provider>,
    );
  });
}

/** Completes setup's two steps with one made-up school and a made-up name, then leaves Ready for the tabs. */
async function finishSetup() {
  const ids = (prefix: string) =>
    tree.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith(prefix));
  await pickSchool(() => tree.root);
  await press(byTestID('setup-next'));
  expect(routes()).toContain('Card');
  expect(heading()).toEqual([text.setup.title, 'الخطوة 2 من 2']);
  await ReactTestRenderer.act(() => {
    (ids('card-name')[0].findByType(TextInput).props as TextInputProps).onChangeText?.('أستاذة مختلقة');
  });
  expect(data.book.state.setupFinished).toBe(false);
  await press(byTestID('card-next'));
  await ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(data.book.state.setupFinished).toBe(true);
  expect(tree.root.findAllByProps({ testID: 'ready-kept' })).not.toEqual([]);
  await press(byTestID('ready-today'));
}

/** Presses inside an async act, so what the press starts, such as Help reading the build facts, settles in it. */
async function press(match: (props: PressableProps) => boolean) {
  const button = tree.root.findAll(
    (node) => typeof (node.props as PressableProps).onPress === 'function' && match(node.props),
  )[0];
  expect(button).toBeDefined();
  await ReactTestRenderer.act(() => {
    (button.props as PressableProps).onPress?.({} as GestureResponderEvent);
    return Promise.resolve();
  });
}

const byTestID = (id: string) => (props: PressableProps) => props.testID === id;
const byLabel = (label: string) => (props: PressableProps) => props.accessibilityLabel === label;

function shown(): string[] {
  return tree.root.findAllByType(Text).map((node) => [node.props.children as unknown].flat().join(''));
}

function heading(): string[] {
  const bars = tree.root.findAllByType(TopBar);
  return bars[bars.length - 1].findAllByType(Text).map((node) => [node.props.children as unknown].flat().join(''));
}

function routes(): string[] {
  const header = tree.root.findAllByType(TopBar)[0]?.props as NativeStackHeaderProps | undefined;
  return header?.navigation.getState().routes.map((route) => route.name) ?? [];
}

test('opens on the welcome, with neither promises nor reader start, and no way to skip the notice', async () => {
  await mount();
  expect(shown()).toEqual([
    text.name,
    text.tagline,
    text.welcome.line,
    text.preview.badge,
    text.preview.short,
    text.language.label,
    text.language.ar,
    text.language.fr,
    text.language.en,
    text.welcome.start,
  ]);
  expect(tree.root.findAllByType(TopBar)).toHaveLength(0);
  const images = tree.root.findAllByType(Image).map((node) => node.props as ImageProps);
  expect(images.map((image) => image.source)).toEqual(
    expect.arrayContaining([{ uri: 'minhajna_mim' }, { uri: 'chalk_line' }]),
  );
  expect(images.filter((image) => image.accessible !== false)).toEqual([]);
});

test('its settings icon leads to a page holding only the restore, which Back leaves', async () => {
  const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.push(handler);
    return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
  });
  await mount();
  const pages = () => tree.root.findAll((node) => node.props.testID === 'welcome-settings-page', { deep: false });
  expect(pages()).toHaveLength(0);
  await press(byTestID('welcome-settings'));
  expect(pages()).toHaveLength(1);
  const page = pages()[0];
  expect(page.findAllByType(Text).map((node) => [node.props.children as unknown].flat().join(''))).toEqual([
    text.welcome.settings,
    text.welcome.restore,
    text.navigation.back,
  ]);
  await press(byTestID('welcome-settings-back'));
  expect(pages()).toHaveLength(0);
  await press(byTestID('welcome-settings'));
  const back = handlers.at(-1);
  await ReactTestRenderer.act(() => {
    expect(back?.({} as never)).toBe(true);
  });
  expect(pages()).toHaveLength(0);
  expect(handlers).not.toContain(back);
});

test('the restore opened from the settings page leaves with one Back, as the phone dispatches it', async () => {
  const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.push(handler);
    return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
  });
  await mount();
  await press(byTestID('welcome-settings'));
  expect(accessibilityProblems(tree.root)).toEqual([]);
  await press(byTestID('welcome-restore'));
  expect(routes()).toEqual(['Welcome', 'Restore']);
  await ReactTestRenderer.act(() => {
    [...handlers].reverse().some((handler) => handler({} as never) === true);
  });
  expect(routes()).toEqual([]);
  expect(tree.root.findAll((node) => node.props.testID === 'welcome-start', { deep: false })).toHaveLength(1);
  expect(tree.root.findAll((node) => node.props.testID === 'welcome-settings-page', { deep: false })).toHaveLength(0);
});

test('leads through the notice to the tabs, and Back from the tabs leaves the app', async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => handlers.delete(handler) };
  });
  await mount();
  await press(byTestID('welcome-start'));
  expect(routes()).toEqual(['Welcome', 'Privacy']);
  expect(heading()).toEqual([text.privacy.title, text.privacy.subtitle]);
  await press(byTestID('privacy-connections'));
  expect(routes()).toEqual(['Welcome', 'Privacy', 'Connections']);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.connections.none,
      text.connections.demo,
      text.connections.source,
      text.connections.packSource,
      text.connections.errorReport,
      text.connections.register,
    ]),
  );
  await press(byLabel(text.navigation.back));
  await press(byTestID('privacy-accept'));
  expect(routes()).toEqual(['Welcome', 'Privacy', 'Teaching']);
  expect(heading()).toEqual([text.setup.title, 'الخطوة 1 من 2']);
  await finishSetup();
  expect(tree.root.findAllByType(TopBar)).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'tab-Today' })).not.toEqual([]);
  let handled = true;
  await ReactTestRenderer.act(() => {
    handled = [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
  });
  expect(handled).toBe(false);
});

test('shows every part of the notice, with the contact still a placeholder', async () => {
  await mount();
  await press(byTestID('welcome-start'));
  const keys = ['phone', 'leave', 'demo', 'never', 'tracking', 'publisher', 'rights'] as const;
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.privacy.heading,
      text.privacy.intro,
      ...keys.flatMap((key) => [text.privacy[`${key}Title`], text.privacy[`${key}Text`]]),
      text.privacy.contact,
      text.privacy.contactName,
      text.privacy.contactAddress,
      text.connections.title,
      text.privacy.accept,
    ]),
  );
  for (const key of keys) expect(tree.root.findAllByProps({ testID: `privacy-${key}` })).not.toEqual([]);
});

test('names the demo server in the notice and the connections, and no longer denies the network', () => {
  const denials = [/does not ask for permission/u, /n’en demande pas/u, /ne demande aucune/u, /لا تطلب إذن/u];
  for (const catalogue of Object.values(catalogues)) {
    for (const words of [catalogue.privacy.demoText, catalogue.connections.demo]) {
      expect(words).toContain('https://minhajna-demo.djazair.dev');
    }
    const all = JSON.stringify(catalogue);
    expect(denials.filter((denial) => denial.test(all))).toEqual([]);
  }
});

test('names Help in the notice as its screen is titled, in every language', () => {
  for (const catalogue of Object.values(catalogues)) {
    expect(catalogue.privacy.trackingText).toContain(catalogue.help.title);
  }
});

test('offers the notice and the connections from Help, without the first-use button', async () => {
  await mount();
  await press(byTestID('welcome-start'));
  await press(byTestID('privacy-accept'));
  await finishSetup();
  await press(byLabel(text.help.title));
  await press(byLabel(text.privacy.helpTitle));
  expect(routes()).toEqual(['Home', 'Help', 'PrivacyNotice']);
  expect(heading()).toEqual([text.privacy.helpTitle]);
  expect(tree.root.findAllByProps({ testID: 'privacy-accept' })).toEqual([]);
  await press(byLabel(text.navigation.back));
  await press(byLabel(text.connections.title));
  expect(routes()).toEqual(['Home', 'Help', 'Connections']);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)(
  'names every control and keeps 48 dp targets on the welcome, the notice and the connections (%s, %s)',
  async (language, direction) => {
    await i18n.changeLanguage(language);
    await mount(direction);
    expect(accessibilityProblems(tree.root)).toEqual([]);
    await press(byTestID('welcome-start'));
    expect(accessibilityProblems(tree.root)).toEqual([]);
    expect(tree.root.findByType(RowLink).props.title).toBe(catalogues[language].connections.title);
    await press(byTestID('privacy-connections'));
    expect(accessibilityProblems(tree.root)).toEqual([]);
    expect(shown()).toContain(catalogues[language].connections.none);
  },
);

test('mirrors the connections chevron in left-to-right languages only', async () => {
  for (const direction of ['rtl', 'ltr'] as const) {
    await mount(direction);
    await press(byTestID('welcome-start'));
    const chevron = tree.root.findByProps({ testID: 'icon-chevron' }).props as ImageProps;
    expect(JSON.stringify(chevron.style)).toContain(direction === 'ltr' ? '"scaleX":-1' : '"transform":[]');
    await ReactTestRenderer.act(() => tree.unmount());
  }
  await mount();
});
