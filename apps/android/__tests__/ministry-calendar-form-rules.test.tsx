// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules of the Ministry's calendar form (#607, answer 623), over the
// bundled calendar: while it is open the layers are hidden, and a new entry
// added in a wilaya is titled with it and goes there; levels that leave out a
// year an exam keeps are refused beside the levels, and all its levels save;
// reopening an entry the draft moved keeps its reason; choosing an exam window
// picks the first term and leaving it drops the term; the last day is never
// before the first; saving says when fields are missing; two presses on Save
// keep the draft once; a change keeps a name in another language while
// clearing French drops only French; and closing the form brings the focus
// back to the button that opened it. Every entry and device is made up.

import { EMPTY_DRAFT, setDraftEntry } from '@minhajna/core';
import * as ReactNative from 'react-native';
import { Platform, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  act,
  base,
  control,
  date,
  has,
  kept,
  newBook,
  press,
  render,
  rendered,
  texts,
  type,
  unmount,
} from '../jest/ministry-page';
import { entryOf, formOf } from '../src/ministry/entry-form';
import NativeInterface from '../src/native/NativeMinhajnaInterface';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ministryCalendar;
const exam = base.find((one) => one.id === 'term-1-exams')!;
const year = { from: base[0].from, to: base[0].to, id: '', terms: [], source: '' };
const said = () => String(rendered().root.findByProps({ testID: 'ministry-calendar-said' }).props.children);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

test('a new entry in a wilaya is titled with it and goes there, the layers hidden meanwhile', async () => {
  const book = await newBook();
  await render(book);
  await press('ministry-calendar-layer-zone');
  await press('ministry-calendar-zone');
  await press('ministry-calendar-zone-16');
  await press('ministry-calendar-add');
  expect([has('ministry-calendar-layer-national'), has('ministry-calendar-zone')]).toEqual([false, false]);
  expect(texts().some((one) => one.startsWith(words.form.newIn.split('{{')[0]) && one.includes('16'))).toBe(true);
  await press('ministry-form-save');
  expect(said()).toBe(words.form.missing);
  await type('ministry-form-name-ar', 'غلق مختلق');
  await type('ministry-form-source', 'A made-up notice');
  await press('ministry-form-save');
  expect(kept(book).draft.entries[0]).toMatchObject({ layer: 'zone', zone: '16' });
});

test('levels must cover the years an exam keeps', async () => {
  const book = await newBook();
  await render(book);
  await press(`ministry-change-${exam.id}`);
  await press('ministry-form-levels-cem');
  await press('ministry-form-save');
  expect(texts()).toContain(words.form.needLevels);
  expect(kept(book).draft.entries).toEqual([]);
  await press('ministry-form-levels-primary');
  await press('ministry-form-levels-lycee');
  await press('ministry-form-save');
  expect(kept(book).draft.entries[0]).toMatchObject({ levels: ['primary', 'cem', 'lycee'], grades: exam.grades });
});

test('reopening an entry the draft moved keeps its reason', async () => {
  const book = await newBook();
  const later = { ...exam, from: '2026-12-13', to: '2026-12-17' } as typeof exam;
  await book.record(date, {
    kind: 'ministry.calendar',
    draft: setDraftEntry(base, EMPTY_DRAFT, later, 'A made-up reason'),
  });
  await render(book);
  await press(`ministry-change-${exam.id}`);
  await type('ministry-form-source', 'Another made-up notice');
  await press('ministry-form-save');
  expect(kept(book).draft.entries[0]).toMatchObject({
    source: 'Another made-up notice',
    moved: { from: exam.from, to: exam.to, reason: 'A made-up reason' },
  });
});

test('an exam window picks the first term, leaving it drops the term, and the last day follows the first', async () => {
  const book = await newBook();
  await render(book);
  await press('ministry-calendar-add');
  await type('ministry-form-name-ar', 'اختبار مختلق');
  await type('ministry-form-source', 'A made-up notice');
  await press('ministry-form-effect-exam');
  await press('ministry-form-effect-marker');
  await press('ministry-form-effect-exam');
  await press('ministry-form-edge-to');
  await press('extra-month-after');
  await press('ministry-form-edge-from');
  const to = String(date).slice(0, 8) + '28';
  await press(`extra-day-${to}`);
  await press('ministry-form-edge-to');
  await press(`extra-day-${String(date).slice(0, 8)}01`);
  await press('ministry-form-save');
  expect(kept(book).draft.entries[0]).toMatchObject({ effect: 'exam', term: 1, from: to, to });
  await press(`ministry-change-${kept(book).draft.entries[0].id}`);
  await press('ministry-form-effect-marker');
  await press('ministry-form-save');
  expect(kept(book).draft.entries[0]).not.toHaveProperty('term');
});

test('two presses on Save keep the draft once', async () => {
  const book = await newBook();
  const record = jest.spyOn(book, 'record');
  await render(book);
  await press(`ministry-change-${exam.id}`);
  await type('ministry-form-source', 'Another made-up notice');
  await act(() => {
    const { onPress } = control('ministry-form-save').props as PressableProps;
    onPress?.({} as never);
    onPress?.({} as never);
  });
  expect(record).toHaveBeenCalledTimes(1);
  expect(has('ministry-form')).toBe(false);
});

test('a change keeps a name in another language, and clearing French drops only French', () => {
  const was = { ...exam, name: { ar: 'اختبار', fr: 'Examen', en: 'Exam', tzm: 'Made-up name' } };
  const form = { ...formOf(was, date, { ...year, terms: [] }, was), fr: '' };
  expect(entryOf(form, was, was).name).toEqual({ tzm: 'Made-up name', ar: 'اختبار', en: 'Exam' });
});

test('closing the form brings the focus back to the button that opened it', async () => {
  const frames: ((time: number) => void)[] = [];
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
  const tags: Record<string, number> = { 'ministry-calendar-add': 29, [`ministry-change-${exam.id}`]: 31 };
  jest
    .spyOn(jest.requireActual<typeof ReactNative>('react-native'), 'findNodeHandle')
    .mockImplementation((node) => tags[String((node as { props?: { testID?: string } } | null)?.props?.testID)] ?? 71);
  const focus = jest.spyOn(NativeInterface, 'focusView').mockImplementation(() => undefined);
  await render(await newBook());
  const flush = () => ReactTestRenderer.act(() => frames.splice(0).forEach((callback) => callback(0)));
  await press(`ministry-change-${exam.id}`);
  await press('ministry-form-cancel');
  await flush();
  expect(focus).toHaveBeenLastCalledWith(31);
  await press('ministry-calendar-add');
  await press('ministry-form-cancel');
  await flush();
  expect(focus).toHaveBeenLastCalledWith(29);
});
