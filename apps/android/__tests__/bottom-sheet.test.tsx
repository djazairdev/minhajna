// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { findNodeHandle, Modal, StyleSheet, Text, View } from 'react-native';
import type { ModalProps, PressableProps, TextProps, ViewInstance, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { BottomSheet, type BottomSheetProps } from '../src/components/BottomSheet';
import { Button } from '../src/components/Button';
import { colors, radius } from '../src/design/tokens';
import { samples } from '../src/gallery/samples';
import { sheetTexts } from '../src/gallery/sheet-texts';
import { feedbackTexts } from '../src/gallery/feedback-texts';
import NativeInterface from '../src/native/NativeMinhajnaInterface';
import { catalogues, i18n, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer;
const native = jest.requireActual<typeof import('react-native')>('react-native');
const destination = {} as ViewInstance;
const returnFocusRef = { current: destination as ViewInstance | null };
const frames = new Map<number, (time: number) => void>();
let frameId = 0;
const onClose = jest.fn();
const onChoose = jest.fn();
let send: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(native, 'findNodeHandle').mockImplementation((target) => (target === destination ? 29 : 71));
  frames.clear();
  returnFocusRef.current = destination;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => {
    if (typeof id === 'number') frames.delete(id);
  });
  send = jest.spyOn(NativeInterface, 'focusView').mockImplementation(() => undefined);
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

function element(visible: boolean, direction: 'rtl' | 'ltr' = 'rtl', language: Language = 'ar') {
  const sample = samples[language];
  return (
    <LocaleDirContext.Provider value={direction}>
      <BottomSheet
        visible={visible}
        title={sample.longHeading}
        context={sheetTexts[language].context}
        reassurance={feedbackTexts[language].reassurance}
        returnFocusRef={returnFocusRef}
        onClose={onClose}
      >
        <Button variant="line" label={sample.buttons.primary} onPress={onChoose} />
      </BottomSheet>
    </LocaleDirContext.Provider>
  );
}

async function render(visible = true, direction: 'rtl' | 'ltr' = 'rtl', language: Language = 'ar') {
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element(visible, direction, language));
  });
}

function modal() {
  return tree.root.findByType(Modal).props as ModalProps;
}
function header() {
  return tree.root.findAllByType(View).find((node) => node.props.accessibilityRole === 'header')!;
}
function control(id: string) {
  return tree.root.findAll((node) => node.props.testID === id && !!node.props.onPress)[0].props as PressableProps;
}
async function flushFrames() {
  await ReactTestRenderer.act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(0);
  });
}

test.each(
  (['ar', 'fr', 'en'] as const).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('has an isolated, labelled, growing dialog with a separate close action (%s, %s)', async (language, direction) => {
  await render(true, direction, language);
  expect(modal()).toMatchObject({
    visible: true,
    transparent: true,
    animationType: 'none',
    statusBarTranslucent: true,
    navigationBarTranslucent: true,
  });
  expect(accessibilityProblems(tree.root)).toEqual([]);
  const dialog = tree.root.findAllByType(View).find((node) => node.props.role === 'dialog')!;
  expect(dialog.props).toMatchObject({
    accessibilityLabel: samples[language].longHeading,
    accessibilityViewIsModal: true,
  });
  expect(StyleSheet.flatten((dialog.props as ViewProps).style)).toMatchObject({
    direction,
    maxHeight: '100%',
    backgroundColor: colors.sheet,
    borderTopStartRadius: radius['radius-chip'],
    borderTopEndRadius: radius['radius-chip'],
  });
  expect(header().props).toMatchObject({
    accessible: true,
    accessibilityLabel: samples[language].longHeading,
  });
  expect(header().props.focusable).toBeUndefined();
  expect(control('sheet-close').accessibilityLabel).toBe(catalogues[language].bottomSheet.close);
  expect(control('sheet-backdrop')).toMatchObject({
    accessible: false,
    focusable: false,
    importantForAccessibility: 'no-hide-descendants',
  });
  for (const node of tree.root
    .findAllByType(Text)
    .filter((node) =>
      [samples[language].longHeading, sheetTexts[language].context, feedbackTexts[language].reassurance].includes(
        node.props.children as string,
      ),
    )) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
    expect(props.adjustsFontSizeToFit).not.toBe(true);
    expect(StyleSheet.flatten(props.style)).toMatchObject({ textAlign: 'start', writingDirection: direction });
    expect(StyleSheet.flatten(props.style)?.height).toBeUndefined();
  }
});

