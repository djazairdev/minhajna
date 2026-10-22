// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A history changed outside the app (#235, Log-broken, answer 427): once the
// lock opens, the app shows, read-only and guarded as a screen of records,
// the first day that cannot be checked, or that it cannot be known, the
// changes since counted by kind, what still checks and the log up to the
// break, a class named from the changes that check; nothing is written to
// the history; it locks like the app and goes with the history; English
// reads left to right; and a history that cannot be read at all keeps its
// one line. Made-up records only.

import { parseDay, type RecordEvent, type SessionRecord } from '@minhajna/core';
import { AppState, Text, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { accessibilityProblems } from '../jest/accessibility';
import type { FakeLock } from '../jest/fake-lock';
import { FakeStorage } from '../jest/fake-storage';
import { typePin } from '../jest/unlock';
import NativeLock from '../src/native/NativeMinhajnaLock';
import { readBroken } from '../src/storage/broken-history';
import { openRecordBook } from '../src/storage/history';
import { i18n, missingKeys } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const lock = NativeLock as unknown as FakeLock;
let warn: jest.SpyInstance;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  missingKeys.length = 0;
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  warn.mockRestore();
  await i18n.changeLanguage('ar');
});

const record: SessionRecord = {
  session: {
    key: 'c-1/2026-10-15/m1/k-1-w',
    courseId: 'c-1',
    groupId: 'k-1-w',
    day: parseDay('2026-10-15'),
    slot: { half: 'morning', index: 1 },
  },
  outcome: 'done',
  sessionType: 'lesson',
  coverage: [],
};
const setup: RecordEvent[] = [
  {
    kind: 'class.set',
    schoolClass: { id: 'k-1', schoolId: 's-1', name: '4م1', level: 'cem', grade: '4am', groups: [] },
  },
  { kind: 'course.set', course: { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null } },
  { kind: 'session.recorded', record },
];

/** A class's session, its correction, then two notes; the second note's body is changed outside the app. */
async function tampered(): Promise<FakeStorage> {
  const storage = FakeStorage.unlocked();
  const book = await openRecordBook(storage.asSpec());
  await book.recordAll(parseDay('2026-10-15'), setup);
  await book.record(parseDay('2026-10-16'), { kind: 'session.recorded', record: { ...record, outcome: 'partial' } });
  const note = { sessionKey: record.session.key, note: 'ملاحظة (مثال)' };
  await book.record(parseDay('2026-10-17'), { kind: 'session.noted', note });
  await book.record(parseDay('2026-10-18'), { kind: 'session.noted', note: { ...note, note: 'أخرى (مثال)' } });
  const row = storage.rows.at(-2)!;
  row.body = JSON.stringify({ kind: 'session.noted', note: { ...note, note: 'تغيّرت (مثال)' } });
  return storage;
}

async function open(storage: FakeStorage) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await typePin(tree!);
  await ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );
const labels = () =>
  tree!.root
    .findAll((node) => typeof node.type === 'string' && String(node.props.testID ?? '').startsWith('log-item-'))
    .map((node) => String(node.props.accessibilityLabel));

test('shows, read-only and guarded, what still checks and what cannot be checked', async () => {
  const storage = await tampered();
  const before = JSON.stringify(storage.rows);
  await open(storage);
  expect(texts()).toEqual(
    expect.arrayContaining([
      text.log.broken.title,
      'من 17/10/2026: كل تغيير منذ ذلك اليوم لا يُتحقق منه',
      'الملاحظات والمذكرات: 2',
      'كل ما سُجّل حتى 16/10/2026، قبل أول تغيير لا يُتحقق منه',
      text.log.broken.safe,
    ]),
  );
  expect(texts()).not.toContain('دفتر النصوص: 0');
  expect(labels()).toEqual([
    'لا يُتحقق منه. تغيير: ملاحظة خاصة',
    'لا يُتحقق منه. تغيير: ملاحظة خاصة',
    'التصحيحات. دفتر النصوص · \u20684م1\u2069 · الخميس 15/10 · نتيجة الحصة',
  ]);
  expect(JSON.stringify(texts())).not.toMatch(/ملاحظة \(مثال\)|أخرى|تغيّرت/);
  expect(lock.secure).toBe(true);
  expect(lock.guarded.at(-1)).toBe('records');
  expect(JSON.stringify(storage.rows)).toBe(before);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('locks like the app after the lock’s delay away, and the broken screen goes with the history', async () => {
  const listening = new Set<Parameters<typeof AppState.addEventListener>[1]>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    listening.add(listener);
    return { remove: () => listening.delete(listener) };
  });
  const realNow = Date.now.bind(Date);
  let offset = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
  await open(await tampered());
  expect(texts()).toContain(text.log.broken.title);
  await ReactTestRenderer.act(async () => {
    offset += 6 * 60_000;
    for (const listener of [...listening]) listener('active');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(texts()).not.toContain(text.log.broken.title);
  expect(texts()).toContain(text.lock.promptPin);
  jest.restoreAllMocks();
});

test('says the first day cannot be known when no change past the break can be read', async () => {
  const storage = await tampered();
  storage.rows.at(-2)!.day = 'not a day';
  storage.rows.at(-1)!.day = 'not a day';
  await open(storage);
  expect(texts()).toEqual(
    expect.arrayContaining([
      text.log.broken.fromUnknown,
      'كل ما سُجّل حتى 16/10/2026، قبل أول تغيير لا يُتحقق منه',
      'تغييرات أخرى: 2',
    ]),
  );
});

test('reads left to right in English', async () => {
  await i18n.changeLanguage('en');
  await open(await tampered());
  expect(texts()).toEqual(
    expect.arrayContaining([
      'Something changed outside the app',
      'From 17/10/2026: no change since that day can be checked',
      'Notes: 2',
    ]),
  );
  expect(missingKeys).toEqual([]);
});

test('a history that cannot be read keeps its one line, and an intact one shows no damage', async () => {
  const storage = FakeStorage.unlocked();
  storage.opened = false;
  storage.keyLost = true;
  await open(storage);
  expect(texts()).toContain(text.historyRefused);
  expect(texts()).not.toContain(text.log.broken.title);
  const intact = FakeStorage.unlocked();
  const book = await openRecordBook(intact.asSpec());
  await book.recordAll(parseDay('2026-10-15'), setup);
  expect(await readBroken(intact.asSpec())).toBeNull();
});
