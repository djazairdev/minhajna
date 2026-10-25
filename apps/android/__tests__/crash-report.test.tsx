// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Crash reports, off by default (#249, Crash-preview, answer 483): only the
// error's type and the places in its stack are kept, never its message, and
// no frame at all when the message cannot be set aside; a crash that stops
// the app is kept only while the switch is on, and the crash goes on as it
// would, an error in a render among them; the next start shows exactly what
// would be shared, and «إرسال» or «عدم الإرسال» deletes it while closing
// chooses nothing until the next start; a report that does not read is
// deleted; Help's switch, off at first, deletes a kept report when turned
// off and says so when it did not save; the screens opened reach native
// memory; and every text in French and English. Made-up records only.

import { Share, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { fakeCrash } from '../jest/fake-crash';
import { withData } from '../jest/app-data';
import { mount, press, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { CrashBoundary } from '../src/help/CrashBoundary';
import { CrashSheet } from '../src/help/CrashSheet';
import { clearOffer, crashFrames, crashType, keepCrashes } from '../src/help/crash-report';
import { clearSteps, recordStep } from '../src/help/steps';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const share = jest.spyOn(Share, 'share');
const iso = (value: string) => `\u2068${value}\u2069`;

beforeEach(() => {
  missingKeys.length = 0;
  fakeCrash.reset();
  clearOffer();
  share.mockResolvedValue({ action: 'sharedAction', activityType: undefined });
});
afterEach(async () => {
  await unmount();
  clearSteps();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

/** An error as Hermes gives it: its name and message, then its frames. */
function thrown(message: string, frames: string[], name = 'TypeError'): Error {
  const error = new Error(message);
  error.name = name;
  error.stack = [message === '' ? name : `${name}: ${message}`, ...frames].join('\n');
  return error;
}

const FRAMES = [
  '    at renderRoll (address at index.android.bundle:1:20457)',
  '    at anonymous (index.android.bundle:1:9812)',
  '    at apply (native)',
  '    at /data/app/~~x/base.apk!/assets/index.android.bundle:1:5',
];

test('keeps the type and the frames, never the message or a path', () => {
  const error = thrown('غياب مختلق آية\n    at Ahmed (index.android.bundle:1:2)', FRAMES);
  expect(crashType(error)).toBe('TypeError');
  expect(crashFrames(error)).toEqual(['renderRoll 1:20457', 'anonymous 1:9812', 'apply']);
  expect(crashFrames(error).join(' ')).not.toMatch(/Ahmed|آية|data/u);
  expect(crashFrames(thrown('', FRAMES))).toHaveLength(3);
});

test('keeps no frame when the message cannot be set aside, and no odd type', () => {
  const error = thrown('x', FRAMES);
  error.stack = `Error: Ahmed\n${FRAMES[0]}`;
  expect(crashFrames(error)).toEqual([]);
  expect(crashType(thrown('x', FRAMES, 'آية مختلق'))).toBe('Error');
  expect(crashType('a thrown string')).toBe('Error');
  expect(crashFrames({ stack: FRAMES.join('\n') })).toEqual([]);
});

test('keeps a crash that stops the app only while the switch is on, and lets it go on', () => {
  let handler: ((error: unknown, isFatal?: boolean) => void) | undefined;
  const before = jest.fn();
  const errorUtils = { getGlobalHandler: () => before, setGlobalHandler: (one: typeof handler) => (handler = one) };
  Object.assign(globalThis, { ErrorUtils: errorUtils });
  keepCrashes();
  recordStep('Today');
  recordStep('Roll');
  const error = thrown('غياب مختلق آية', FRAMES);
  handler?.(error, true);
  expect(fakeCrash.report).toBeNull();
  fakeCrash.on = true;
  handler?.(error, false);
  expect(fakeCrash.report).toBeNull();
  handler?.(error, true);
  expect(JSON.parse(fakeCrash.report ?? '{}')).toEqual({
    type: 'TypeError',
    frames: ['renderRoll 1:20457', 'anonymous 1:9812', 'apply'],
    steps: ['Today', 'Roll'],
    version: '0.5.0',
    android: '15',
  });
  expect(fakeCrash.report).not.toMatch(/آية/u);
  expect(before).toHaveBeenCalledTimes(3);
  expect(before).toHaveBeenLastCalledWith(error, true);
});

/** A report kept by the last crash, as the native module holds it. */
function kept() {
  fakeCrash.on = true;
  fakeCrash.report = JSON.stringify({
    type: 'TypeError',
    frames: ['renderRoll 1:20457', 'apply'],
    steps: ['Today', 'Roll'],
    version: '0.5.0',
    android: '15',
  });
}

test('shows the kept report as it will be shared, and deletes it once sent', async () => {
  kept();
  await mount(await withPupils(), <CrashSheet />);
  const lines = [
    'تقرير عطل في «منهاجنا»',
    `العطل: ${iso('TypeError')}`,
    `موضعه في الشيفرة: ${iso('renderRoll 1:20457, apply')}`,
    `الإصدار: ${iso('0.5.0')} · أندرويد ${iso('15')}`,
    `آخر الخطوات في التطبيق، دون محتوى: ${iso('Today › Roll')}`,
  ];
  expect(texts()).toEqual(expect.arrayContaining(lines));
  await press('crash-send');
  expect(fakeCrash.report).toBeNull();
  expect(share).toHaveBeenCalledWith({ message: lines.join('\n'), title: 'تقرير عطل، قبل إرساله' });
});

test('deletes the report unsent, and keeps it for the next start when the sheet is only closed', async () => {
  kept();
  await mount(await withPupils(), <CrashSheet />);
  await press('sheet-close');
  expect(fakeCrash.report).not.toBeNull();
  await unmount();
  await mount(await withPupils(), <CrashSheet />);
  expect(texts()).not.toContain('تقرير عطل في «منهاجنا»');
  await unmount();
  clearOffer();
  await mount(await withPupils(), <CrashSheet />);
  await press('crash-dont-send');
  expect(fakeCrash.report).toBeNull();
  expect(share).not.toHaveBeenCalled();
});

test('shows nothing when no crash was kept, and deletes a report that does not read', async () => {
  await mount(await withPupils(), <CrashSheet />);
  expect(texts()).not.toContain('تقرير عطل في «منهاجنا»');
  await unmount();
  clearOffer();
  fakeCrash.report = '{"type":"TypeError","frames":';
  await mount(await withPupils(), <CrashSheet />);
  expect(texts()).not.toContain('تقرير عطل في «منهاجنا»');
  expect(fakeCrash.report).toBeNull();
});

test('stops the app on an error in a render through the handler that keeps crashes', async () => {
  const fatal = jest.fn();
  Object.assign(globalThis, { ErrorUtils: { getGlobalHandler: () => fatal } });
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const error = thrown('غياب مختلق آية', FRAMES);
  function Broken(): null {
    throw error;
  }
  await mount(
    await withPupils(),
    <CrashBoundary>
      <Broken />
    </CrashBoundary>,
  );
  expect(fatal).toHaveBeenCalledWith(error, true);
  quiet.mockRestore();
});

test("Help's switch starts off, and turning it off deletes a kept report", async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  const data = await withPupils();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(withData(data, <AppNavigator initialRouteName="Home" />));
    await Promise.resolve();
  });
  const tap = async (testID: string) =>
    ReactTestRenderer.act(async () => {
      const node = tree!.root.findAll(
        (one) => (one.props as { testID?: string }).testID === testID && typeof one.props.onPress === 'function',
      )[0];
      (node?.props as PressableProps).onPress?.({} as never);
      await Promise.resolve();
    });
  const shown = () =>
    tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children as unknown].flat().join(''));
  await tap('today-help');
  expect(shown()).toContain('تقارير الأعطال');
  expect(fakeCrash.on).toBe(false);
  await tap('help-crashes');
  expect(fakeCrash.on).toBe(true);
  fakeCrash.report = '{}';
  await tap('help-crashes');
  expect(fakeCrash.on).toBe(false);
  expect(fakeCrash.report).toBeNull();
  fakeCrash.saves = false;
  await tap('help-crashes');
  expect(fakeCrash.on).toBe(false);
  expect(shown()).toContain('لم يُحفظ التغيير. حاول مرة أخرى.');
  const state = tree!.root.findAll(
    (one) => (one.props as { testID?: string }).testID === 'help-crashes' && one.props.accessibilityState !== undefined,
  )[0]?.props.accessibilityState as { checked?: boolean } | undefined;
  expect(state?.checked).toBe(false);
  await ReactTestRenderer.act(() => tree?.unmount());
});

test('gives native code the screens opened, by name, and forgets them on a new start', () => {
  recordStep('Today');
  recordStep('Roll');
  expect(fakeCrash.steps).toEqual(['Today', 'Roll']);
  clearSteps();
  expect(fakeCrash.steps).toEqual([]);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  kept();
  await mount(await withPupils(), <CrashSheet />);
  expect(texts()).toEqual(expect.arrayContaining([i18n.t('crash.heading'), i18n.t('crash.deleted')]));
  expect(missingKeys).toEqual([]);
});
