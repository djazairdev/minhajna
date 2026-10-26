// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Help on a PC (#250, answers 509 and 523): the problem report names the PC web
// app in place of Android, says how the browser sends it, and goes through the
// browser's share menu, or is copied, saying so, or says how to copy it by hand
// when the browser refused; the crash report is deleted once shared or copied,
// kept when it was not or its menu was closed, and the sheet says which; while
// the menu is open, both screens wait and send once; the demo-class timings,
// the real-names line and a refused checksum name this PC; the privacy notice
// and its connections page speak of this PC's browser and its host (#483); and
// every new text is in French and English. Made-up records.

import { Platform, Share } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { mount, press, root, texts, unmount } from '../jest/components-screen';
import { browserState, endSends, resetBrowser } from '../jest/fake-browser';
import { fakeCrash } from '../jest/fake-crash';
import { withPupils } from '../jest/roll-class';
import { CrashSheet } from '../src/help/CrashSheet';
import { clearOffer } from '../src/help/crash-report';
import { ProblemReport } from '../src/help/ProblemReport';
import { Connections, PrivacyNotice } from '../src/help/PrivacyNotice';
import { useDeviceText } from '../src/text/device-text';
import calendarAr from '../src/calendar/text/ar.json';
import calendarEn from '../src/calendar/text/en.json';
import calendarFr from '../src/calendar/text/fr.json';
import text from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

