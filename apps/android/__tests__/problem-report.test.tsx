// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الإبلاغ عن مشكلة» and Help as drawn (#249, answer 483): Help's demo-class,
// timings, report and contact rows, in order; the report's note with every
// pupil's name replaced before it is shown; the part, the version, Android's
// version and the last screens opened, by name only; nothing shared without a
// note; the shared text exactly as shown; the steps kept in memory, ten at
// most, a screen opened twice in a row counted once; and every text in
// French and English. Made-up records only.

import { Share, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { mount, press, root, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { ProblemReport } from '../src/help/ProblemReport';
import { STEPS_KEPT, clearSteps, recentSteps, recordStep } from '../src/help/steps';
import native from '../src/native/NativeMinhajnaBuild';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const share = jest.spyOn(Share, 'share');

beforeEach(() => {
  missingKeys.length = 0;
  share.mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  jest
    .spyOn(native, 'describe')
    .mockResolvedValue({ version: '0.5.0', versionCode: 5, apkSha256: '', signerSha256: null });
});
afterEach(async () => {
  await unmount();
  clearSteps();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const iso = (value: string) => `\u2068${value}\u2069`;
const disabled = (testID: string) =>
  (
    root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
      .accessibilityState as { disabled?: boolean } | undefined
  )?.disabled === true;

async function typeNote(text: string) {
  await ReactTestRenderer.act(async () => {
    const field = root().findAll(
      (node) => node.props.testID === 'report-note' && typeof node.props.onChangeText === 'function',
    )[0];
    (field?.props as { onChangeText: (value: string) => void }).onChangeText(text);
    await Promise.resolve();
  });
}

async function report(data?: TestData, steps = ['Today', 'Roll', 'Help', 'ProblemReport']) {
  await mount(data ?? (await withPupils()), <ProblemReport steps={steps} />);
}

test('replaces every pupil name in the note before showing the report', async () => {
  await report();
  expect(disabled('report-share')).toBe(true);
  expect(texts()).toContain('اكتب ما حدث أولاً.');
  await typeNote('بعد مناداة مختلق آية ثم ريان، اختفى غياب آية.');
  expect(disabled('report-share')).toBe(false);
  const lines = [
    'تقرير مشكلة في «منهاجنا»',
    `ما حدث: ${iso('بعد مناداة تلميذ 1 ثم تلميذ 2، اختفى غياب تلميذ 1.')}`,
    'أين: اليوم',
    expect.stringMatching(new RegExp(`^الإصدار: ${iso('0.5.0')} · أندرويد `)),
    `آخر الخطوات في التطبيق، دون محتوى: ${iso('Today › Roll')}`,
  ];
  expect(texts()).toEqual(expect.arrayContaining(lines));
  expect(texts().join('\n')).not.toMatch(/آية|ريان|مختلق/u);
  await press('report-part-marks');
  expect(texts()).toContain('أين: التقويم والنقاط');
  expect(accessibilityProblems(root())).toEqual([]);
});

test('shares the text exactly as shown, and nothing else', async () => {
  await report();
  await typeNote('لا يظهر الواجب في سجل الواجبات ص 67.');
  await press('report-share');
  expect(share).toHaveBeenCalledTimes(1);
  const message = share.mock.calls[0]?.[0] as { message: string };
  const [preview] = root().findAll((node) => node.props.testID === 'report-preview');
  const shownLines = preview
    .findAllByType(Text)
    .slice(1)
    .map((node) => [(node.props as TextProps).children as unknown].flat().join(''));
  expect(message.message).toBe(shownLines.join('\n'));
  expect(message.message).toContain('ص 67');
});

test('says when no step was recorded', async () => {
  await report(undefined, ['Help']);
  await typeNote('مشكلة');
  expect(texts()).toContain('آخر الخطوات في التطبيق، دون محتوى: لا شيء');
});

test('keeps the last ten screens in memory, a screen opened twice in a row once', () => {
  recordStep('Today');
  recordStep('Today');
  recordStep(undefined);
  recordStep('Roll');
  expect(recentSteps()).toEqual(['Today', 'Roll']);
  for (let index = 0; index < STEPS_KEPT + 2; index += 1) recordStep(`Screen${index}`);
  expect(recentSteps()).toHaveLength(STEPS_KEPT);
  expect(recentSteps()[0]).toBe('Screen2');
});

test('Help shows the demo class, timings, the report and the channels, and opens the report', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  const data = await withPupils();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(withData(data, <AppNavigator initialRouteName="Home" />));
    await Promise.resolve();
  });
  const tap = async (match: (props: PressableProps) => boolean) =>
    ReactTestRenderer.act(async () => {
      const node = tree!.root.findAll(
        (one) => typeof (one.props as PressableProps).onPress === 'function' && match(one.props),
      )[0];
      (node?.props as PressableProps).onPress?.({} as never);
      await Promise.resolve();
    });
  await tap((props) => props.accessibilityLabel === 'المساعدة والخصوصية');
  const shown = tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string')
      .join(''),
  );
  const order = ['القسم التجريبي', 'توقيتاتي في التجربة', 'الإبلاغ عن مشكلة', 'التواصل', 'عن «منهاجنا»'];
  expect(order.map((one) => shown.indexOf(one))).toEqual(
    [...order.map((one) => shown.indexOf(one))].sort((a, b) => a - b),
  );
  expect(shown).toEqual(expect.arrayContaining(['البريد: contact@djazair.dev']));
  await tap((props) => (props as { testID?: string }).testID === 'help-problem');
  expect(recentSteps()).toEqual(['Today', 'Help', 'ProblemReport']);
  await ReactTestRenderer.act(() => tree?.unmount());
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  await report();
  await typeNote('ريان');
  expect(texts()).toEqual(expect.arrayContaining([expect.stringContaining(i18n.t('report.pupil', { n: 1 }))]));
  expect(missingKeys).toEqual([]);
});
