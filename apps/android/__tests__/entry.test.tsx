// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تفاصيل الحصة» (#34): the row the texts book will take, the session's
// type, the stages covered, homework and its due day, a test, the factual
// line and the private note, all recorded in one step and nothing before.
// Made-up schools, classes and timetables only.

import { confirmSessions, current, parseDay, recordsForRoute, todayView, type OutboundRoute } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { key, withDay } from '../jest/today-day';
import { PrivateNote } from '../src/components/PrivateNote';
import { Entry } from '../src/entry/Entry';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const window = { width: 360, height: 800, scale: 2, fontScale: 1 };
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDone = jest.fn();

beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue(window);
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onDone.mockReset();
});

async function show(data: TestData, sessionKey = key(1), direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Entry sessionKey={sessionKey} day={parseDay('2026-10-15')} onDone={onDone} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const book = () =>
  String(
    root().findAll((node) => node.props.testID === 'entry-book' && node.props.accessibilityLabel !== undefined)[0]
      ?.props.accessibilityLabel,
  );
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (
      root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0]
        .props as PressableProps
    ).onPress?.({} as never);
  });
};
const type = async (id: string, value: string) => {
  await ReactTestRenderer.act(() => {
    root()
      .findAll((node) => node.props.testID === id && typeof node.props.onChangeText === 'function')
      .map((node) => node.props as TextInputProps)[0]
      ?.onChangeText?.(value);
  });
};

test.each(
  (
    [
      { language: 'ar', direction: 'rtl', label: 'ملاحظة خاصة · لا تغادر أجهزتك' },
      { language: 'fr', direction: 'ltr', label: 'Note privée · ne quitte pas vos appareils' },
      { language: 'en', direction: 'ltr', label: 'Private note · never leaves your devices' },
    ] as const
  ).flatMap((choice) => [1, 2].map((fontScale) => ({ ...choice, fontScale }))),
)(
  'associates the private note with its privacy label ($language, $fontScale×)',
  async ({ language, direction, label, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ ...window, fontScale });
    await i18n.changeLanguage(language);
    const data = await withDay();
    await show(data, key(1), direction);
    const input = () =>
      root()
        .findAllByType(TextInput)
        .find((node) => node.props.testID === 'entry-note')!.props as TextInputProps;
    const associated = () => root().findByProps({ nativeID: input().accessibilityLabelledBy });
    expect(associated().props.accessibilityLabel).toBe(label);
    expect(associated().props.children).toBe(label);
    expect(root().findByType(PrivateNote).props.testID).toBe('entry-note');
    expect(input()).toMatchObject({ multiline: true, value: '' });
    expect(StyleSheet.flatten(input().style)).toMatchObject({ writingDirection: direction, minWidth: 48 });
    const labelId = input().accessibilityLabelledBy;
    await type('entry-note', 'تذكير مختلق\nوسائل للحصة المقبلة');
    expect(input().value).toBe('تذكير مختلق\nوسائل للحصة المقبلة');
    expect(input().accessibilityLabelledBy).toBe(labelId);
    expect(associated().props.accessibilityLabel).toBe(label);
    expect(data.book.state.notes.size).toBe(0);
    expect(accessibilityProblems(root())).toEqual([]);
  },
);

test('shows the row the texts book will take, and records nothing before «تأكيد الحصة»', async () => {
  const data = await withDay();
  await show(data);
  expect(book()).toBe('2026/10/15. ⁧08سا – 09سا⁩. الموضوع: تقويم تشخيصي (مثال)');
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.entry.book,
      text.entry.type,
      'درس',
      'فرض',
      text.entry.noteWarning,
      text.entry.confirm,
    ]),
  );
  expect(shown()).not.toContain(text.entry.due);
  expect(accessibilityProblems(root())).toEqual([]);
  await type('entry-homework', 'التمرين 5 ص 22');
  expect(shown()).toEqual(expect.arrayContaining([text.entry.due, 'الخميس 22/10', 'الخميس 05/11']));
  await press('entry-test');
  await type('entry-factual', 'سطر مختلق');
  expect(book()).toContain('الواجب المنزلي: \u2068التمرين 5 ص 22\u2069، يُسلَّم الخميس 22/10');
  expect(book()).toContain('فرض');
  expect(data.book.state.sessions.size).toBe(0);
  await ReactTestRenderer.act(async () => {
    await i18n.changeLanguage('en');
  });
  await show(data, key(1), 'ltr');
  expect(accessibilityProblems(root())).toEqual([]);
});