jest.mock('../src/native/NativeMinhajnaBrowser', () => jest.requireActual<object>('../jest/fake-browser'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const share = jest.spyOn(Share, 'share');

beforeEach(() => {
  resetBrowser();
  fakeCrash.reset();
  clearOffer();
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterEach(async () => {
  await unmount();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

const iso = (value: string) => `⁨${value}⁩`;
const disabled = (testID: string) =>
  (
    root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
      .accessibilityState as { disabled?: boolean } | undefined
  )?.disabled === true;

function kept() {
  fakeCrash.on = true;
  fakeCrash.report = JSON.stringify({
    type: 'TypeError',
    frames: ['apply'],
    steps: ['Today'],
    version: '0.6.0',
    android: '',
  });
}

test('the problem report names the PC web app and is copied where the browser has no share menu', async () => {
  await mount(await withPupils(), <ProblemReport steps={['Today', 'Help']} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      text.report.pc.offline,
      text.report.pc.sendTo,
      text.report.pc.lineVersion.replace('{{version}}', iso('0.1.0')),
    ]),
  );
  await ReactTestRenderer.act(async () => {
    const [field] = root().findAll(
      (node) => node.props.testID === 'report-note' && typeof node.props.onChangeText === 'function',
    );
    (field?.props as { onChangeText: (value: string) => void }).onChangeText('Made-up problem');
    await Promise.resolve();
  });
  browserState.sendAs = 'copied';
  await press('report-share');
  expect(browserState.sent).toHaveLength(1);
  expect(share).not.toHaveBeenCalled();
  expect(texts()).toContain(text.report.copied);
  browserState.sendAs = 'failed';
  await press('report-share');
  expect(texts()).toContain(text.report.copyFailed);
  expect(texts()).not.toContain(text.report.copied);
  browserState.sendAs = 'shared';
  await press('report-share');
  expect(texts()).not.toContain(text.report.copyFailed);
});

test('a crash report not copied is kept, and one copied is deleted with the sheet saying so', async () => {
  kept();
  await mount(await withPupils(), <CrashSheet />);
  expect(texts()).toEqual(
    expect.arrayContaining([text.crash.pc.deleted, text.report.pc.lineVersion.replace('{{version}}', iso('0.6.0'))]),
  );
  browserState.sendAs = 'failed';
  await press('crash-send');
  expect(fakeCrash.report).not.toBeNull();
  expect(texts()).toContain(text.report.copyFailed);
  browserState.sendAs = 'copied';
  await press('crash-send');
  expect(fakeCrash.report).toBeNull();
  expect(texts()).toContain(text.report.copied);
  expect(disabled('crash-send')).toBe(true);
  expect(browserState.sent).toHaveLength(2);
  expect(share).not.toHaveBeenCalled();
});

test('while the share menu is open, the problem report waits and sends once', async () => {
  await mount(await withPupils(), <ProblemReport steps={['Today']} />);
  await ReactTestRenderer.act(async () => {
    const [field] = root().findAll(
      (node) => node.props.testID === 'report-note' && typeof node.props.onChangeText === 'function',
    );
    (field?.props as { onChangeText: (value: string) => void }).onChangeText('Made-up problem');
    await Promise.resolve();
  });
  browserState.holds = true;
  await press('report-share');
  expect(disabled('report-share')).toBe(true);
  await press('report-share');
  expect(browserState.sent).toHaveLength(1);
  browserState.sendAs = 'cancelled';
  await ReactTestRenderer.act(async () => {
    endSends();
    await Promise.resolve();
  });
  expect(disabled('report-share')).toBe(false);
  expect(texts()).not.toContain(text.report.copied);
});

test('a crash report whose menu is closed is kept, and the sheet waits while the menu is open', async () => {
  kept();
  browserState.sendAs = 'failed';
  await mount(await withPupils(), <CrashSheet />);
  await press('crash-send');
  expect(texts()).toContain(text.report.copyFailed);
  browserState.holds = true;
  browserState.sendAs = 'cancelled';
  await press('crash-send');
  expect(texts()).not.toContain(text.report.copyFailed);
  expect(disabled('crash-send')).toBe(true);
  expect(disabled('crash-dont-send')).toBe(true);
  await press('crash-dont-send');
  expect(fakeCrash.report).not.toBeNull();
  await ReactTestRenderer.act(async () => {
    endSends();
    await Promise.resolve();
  });
  expect(fakeCrash.report).not.toBeNull();
  expect(texts()).toContain(text.crash.pc.deleted);
  expect(disabled('crash-send')).toBe(false);
  expect(browserState.sent).toHaveLength(2);
});

test('a crash report shared through the browser is deleted and the sheet closes', async () => {
  kept();
  browserState.sendAs = 'shared';
  await mount(await withPupils(), <CrashSheet />);
  await press('crash-send');
  expect(fakeCrash.report).toBeNull();
  expect(texts()).not.toContain(text.crash.pc.deleted);
});

test('the timings, the real-names lines and a refused checksum name this PC', async () => {
  const shown: string[] = [];
  function Words() {
    const t = useDeviceText();
    shown.push(t('help.timingsLine'), t('realNames.setup'), t('realNames.beforeLock'), t('preview.refused'));
    return null;
  }
  await mount(await withPupils(), <Words />);
  expect(shown.slice(0, 4)).toEqual([
    text.help.pc.timingsLine,
    text.realNames.pc.setup,
    text.realNames.pc.beforeLock,
    text.preview.pc.refused,
  ]);
});

test('the privacy notice and its connections page speak of this PC', async () => {
  await mount(await withPupils(), <PrivacyNotice onConnections={() => undefined} />);
  const notice = text.privacy.pc;
  expect(texts()).toEqual(
    expect.arrayContaining([notice.phoneTitle, notice.phoneText, notice.leaveText, notice.publisherText]),
  );
  expect(texts()).toEqual(expect.arrayContaining([text.privacy.leaveTitle, text.privacy.trackingText]));
  expect(texts()).not.toContain(text.privacy.phoneText);
  expect(texts()).toContain(calendarAr.receive.pc.privacy);
  expect(texts()).not.toContain(calendarAr.receive.privacy);
  await unmount();
  await mount(await withPupils(), <Connections />);
  const links = text.connections.pc;
  expect(texts()).toEqual(
    expect.arrayContaining([
      links.none,
      links.errorReport,
      links.problemReport,
      links.crashReport,
      text.connections.source,
    ]),
  );
  expect(texts()).not.toContain(text.connections.none);
});

test('every new text is in French and English', () => {
  const pairs = [
    [text.report.pc, fr.report.pc, en.report.pc],
    [text.crash.pc, fr.crash.pc, en.crash.pc],
    [text.help.pc, fr.help.pc, en.help.pc],
    [text.preview.pc, fr.preview.pc, en.preview.pc],
    [text.realNames.pc, fr.realNames.pc, en.realNames.pc],
    [text.privacy.pc, fr.privacy.pc, en.privacy.pc],
    [text.connections.pc, fr.connections.pc, en.connections.pc],
    [calendarAr.receive.pc, calendarFr.receive.pc, calendarEn.receive.pc],
  ] as const;
  for (const [ar, ...others] of pairs) {
    for (const other of others) {
      expect(Object.keys(other)).toEqual(Object.keys(ar));
      for (const [key, value] of Object.entries(other)) expect(value).not.toBe((ar as Record<string, string>)[key]);
    }
  }
  for (const other of [fr, en]) {
    expect(other.report.copied).not.toBe(text.report.copied);
    expect(other.report.copyFailed).not.toBe(text.report.copyFailed);
  }
});
