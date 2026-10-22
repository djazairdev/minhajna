// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A hybrid plan's weekly targets (#231, Plan-lycee, answer 387): the pace card
// names the last target whose day passed without it, and whether the next one
// is reached in time, with the sessions left beside those needed; each target
// follows its item in the rows, «هدف» then «بُلغ»; and Today's proposal tag
// adds «هدف الأسبوع N». A pack paced in sessions has none. Made-up data only.

import { awaitingBetween, confirmSessions, parseDay, type WeekTarget } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { hybridId, withHybrid } from '../jest/hybrid-lycee';
import { closeSettingsScreen, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { TargetLines } from '../src/classes/WeekTargets';
import { coreContext } from '../src/storage/core-context';
import { i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

const unit = (title: string) => `«\u2068${title}\u2069»`;
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const texts = (id: string) => [
  ...new Set(
    settingsRoot()
      .findAll((node) => node.props.testID === id)[0]
      ?.findAllByType(Text)
      .map((node) => [node.props.children as unknown].flat().join('')) ?? [],
  ),
];

/** Every session from 20 September to 14 October recorded as proposed. */
async function recorded(data: TestData): Promise<void> {
  const context = () => coreContext({ ...data, state: data.book.state });
  const day = parseDay('2026-10-14');
  const sessions = awaitingBetween(context(), parseDay('2026-09-20'), day);
  await data.book.recordAll(
    day,
    confirmSessions(
      context(),
      sessions.map((session) => ({ session, choice: { outcome: 'done' as const } })),
    ),
  );
}

test('says a target’s day has passed, warns for the next one, and shows each target after its item', async () => {
  await showSettingsScreen(<ClassPlan courseId="c-l" />, await withHybrid());
  expect(texts('plan-target')).toEqual([
    `هدف الأسبوع 3 · نهاية ${unit('الأعداد الطبيعية (مثال)')}`,
    'فات موعده، الخميس 08/10، ولم يُبلغ بعد.',
    `هدف الأسبوع 6 · نهاية ${unit('الكسور (مثال)')}`,
    'لن يُبلغ في موعده، الثلاثاء 27/10، بهذه الوتيرة. تبقى إليه 6 حصص، ويحتاج ما بقي من عناصره 11 حصة.',
  ]);
  expect(texts('plan-target-3')).toEqual(['08/10', 'هدف الأسبوع 3', `نهاية ${unit('الأعداد الطبيعية (مثال)')}`, 'هدف']);
  expect(texts('plan-target-6')[0]).toBe('27/10');
  const ids = settingsRoot()
    .findAll((node) => typeof node.props.testID === 'string' && /^plan-(u1-i|u2-1|target-3)$/.test(node.props.testID))
    .map((node) => node.props.testID as string);
  expect([...new Set(ids)]).toEqual(['plan-u1-i', 'plan-target-3', 'plan-u2-1']);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('says the next target is reached in time once the first one is', async () => {
  const data = await withHybrid();
  await recorded(data);
  await showSettingsScreen(<ClassPlan courseId="c-l" />, data, 'en');
  expect(texts('plan-target')).toEqual([
    `Week 6 target · End of “\u2068الكسور (مثال)\u2069”`,
    'Reached in time, Tuesday 27/10. 6 sessions left until then, and its items need 1 session.',
  ]);
  expect(texts('plan-target-3').at(-1)).toBe('Reached');
});

test('warns when a target will not be reached in time', async () => {
  const data = await withHybrid();
  const pack = data.packs.find((one) => one.id === hybridId)!;
  const item = pack.items.find((one) => one.id === 'u2-i')!;
  const late: WeekTarget = { week: 6, item, due: parseDay('2026-10-27'), reached: false, left: 2, needed: 4.5 };
  await showSettingsScreen(<TargetLines pack={pack} targets={[late]} today={parseDay('2026-10-15')} />, data);
  expect(texts('plan-target')[1]).toBe(
    'لن يُبلغ في موعده، الثلاثاء 27/10، بهذه الوتيرة. تبقى إليه حصتان، ويحتاج ما بقي من عناصره 5 حصص.',
  );
});

test('says when no session is left before a target, and nothing once every target is reached', async () => {
  const data = await withHybrid();
  const pack = data.packs.find((one) => one.id === hybridId)!;
  const item = pack.items.find((one) => one.id === 'u2-i')!;
  const none: WeekTarget = { week: 6, item, due: parseDay('2026-10-15'), reached: false, left: 0, needed: 1 };
  await showSettingsScreen(<TargetLines pack={pack} targets={[none]} today={parseDay('2026-10-15')} />, data);
  expect(texts('plan-target')[1]).toBe(
    'لن يُبلغ في موعده، الخميس 15/10، بهذه الوتيرة. لا حصة تبقى إليه، ويحتاج ما بقي من عناصره حصة واحدة.',
  );
  const done = { ...none, reached: true };
  await showSettingsScreen(<TargetLines pack={pack} targets={[done]} today={parseDay('2026-10-15')} />, data);
  expect(has('plan-target')).toBe(false);
});

test('adds the target to Today’s proposal tag, and nothing for a pack paced in sessions', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  const shown = async (data: TestData) => {
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <LocaleDirContext.Provider value="rtl">
          {withData(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />)}
        </LocaleDirContext.Provider>,
      );
    });
    const all = tree!.root.findAllByType(Text).map((node) => [node.props.children as unknown].flat().join(''));
    await ReactTestRenderer.act(() => tree?.unmount());
    return all;
  };
  expect((await shown(await withHybrid())).some((one) => /^مقترح من المخطط · هدف الأسبوع \d+$/.test(one))).toBe(true);
  expect((await shown(await withDay())).some((one) => one.includes('هدف الأسبوع'))).toBe(false);
  await showSettingsScreen(<ClassPlan courseId="c-1" />, await withDay());
  expect(has('plan-target')).toBe(false);
});