test('hidden content is absent and an initially closed sheet cannot steal focus', async () => {
  await render(false);
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  expect(frames.size).toBe(0);
  expect(send).not.toHaveBeenCalled();
});

test('sheet input focus and blur cannot trigger the background screen keyboard handler', async () => {
  await render();
  const layer = tree.root.findAllByType(View).find((node) => node.props.testID === 'sheet-layer')!.props as ViewProps;
  const stopPropagation = jest.fn();
  await ReactTestRenderer.act(() => {
    layer.onFocus?.({ stopPropagation } as never);
    layer.onBlur?.({ stopPropagation } as never);
  });
  expect(stopPropagation).toHaveBeenCalledTimes(2);
});

test('reopening and unmounting cancel even a request already sent to the native frame queue', async () => {
  const cancel = jest.spyOn(NativeInterface, 'cancelFocusRequest');
  await render();
  await ReactTestRenderer.act(() => tree.update(element(false)));
  await flushFrames();
  expect(send).toHaveBeenCalledWith(29);
  cancel.mockClear();
  await ReactTestRenderer.act(() => tree.update(element(true)));
  expect(cancel).toHaveBeenCalled();
  cancel.mockClear();
  await ReactTestRenderer.act(() => tree.unmount());
  expect(cancel).toHaveBeenCalled();
});

test.each(['close', 'backdrop', 'back'] as const)(
  '%s requests cancellation without choosing or owning visibility',
  async (route) => {
    await render();
    await ReactTestRenderer.act(() => {
      if (route === 'back') void modal().onRequestClose?.({} as never);
      else control(`sheet-${route}`).onPress?.({} as never);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    expect(modal().visible).toBe(true);
  },
);

test('focuses the heading only after the native window is shown', async () => {
  await render();
  expect(send).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    void modal().onShow?.({} as never);
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(71);
});

test('restores the mounted destination after controlled close, not before', async () => {
  await render();
  await ReactTestRenderer.act(() => {
    tree.update(element(false));
  });
  expect(send).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  await flushFrames();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(29);
});

test('reopening cancels a pending return and unmounting cancels the next one', async () => {
  await render();
  await ReactTestRenderer.act(() => {
    tree.update(element(false));
  });
  expect(frames.size).toBe(1);
  await ReactTestRenderer.act(() => {
    tree.update(element(true));
  });
  await flushFrames();
  expect(send).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    tree.update(element(false));
  });
  await ReactTestRenderer.act(() => tree.unmount());
  await flushFrames();
  expect(send).not.toHaveBeenCalled();
});

test('a destination removed by navigation is ignored safely', async () => {
  await render();
  await ReactTestRenderer.act(() => {
    tree.update(element(false));
  });
  returnFocusRef.current = null;
  await flushFrames();
  expect(send).not.toHaveBeenCalled();
});

test('a target without a native handle is ignored safely', async () => {
  await render();
  jest.mocked(findNodeHandle).mockReturnValue(undefined);
  await ReactTestRenderer.act(() => {
    void modal().onShow?.({} as never);
    tree.update(element(false));
  });
  await flushFrames();
  expect(send).not.toHaveBeenCalled();
});

test('a detached native target is ignored even if its ref was retained', async () => {
  await render();
  await ReactTestRenderer.act(() => tree.update(element(false)));
  returnFocusRef.current = { isConnected: false } as ViewInstance;
  await flushFrames();
  expect(send).not.toHaveBeenCalled();
});

test('Button exposes the native opener ref without changing its action contract', async () => {
  const opener = { current: null as ViewInstance | null };
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Button ref={opener} label={sheetTexts.ar.open} onPress={onChoose} />);
  });
  expect(opener.current).not.toBeNull();
  expect(typeof opener.current?.focus).toBe('function');
  expect(accessibilityProblems(tree.root)).toEqual([]);
});

/** Every sheet must be dismissible and name a destination for focus restoration. */
function propContracts() {
  const props = { visible: false, title: '', context: '', reassurance: '', children: null };
  // @ts-expect-error A sheet always needs a close callback and return target.
  const invalid: BottomSheetProps = props;
  return invalid;
}

test('keeps the dismissal and return-focus prop contract checked by TypeScript', () => {
  expect(propContracts()).toBeDefined();
});