test('records the details in one step, the private note on the devices only', async () => {
  const data = await withDay();
  await show(data);
  await type('entry-homework', 'التمرين 5 ص 22');
  await press('entry-due-2026-11-05');
  await press('entry-test');
  await press('entry-unplanned-open');
  await type('entry-unplanned', 'زيارة مختلقة');
  await type('entry-factual', 'سطر مختلق');
  await type('entry-note', 'ملاحظة مختلقة');
  await press('entry-confirm');
  expect(onDone).toHaveBeenCalled();
  expect(current(data.book.state.sessions.get(key(1)))).toMatchObject({
    outcome: 'done',
    coverage: [{ op: 'taught', item: 'd1' }],
    homework: { text: 'التمرين 5 ص 22', due: '2026-11-05' },
    test: 'test',
    unplanned: 'زيارة مختلقة',
    factual: 'سطر مختلق',
  });
  expect(data.book.state.notes.get(key(1))).toEqual({ sessionKey: key(1), note: 'ملاحظة مختلقة' });
  const outbound: readonly OutboundRoute[] = ['documents', 'statement', 'handover', 'handover-direct', 'school-space'];
  for (const route of outbound) {
    expect(JSON.stringify(recordsForRoute(data.book.state, route))).not.toContain('ملاحظة مختلقة');
  }
  await show(data);
  const note = root()
    .findAllByType(TextInput)
    .find((node) => node.props.testID === 'entry-note');
  expect(note?.props.value).toBe('ملاحظة مختلقة');
  await type('entry-note', 'تذكير مختلق جديد\nوسائل للحصة المقبلة');
  expect(data.book.state.notes.get(key(1))?.note).toBe('ملاحظة مختلقة');
  const record = current(data.book.state.sessions.get(key(1)));
  await press('entry-confirm');
  expect(data.book.state.notes.get(key(1))?.note).toBe('تذكير مختلق جديد\nوسائل للحصة المقبلة');
  expect(current(data.book.state.sessions.get(key(1)))).toEqual(record);
  for (const route of outbound) {
    expect(JSON.stringify(recordsForRoute(data.book.state, route))).not.toContain('تذكير مختلق جديد');
  }
});

test('the stages covered, and another session type', async () => {
  const data = await withDay();
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = todayView(context, parseDay('2026-10-15')).sessions;
  expect(first?.session.key).toBe(key(1));
  await data.book.recordAll(
    parseDay('2026-10-15'),
    confirmSessions(context, [{ session: first.session, choice: { outcome: 'merged', with: 'u1-1' } }]),
  );
  await show(data, key(2));
  expect(shown()).toEqual(expect.arrayContaining([text.entry.stages, 'تهيئة', 'بناء', 'تطبيق', 'تقويم']));
  await press('entry-stage-3');
  expect(book()).toContain('- بناء');
  expect(book()).not.toContain('- تطبيق');
  await press('entry-confirm');
  expect(current(data.book.state.sessions.get(key(2)))).toMatchObject({
    outcome: 'partial',
    coverage: [{ op: 'taught', item: 'u1-2', from: 0, to: 2 }],
  });
});

test('a test session takes no lesson, and a recorded session opens as a correction', async () => {
  const data = await withDay();
  await show(data);
  await press('entry-type-test');
  expect(book()).toBe('2026/10/15. ⁧08سا – 09سا⁩');
  await press('entry-confirm');
  expect(current(data.book.state.sessions.get(key(1)))).toMatchObject({ sessionType: 'test', coverage: [] });
  await show(data);
  expect(shown()).toEqual(expect.arrayContaining([text.fix.title, text.fix.recorded, text.fix.save]));
});
