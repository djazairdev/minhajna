// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التوقيع المرسوم» (#236, Signature, answer 411): off and undrawn at first,
// its switch waiting for a drawing; strokes drawn on the pad kept as a path
// of points only, each as it ends; the switch kept with the card's name;
// «مسح وإعادة الرسم»; the notes, in Arabic, French and English; the Settings
// row and the card's row that open it; and the card's name changed without
// losing the signature. A stroke before the pad is laid out keeps nothing,
// and clearing turns the signature off. Made-up data only.

import { eventOf, parseDay, type RecordEvent } from '@minhajna/core';
import type { ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { settingsData } from '../jest/settings-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { DrawnSignature } from '../src/drawn/DrawnSignature';
import { Settings } from '../src/settings/Settings';
import { Card } from '../src/setup/Card';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await closeSettingsScreen();
  jest.useRealTimers();
  await i18n.changeLanguage('ar');
});

const pad = () => settingsRoot().find((node) => node.props.testID === 'signature-pad').props as ViewProps;
const at = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } }) as never;
const checked = (id: string) => settingsControl(id).accessibilityState;
const personalEvents = (events: readonly (RecordEvent | null)[]) =>
  events.filter((event) => event?.kind === 'teacher.personal.set');

/** Draws one stroke through the points, on a pad 300 wide. */
async function draw(points: readonly [number, number][]): Promise<void> {
  await ReactTestRenderer.act(() => {
    pad().onLayout?.({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } } } as never);
  });
  await ReactTestRenderer.act(async () => {
    pad().onResponderGrant?.(at(...points[0]));
    for (const point of points.slice(1)) pad().onResponderMove?.(at(...point));
    pad().onResponderRelease?.(at(...points[points.length - 1]));
    await Promise.resolve();
  });
}

test.each(['ar', 'fr', 'en'] as const)('it is off and undrawn at first, with its notes (%s)', async (language) => {
  missingKeys.length = 0;
  await showSettingsScreen(<DrawnSignature />, await settingsData(), language);
  expect(checked('signature-use')).toMatchObject({ checked: false, disabled: true });
  expect(checked('signature-redraw')).toMatchObject({ disabled: true });
  expect(settingsTexts()).toEqual(
    expect.arrayContaining([
      i18n.t('settings.signature.empty'),
      i18n.t('settings.signature.drawFirst'),
      i18n.t('settings.signature.phoneOnly'),
      i18n.t('settings.signature.shapeOnly'),
      i18n.t('settings.signature.where'),
      i18n.t('settings.signature.legal'),
    ]),
  );
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('strokes are kept as points only, each as it ends, and the switch then turns it on', async () => {
  const data = await settingsData();
  await data.book.record(parseDay('2026-10-15'), { kind: 'teacher.personal.set', personal: { name: 'بن يحيى سعاد' } });
  await showSettingsScreen(<DrawnSignature />, data);
  await draw([
    [10, 10],
    [10.5, 10.5],
    [60, 40],
  ]);
  await draw([[150, 50]]);
  const kept = personalEvents(data.book.entries.map(eventOf));
  expect(kept.at(-1)).toEqual({
    kind: 'teacher.personal.set',
    personal: {
      name: 'بن يحيى سعاد',
      signature: { width: 600, height: 200, path: 'M 20 20 L 120 80 M 300 100 L 300 100' },
    },
  });
  expect(data.book.state.personal?.signature?.path).toBe('M 20 20 L 120 80 M 300 100 L 300 100');
  expect(checked('signature-use')).toMatchObject({ checked: false });
  await ReactTestRenderer.act(async () => {
    const onValueChange = settingsRoot().find(
      (node) => node.props.testID === 'signature-use' && typeof node.props.onValueChange === 'function',
    ).props.onValueChange as (value: boolean) => void;
    onValueChange(true);
    await Promise.resolve();
  });
  expect(data.book.state.personal).toMatchObject({ name: 'بن يحيى سعاد', signatureOn: true });
  await pressSettings('signature-redraw');
  expect(data.book.state.personal).toEqual({ name: 'بن يحيى سعاد' });
  expect(checked('signature-use')).toMatchObject({ checked: false, disabled: true });
});

test('a stroke before the pad is laid out keeps nothing', async () => {
  const data = await settingsData();
  await showSettingsScreen(<DrawnSignature />, data);
  const before = data.book.entries.length;
  await ReactTestRenderer.act(async () => {
    pad().onResponderGrant?.(at(10, 10));
    pad().onResponderMove?.(at(60, 40));
    pad().onResponderRelease?.(at(60, 40));
    await Promise.resolve();
  });
  expect(data.book.entries).toHaveLength(before);
  expect(pad().accessibilityValue).toEqual({ text: i18n.t('settings.signature.statusNone') });
});

test('the Settings row and the card’s row open it, and the card’s name keeps the signature', async () => {
  const data = await settingsData();
  const signature = { width: 600, height: 200, path: 'M 1 1 L 2 2' };
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'teacher.personal.set',
    personal: { signature, signatureOn: true },
  });
  const onOpen = jest.fn();
  await showSettingsScreen(<Settings onOpen={onOpen} />, data);
  expect(settingsTexts()).toContain(i18n.t('settings.signature.statusOn'));
  await pressSettings('settings-signature');
  expect(onOpen).toHaveBeenCalledWith('signature');
  const onSignature = jest.fn();
  await showSettingsScreen(<Card editing onNext={jest.fn()} onSignature={onSignature} />, data);
  await pressSettings('card-signature');
  expect(onSignature).toHaveBeenCalledTimes(1);
  jest.useFakeTimers();
  await typeSettings('card-name', 'بن يحيى سعاد');
  await ReactTestRenderer.act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  });
  jest.useRealTimers();
  await ReactTestRenderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(data.book.state.personal).toEqual({ name: 'بن يحيى سعاد', signature, signatureOn: true });
});
