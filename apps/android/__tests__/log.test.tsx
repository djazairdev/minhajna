// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سجل النشاط» (#235, Log, answers 425 and 426): an empty log says what it
// will hold; a session's correction names the book, the class, the day, the
// fields and the reason; a roll call's names each pupil by number, never by
// name; outputs by their title and period; an erasure by the kinds it
// removed; the tabs filter; backups and recovery sheets under the devices,
// whose tab shows once it has one (#247); the days head with no clock time;
// and English reads left to right. Made-up records only.

import { RECOVERY_ALPHABET, parseDay, type RecordEvent, type SessionRecord } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { mount, root, texts, unmount } from '../jest/note-screens';
import { withDay } from '../jest/today-day';
import { Log } from '../src/log/Log';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const day = parseDay('2026-10-15');
const record: SessionRecord = {
  session: {
    key: 'c-1/2026-10-15/m1/k-1-w',
    courseId: 'c-1',
    groupId: 'k-1-w',
    day,
    slot: { half: 'morning', index: 1 },
  },
  outcome: 'done',
  sessionType: 'lesson',
  coverage: [],
};
const rollCall = (late: string[]) => ({
  unit: 'k-1/2026-10-15/morning/k-1-w',
  classId: 'k-1',
  groupId: 'k-1-w',
  day,
  half: 'morning' as const,
  absent: [{ pupilId: 'p-2', justified: false }],
  late,
});
const pupil = (id: string, name: string): RecordEvent => ({
  kind: 'pupil.set',
  pupil: { id, classId: 'k-1', name, sex: 'f', groups: [], movements: [] },
});

/** A day of changes: a correction of each book, two outputs, a print of a re-pace draft, and a note erased. */
async function withChanges(): Promise<TestData> {
  const data = await withDay();
  const later = parseDay('2026-10-16');
  await data.book.recordAll(day, [
    pupil('p-1', 'أمينة (مثال)'),
    pupil('p-2', 'سارة (مثال)'),
    { kind: 'session.recorded', record },
    { kind: 'roll-call.taken', rollCall: rollCall([]) },
  ]);
  const homework = { ...record, homework: { text: 'تمرين (مثال)', due: parseDay('2026-10-18') } };
  const note = await data.book.record(later, {
    kind: 'session.noted',
    note: { sessionKey: record.session.key, note: 'ملاحظة (مثال)' },
  });
  await data.book.recordAll(later, [
    { kind: 'session.recorded', record: homework, correction: 'added-later' },
    { kind: 'roll-call.taken', rollCall: rollCall(['p-1']), reason: 'arrived-late' },
    { kind: 'output.recorded', output: { id: 'o-1', document: 'texts', period: '2026-10', how: 'pdf', blank: true } },
    {
      kind: 'output.recorded',
      output: { id: 'o-2', document: 'book-fixes', period: '2026-10', how: 'print', blank: false },
    },
  ]);
  await data.book.erase(parseDay('2026-10-17'), [note.id]);
  return data;
}

const labels = () =>
  root()
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('log-item-'))
    .filter((node) => typeof node.type === 'string')
    .map((node) => String(node.props.accessibilityLabel));

const select = async (value: string) => {
  await ReactTestRenderer.act(async () => {
    (root().findByProps({ testID: 'log-tabs' }).props as { onSelect: (one: string) => void }).onSelect(value);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

test('an empty log says what it will hold, with the chain intact and nothing sent', async () => {
  await mount(await withDay(), <Log />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'لا شيء في السجل بعد: يُكتب هنا كل تصحيح وطباعة وحذف، بيومه.',
      'السلسلة سليمة: لا تعديل ولا حذف من خارج التطبيق',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('lists each correction, output and erasure by day, a pupil by number, never a name or a note', async () => {
  await mount(await withChanges(), <Log />);
  expect(texts()).toEqual(expect.arrayContaining(['17/10/2026', '16/10/2026']));
  expect(texts()).not.toContain('15/10/2026');
  expect(labels()).toEqual([
    'الحذف. حذف ملاحظة خاصة. يبقى أنه حُذف، دون محتواه',
    'الملفات والطباعة. تصحيحات دفتر النصوص · أكتوبر 2026 · طباعة',
    'الملفات والطباعة. دفتر النصوص · أكتوبر 2026 · PDF · فارغة',
    'التصحيحات. المناداة · \u20684م1\u2069 · الخميس 15/10 · التلميذ 1: من حضور إلى تأخر · السبب: الوصول بعد المناداة',
    'التصحيحات. دفتر النصوص · \u20684م1\u2069 · الخميس 15/10 · الواجب المنزلي، موعد الواجب · السبب: أُضيف بعد التأكيد',
  ]);
  expect(JSON.stringify(texts())).not.toMatch(/أمينة|سارة|تمرين|ملاحظة \(مثال\)/);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('the tabs show one kind at a time, and say when a kind has nothing', async () => {
  await mount(await withChanges(), <Log />);
  await select('erasures');
  expect(labels()).toEqual(['الحذف. حذف ملاحظة خاصة. يبقى أنه حُذف، دون محتواه']);
  await select('corrections');
  expect(labels()).toHaveLength(2);
  await unmount();
  await mount(await withDay(), <Log />);
  await select('files');
  expect(texts()).toContain('لا شيء في السجل بعد: يُكتب هنا كل تصحيح وطباعة وحذف، بيومه.');
});

test('lists backups and recovery sheets under the devices, a tab shown only once it has one', async () => {
  const tabs = () =>
    (root().findByProps({ testID: 'log-tabs' }).props as { choices: { value: string }[] }).choices.map(
      (one) => one.value,
    );
  await mount(await withChanges(), <Log />);
  expect(tabs()).toEqual(['all', 'corrections', 'files', 'erasures']);
  await unmount();
  const data = await withDay();
  const later = parseDay('2026-10-16');
  await data.book.record(day, {
    kind: 'recovery.set',
    recovery: { key: ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('') },
  });
  await data.book.record(later, { kind: 'recovery.set', recovery: { key: RECOVERY_ALPHABET.slice(0, 24) } });
  await data.book.record(later, { kind: 'backup.saved' });
  await data.book.erase(later, [data.book.entries.find((entry) => entry.kind === 'recovery.set')!.id]);
  await mount(data, <Log />);
  expect(tabs()).toEqual(['all', 'corrections', 'files', 'erasures', 'devices']);
  await select('devices');
  expect(labels()).toEqual(['الأجهزة. حُفظت نسخة احتياطية', 'الأجهزة. أُعدّت ورقة استرجاع جديدة، دون مفتاحها']);
  await select('erasures');
  expect(labels()).toEqual(['الحذف. حذف مفتاح استرجاع سابق. يبقى أنه حُذف، دون محتواه']);
  expect(JSON.stringify(texts())).not.toMatch(/K7QF|0123/);
  expect(missingKeys).toEqual([]);
});

test('reads left to right in English', async () => {
  await i18n.changeLanguage('en');
  await mount(await withChanges(), <Log />, 'ltr');
  expect(labels()[1]).toBe('Files and printing. Texts-book corrections · October 2026 · Print');
  expect(texts()).toContain('The chain is intact: nothing changed or deleted outside the app');
  expect(missingKeys).toEqual([]);
});
