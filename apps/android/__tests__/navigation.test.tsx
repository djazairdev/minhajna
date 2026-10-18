// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// React 19's renderer unwraps memo components: queries use public pressable props.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { BackHandler, Linking, StyleSheet, Text } from 'react-native';
import type { GestureResponderEvent, PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { BottomNav, TopBar } from '../src/navigation/NavigationChrome';
import { sizes } from '../src/design/tokens';
import text from '../src/text/ar.json';
import { openTestData, withData, type TestData } from '../jest/app-data';

let navData: TestData;
beforeEach(async () => {
  navData = await openTestData();
});

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree.unmount());
  jest.restoreAllMocks();
});

async function mount(direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(withData(navData, <AppNavigator initialRouteName="Home" direction={direction} />));
  });
}

/** Presses inside an async act, so what the press starts, such as Help reading the build facts, settles in it. */
async function press(match: (props: PressableProps) => boolean) {
  const button = buttons().find((node) => match(node.props as PressableProps));
  expect(button).toBeDefined();
  await ReactTestRenderer.act(() => {
    (button!.props as PressableProps).onPress?.({} as GestureResponderEvent);
    return Promise.resolve();
  });
}

function buttons() {
  return tree.root.findAll((node) => typeof (node.props as PressableProps).onPress === 'function');
}

function bar() {
  return tree.root.findByType(BottomNav).props as BottomTabBarProps;
}

test('starts on Today with three labelled, selected-state tabs and no external linking', async () => {
  const initialURL = jest.spyOn(Linking, 'getInitialURL');
  await mount();
  expect(bar().state.routes.map((route) => route.name)).toEqual(['Today', 'Classes', 'Documents']);
  expect(bar().state.index).toBe(0);
  const tabs = buttons().filter((node) => (node.props as PressableProps).accessibilityRole === 'tab');
  expect(tabs.map((node) => (node.props as PressableProps).accessibilityLabel)).toEqual([
    text.navigation.today,
    text.navigation.classes,
    text.navigation.documents,
  ]);
  expect(tabs.map((node) => (node.props as PressableProps).accessibilityState?.selected)).toEqual([true, false, false]);
  for (const tab of tabs) {
    const style = StyleSheet.flatten((tab.props as PressableProps).style as object);
    expect(style).toMatchObject({ minWidth: sizes.target });
    expect((style as { minHeight: number }).minHeight).toBeGreaterThanOrEqual(sizes.target);
  }
  expect(initialURL).not.toHaveBeenCalled();
});

test.each(['rtl', 'ltr'] as const)(
  'stacks an inner screen above the tabs and returns to the chosen tab (%s)',
  async (direction) => {
    await mount(direction);
    await press((props) => props.testID === 'tab-Documents');
    expect(bar().state.routes[bar().state.index].name).toBe('Documents');
    await press((props) => props.accessibilityLabel === text.navigation.openPreview);
    const header = tree.root.findByType(TopBar).props as NativeStackHeaderProps;
    expect(header.navigation.getState().routes.map((route) => route.name)).toEqual(['Home', 'NavigationPreview']);
    expect(header.navigation.getState().index).toBe(1);
    const icon = tree.root.findByProps({ testID: 'back-icon' }).props as ViewProps;
    expect(StyleSheet.flatten(icon.style)).toMatchObject({
      borderEndWidth: 2,
      transform: [{ rotate: direction === 'rtl' ? '135deg' : '225deg' }],
    });
    await press((props) => props.accessibilityLabel === text.navigation.back);
    expect(tree.root.findAllByType(TopBar)).toHaveLength(0);
    expect(bar().state.routes[bar().state.index].name).toBe('Documents');
  },
);

test('honours a cancelled tab press and emits a long press', async () => {
  await mount();
  const navigation = bar().navigation;
  const emit = jest.spyOn(navigation, 'emit');
  emit.mockImplementation((event) => {
    const result = { ...event, defaultPrevented: true, preventDefault: jest.fn() };
    return result;
  });
  await press((props) => props.testID === 'tab-Documents');
  expect(bar().state.index).toBe(0);
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', canPreventDefault: true }));
  const documentTab = buttons().find((node) => (node.props as PressableProps).testID === 'tab-Documents');
  await ReactTestRenderer.act(() => {
    (documentTab!.props as PressableProps).onLongPress?.({} as GestureResponderEvent);
  });
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabLongPress' }));
});

test('does not disable scaling or truncate navigation text', async () => {
  await mount();
  await press((props) => props.accessibilityRole === 'button');
  for (const node of tree.root.findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
    expect(props.numberOfLines).toBeUndefined();
  }
});

test('hardware Back pops the inner screen and tab history, then lets Android handle the root', async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return {
      remove: () => {
        handlers.delete(handler);
      },
    };
  });
  const back = async () => {
    let handled = false;
    await ReactTestRenderer.act(() => {
      handled = [...handlers]
        .reverse()
        .some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
    });
    return handled;
  };
  await mount();
  await press((props) => props.testID === 'tab-Classes');
  await press((props) => props.testID === 'tab-Documents');
  await press((props) => props.accessibilityRole === 'button');
  expect(await back()).toBe(true);
  expect(tree.root.findAllByType(TopBar)).toHaveLength(0);
  expect(bar().state.routes[bar().state.index].name).toBe('Documents');
  expect(await back()).toBe(true);
  expect(bar().state.routes[bar().state.index].name).toBe('Classes');
  expect(await back()).toBe(true);
  expect(bar().state.routes[bar().state.index].name).toBe('Today');
  expect(await back()).toBe(false);
});
