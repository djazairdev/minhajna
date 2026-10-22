// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A timetabled «معالجة» session on Today (#230, P-Today, answer 376): its
// list with the items paired with today's and the coming sessions, «اليوم»,
// «الحصة القادمة» and «بعدها»; as the focus card, «تمّت كما هو مقترح»
// recording the item finished, «نتيجة أخرى» held with the item not
// finished, or not held with no item; the done card naming the item, or
// saying it left the list; an empty list; a «دعم» session with a scheduled
// support session between; and «تفاصيل الحصة» confirming with the item.
// Made-up data only.

import {
  addCatchUp,
  awaitingBetween,
  confirmSessions,
  current,
  parseDay,
  saveSupportQueue,
  type ListKind,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { slot, withPrimary } from '../jest/primary-class';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';
import { Entry } from '../src/entry/Entry';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const day = parseDay('2026-10-15');
const key = 'a-1/2026-10-15/a1/p-1-w';
const card = `today-${key}`;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const contextOf = (data: TestData) => coreContext({ ...data, state: data.book.state });

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

/**
 * 5 ابتدائي أ with an Arabic «معالجة» session, or `type`, after noon and
 * `count` items on its list; `morning` records the morning first.
 */
async function withRemediation(morning = false, type: ListKind = 'remediation', count = 3): Promise<TestData> {
  const data = await withPrimary();
  const [version] = data.book.state.timetables;
  const entries = version.version.entries.map((entry) =>
    entry.id === 'e-3' ? { ...slot('e-3', 'afternoon', 1, 'a-1'), sessionType: type } : entry,
  );
  await data.book.record(day, { kind: 'timetable.set', version: { ...version.version, entries } });
  const items = [...Array(count).keys()].map((n) => ({ id: `r${n + 1}`, title: `معالجة ${n + 1} (مثال)` }));
  const kind = type === 'remediation' ? { kind: type } : {};
  await data.book.record(day, saveSupportQueue(data.book.state, { courseId: 'a-1', ...kind, items }));
  if (morning) {
    const sessions = awaitingBetween(contextOf(data), day, day).filter((one) => one.key !== key);
    await data.book.recordAll(
      day,
      confirmSessions(
        contextOf(data),
        sessions.map((session) => ({ session })),
      ),
    );
  }
  return data;
}

/** Renders Today over `data`, unmounting the tree a test rendered before. */
async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, '2026-10-15')}
      </LocaleDirContext.Provider>,
    );
  });
}

const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const label = (id: string): unknown => root().find((node) => node.props.testID === id).props.accessibilityLabel;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const taken = (data: TestData) => current(data.book.state.sessions.get(key));

async function press(id: string) {
  const [control] = root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function');
  await ReactTestRenderer.act(() => {
    (control?.props as PressableProps).onPress?.({} as never);
  });
}

test.each(['ar', 'fr', 'en'] as Language[])(
  'pairs the list with today’s and the coming sessions (%s)',
  async (language) => {
    missingKeys.length = 0;
    await i18n.changeLanguage(language);
    await render(await withRemediation(), language === 'ar' ? 'rtl' : 'ltr');
    const text = catalogues[language].listToday;
    expect(shown()).toContain(text.heading.remediation);
    const comma = language === 'ar' ? '،' : ',';
    const row = (n: number, place: string) => `${n}${comma} \u2068معالجة ${n} (مثال)\u2069${comma} ${place}`;
    expect(label(`${card}-row-0`)).toBe(row(1, text.today));
    expect(label(`${card}-row-1`)).toBe(row(2, text.next));
    expect(label(`${card}-row-2`)).toBe(row(3, text.after));
    expect(exists(`${card}-confirm`)).toBe(false);
    expect(accessibilityProblems(root())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('«تمّت كما هو مقترح» records the item finished, and the done card names it', async () => {
  const data = await withRemediation(true);
  await render(data);
  await press(`${card}-confirm`);
  expect(taken(data)?.listItem).toEqual({ id: 'r1', finished: true });
  expect(shown()).toContain('«\u2068معالجة 1 (مثال)\u2069»');
});

test('«نتيجة أخرى» records the item held but not finished, or the session not held', async () => {
  const data = await withRemediation(true);
  await render(data);
  await press(`${card}-other`);
  await press(`${card}-open`);
  expect(taken(data)?.listItem).toEqual({ id: 'r1', finished: false });
  expect(shown()).toContain(catalogues.ar.listToday.writtenOpen.replace('{{title}}', '«\u2068معالجة 1 (مثال)\u2069»'));

  const other = await withRemediation(true);
  await render(other);
  await press(`${card}-other`);
  await press(`${card}-not-held`);
  expect(taken(other)).toMatchObject({ outcome: 'not-held' });
  expect(taken(other)?.listItem).toBeUndefined();
});

test('says when the list is empty, and records the session without an item', async () => {
  const data = await withRemediation(true, 'remediation', 0);
  await render(data);
  expect(shown()).toContain(catalogues.ar.listToday.empty.remediation);
  await press(`${card}-confirm`);
  expect(taken(data)).toMatchObject({ outcome: 'done' });
  expect(taken(data)?.listItem).toBeUndefined();
});

test('gives a scheduled support session its turn among the «دعم» sessions', async () => {
  const data = await withRemediation(false, 'support');
  const slot2 = { half: 'afternoon', index: 2 } as const;
  const input = { id: 'u-1', courseId: 'a-1', day: parseDay('2026-10-14'), slot: slot2, kind: 'support' } as const;
  await data.book.record(day, addCatchUp(contextOf(data), input, parseDay('2026-10-13')));
  await render(data);
  const text = catalogues.ar.listToday;
  expect(shown()).toEqual(
    expect.arrayContaining([text.heading.support, text.note.support.replace('{{subject}}', 'اللغة العربية')]),
  );
  expect(label(`${card}-row-0`)).toBe(`1، \u2068معالجة 2 (مثال)\u2069، ${text.today}`);
});

test('says when the item a session took has left the list', async () => {
  const data = await withRemediation(true);
  await render(data);
  await press(`${card}-confirm`);
  const items = [{ id: 'r2', title: 'معالجة 2 (مثال)' }];
  await ReactTestRenderer.act(async () => {
    await data.book.record(day, saveSupportQueue(data.book.state, { courseId: 'a-1', kind: 'remediation', items }));
  });
  await render(data);
  expect(shown()).toContain(catalogues.ar.listToday.removed);
});

test('«تفاصيل الحصة» confirms the session with its item finished', async () => {
  const data = await withRemediation(true);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <Entry sessionKey={key} day={day} onDone={jest.fn()} />)}
      </LocaleDirContext.Provider>,
    );
  });
  await press('entry-confirm');
  expect(taken(data)?.listItem).toEqual({ id: 'r1', finished: true });
});
