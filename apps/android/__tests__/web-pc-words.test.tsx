// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The last sweep of the PC's words before 0.6.0 (#250, answer 509): on a PC the
// notifications screen says a PC gets none and offers nothing to allow; the
// plan-error report says how the browser sends it, goes through the browser's
// share menu or is copied, and says so; offering a list saves its file, as a
// browser may share no JSON file, and records the offer only once saved; the
// language screen and the drawn signature name this PC, and the signature's
// pad drops the TalkBack line; the phone keeps its own words and its button.
// Made-up records only.

import { parseDay, saveFreeList } from '@minhajna/core';
import { Platform, Share } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { mount, press, root, texts, unmount } from '../jest/components-screen';
import { calendarInput } from '../jest/calendar-input';
import { browserState, resetBrowser } from '../jest/fake-browser';
import { fakeNotify } from '../jest/fake-notify';
import { withPupils } from '../jest/roll-class';
import { withDay } from '../jest/today-day';
import { DrawnSignature } from '../src/drawn/DrawnSignature';
import files from '../src/native/NativeMinhajnaFiles';
import { PlanError } from '../src/plan/PlanError';
import { PlanOffer } from '../src/plan/PlanOffer';
import { Language } from '../src/settings/Language';
import { Notify } from '../src/settings/Notify';
import settings from '../src/settings/text/ar.json';
import text from '../src/text/ar.json';

jest.mock('../src/native/NativeMinhajnaBrowser', () => jest.requireActual<object>('../jest/fake-browser'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

/** Every text and label on screen, hints included, as a screen reader would find them. */
const said = () =>
  root()
    .findAll((node) => typeof (node.props as { accessibilityHint?: unknown }).accessibilityHint === 'string')
    .map((node) => (node.props as { accessibilityHint: string }).accessibilityHint);

beforeEach(() => {
  jest.clearAllMocks();
  resetBrowser();
  fakeNotify.allowed = false;
});
afterEach(async () => {
  await unmount();
  fakeNotify.allowed = true;
  jest.restoreAllMocks();
});

describe('on a PC', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  test('the notifications screen says a PC gets none, with nothing to allow', async () => {
    await mount(await withPupils(), <Notify />);
    expect(texts()).toContain(text.notify.pc.off);
    expect(texts()).not.toContain(text.notify.off);
    expect(has('notify-allow')).toBe(false);
  });

  test('the plan-error report says how the browser sends it, and says it was copied', async () => {
    const share = jest.spyOn(Share, 'share');
    await mount(await withDay(), <PlanError courseId="c-1" itemId="u1-3" />);
    expect(texts()).toEqual(expect.arrayContaining([text.planError.pc.offline, text.planError.pc.sendTo]));
    expect(texts()).not.toContain(text.planError.offline);
    await ReactTestRenderer.act(async () => {
      const [field] = root().findAll(
        (node) => node.props.testID === 'error-note' && typeof node.props.onChangeText === 'function',
      );
      (field?.props as { onChangeText: (value: string) => void }).onChangeText('Made-up note');
      await Promise.resolve();
    });
    await press('error-share');
    expect(browserState.sent).toHaveLength(1);
    expect(share).not.toHaveBeenCalled();
    expect(texts()).toContain(text.report.copied);
    browserState.sendAs = 'failed';
    await press('error-share');
    expect(texts()).toContain(text.report.copyFailed);
  });

  test('offering a list saves its file and records the offer once saved', async () => {
    const data = await withDay();
    const list = {
      courseId: 'c-2',
      started: parseDay('2026-09-21'),
      items: [{ id: 'u1', kind: 'unit' as const, title: 'Unit (made-up)' }],
    };
    await data.book.record(parseDay('2026-10-15'), saveFreeList(data.book.state.courses, list));
    const makeText = jest.spyOn(files, 'makeText');
    jest.spyOn(files, 'saveFile').mockResolvedValueOnce(false);
    await mount(data, <PlanOffer courseId="c-2" />);
    expect(texts()).toEqual(
      expect.arrayContaining([text.planOffer.pc.share, text.planOffer.pc.sendTo, text.planOffer.pc.offline]),
    );
    await press('offer-share');
    expect(data.book.state.lists.get('c-2')?.offered).toBeUndefined();
    expect(has('offer-sent')).toBe(false);
    await press('offer-share');
    expect(makeText.mock.calls.map(([, name]) => name)).toEqual([
      'minhajna-list-2026-10-15.json',
      'minhajna-list-2026-10-15.json',
    ]);
    expect(calendarInput.shareText).not.toHaveBeenCalled();
    expect(data.book.state.lists.get('c-2')?.offered).toBe('2026-10-15');
    expect(texts()).toContain(text.planOffer.pc.sent);
  });

  test('the language screen and the drawn signature name this PC', async () => {
    await mount(await withPupils(), <Language onDone={jest.fn()} />);
    expect(texts()).toContain(settings.pc.languageIntro);
    await unmount();
    await mount(await withPupils(), <DrawnSignature />);
    expect(texts()).toContain(settings.signature.pc.phoneOnly);
    expect(texts()).not.toContain(settings.signature.phoneOnly);
    expect(said()).toContain(settings.signature.pc.padHint);
    expect(said()).not.toContain(settings.signature.padHint);
  });
});

test('on a phone, the screens keep their words and the button to allow notifications', async () => {
  await mount(await withPupils(), <Notify />);
  expect(texts()).toContain(text.notify.off);
  expect(has('notify-allow')).toBe(true);
  await unmount();
  await mount(await withPupils(), <Language onDone={jest.fn()} />);
  expect(texts()).toContain(settings.languageIntro);
  await unmount();
  await mount(await withPupils(), <DrawnSignature />);
  expect(texts()).toContain(settings.signature.phoneOnly);
  expect(said()).toContain(settings.signature.padHint);
});
