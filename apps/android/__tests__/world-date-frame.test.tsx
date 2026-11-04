// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the world's date offer shows (#630, answer 724): on a PC the words are
// said in a live region that stays mounted and clears, and on any device the
// bar stays clear of the safe area and, with the keyboard up, keeps to its line
// and button; and its words read in every language.

import { AccessibilityInfo, Keyboard, Platform, StyleSheet, Text, View, type TextProps } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';
import { WorldDateFrame } from '../src/demo/WorldDateFrame';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.dateMoved;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));

describe('the frame', () => {
  const frame = (movedTo: string | null, insets = { top: 0, bottom: 0, left: 0, right: 0 }) => (
    <SafeAreaInsetsContext.Provider value={insets}>
      <WorldDateFrame movedTo={movedTo} onTake={() => undefined}>
        <View testID="the-page" />
      </WorldDateFrame>
    </SafeAreaInsetsContext.Provider>
  );
  const show = (element: React.ReactElement) =>
    ReactTestRenderer.act(() => {
      if (tree === undefined) tree = ReactTestRenderer.create(element);
      else tree.update(element);
    });
  const bar = () =>
    StyleSheet.flatten(
      tree!.root.findAll((node) => node.type === View && node.props.testID === 'world-date-moved')[0].props.style,
    ) as { paddingBottom: number; paddingLeft: number; paddingRight: number };
  const said = () => tree!.root.findByProps({ testID: 'world-date-said' }).props.children as string;

  it('announces an offer once on a phone, and never on a PC', async () => {
    const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    jest.replaceProperty(Platform, 'OS', 'android');
    await show(frame('made-up day'));
    await show(frame('made-up day'));
    expect(announced).toHaveBeenCalledTimes(1);
    expect(announced).toHaveBeenCalledWith(`${words.line.replace('{{date}}', 'made-up day')} ${words.hint}`);
    await ReactTestRenderer.act(() => tree!.unmount());
    tree = undefined;
    announced.mockClear();
    jest.replaceProperty(Platform, 'OS', 'web');
    await show(frame('another made-up day'));
    expect(announced).not.toHaveBeenCalled();
  });

  it('says the offer on a PC in a live region that stays mounted and clears', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    jest.useFakeTimers();
    await show(frame(null));
    const region = tree!.root.findByProps({ testID: 'world-date-said' });
    expect(said()).toBe('');
    await show(frame('made-up day'));
    expect(said()).toBe(`${words.line.replace('{{date}}', 'made-up day')} ${words.hint}`);
    expect(tree!.root.findByProps({ testID: 'world-date-said' })).toBe(region);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(5000));
    expect(said()).toBe('');
    expect(has('world-date-moved')).toBe(true);
    await show(frame('later made-up day'));
    expect(said()).toBe(`${words.line.replace('{{date}}', 'later made-up day')} ${words.hint}`);
  });

  it('keeps the bar clear of the safe area, and with the keyboard up keeps to its line and button', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const listeners = new Map<string, () => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, listener: () => void) => {
      listeners.set(name, listener);
      return { remove: () => undefined };
    }) as never);
    await show(frame('made-up day', { top: 0, bottom: 24, left: 8, right: 4 }));
    expect(bar()).toMatchObject({ paddingBottom: 36, paddingLeft: 24, paddingRight: 20 });
    expect(texts()).toContain(words.hint);
    await ReactTestRenderer.act(() => listeners.get('keyboardDidShow')!());
    expect(texts()).not.toContain(words.hint);
    expect(texts()).toContain(words.line.replace('{{date}}', 'made-up day'));
    expect(bar().paddingBottom).toBe(12);
    expect(has('world-date-take')).toBe(true);
    await ReactTestRenderer.act(() => listeners.get('keyboardDidHide')!());
    expect(texts()).toContain(words.hint);
    expect(bar().paddingBottom).toBe(36);
  });

  it('reads in every language', () => {
    for (const catalogue of [ar, en, fr]) {
      const { line, take, hint } = catalogue.demo.dateMoved;
      expect(line).toContain('{{date}}');
      expect([take.length > 0, hint.length > 0]).toEqual([true, true]);
    }
  });
});
