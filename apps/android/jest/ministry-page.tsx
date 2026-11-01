// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's calendar page rendered for its tests (#607): the bundled
// calendar with a made-up wilaya entry, a store of its own, the page or any
// element in its place, a way to settle its answers, its words and controls,
// the entries it lists, the draft its store keeps, and unmounting it again.

import { keptCalendarDraft, parseDay, type CalendarEntry, type RecordBook } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ministryBase } from '../src/ministry/calendar-desk';
import { MinistryCalendar } from '../src/ministry/MinistryCalendar';
import { openRecordBook } from '../src/storage/history';
import { FakeStorage } from './fake-storage';
import { reference } from './grant-world';

export const storm: CalendarEntry = {
  id: 'world-storm-16',
  layer: 'zone',
  zone: '16',
  from: parseDay('2026-11-18'),
  to: parseDay('2026-11-18'),
  effect: 'closure',
  name: { ar: 'غلق بسبب عاصفة مختلقة', en: 'A made-up storm closure' },
  source: 'A made-up notice',
  confidence: 'announced',
};
/** The bundled reference, its calendar with the made-up wilaya entry. */
export const withStorm = {
  ...reference,
  calendar: { ...reference.calendar, entries: [...reference.calendar.entries, storm] },
};
export const base = ministryBase(withStorm.calendar);
export const date = reference.calendar.year.terms[0].to;

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

/** The page rendered last. */
export const rendered = () => tree!;

/** Unmounts the page rendered last, if any. */
export async function unmount() {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
export async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 20; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
export const texts = () =>
  rendered()
    .root.findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
export const alerts = () =>
  rendered()
    .root.findAllByType(Text)
    .filter((node) => (node.props as TextProps).accessibilityRole === 'alert')
    .map((node) => (node.props as TextProps).children);
export const control = (testID: string) =>
  rendered().root.findAll((one) => one.props.testID === testID && one.props.onPress !== undefined)[0];
export const press = (testID: string) => act(() => (control(testID)?.props as PressableProps).onPress?.({} as never));
export const has = (testID: string) => rendered().root.findAll((one) => one.props.testID === testID).length > 0;
export const entries = () =>
  rendered()
    .root.findAll((one) => typeof one.type === 'string' && String(one.props.testID).startsWith('ministry-entry-'))
    .map((one) => String(one.props.testID).slice('ministry-entry-'.length));

/** Renders an element in the page's place, or first, and settles its answers. */
export async function show(shown: ReactElement) {
  const wrapped = <LocaleDirContext.Provider value="rtl">{shown}</LocaleDirContext.Provider>;
  await act(() => {
    if (tree === undefined) tree = ReactTestRenderer.create(wrapped);
    else tree.update(wrapped);
  });
}

/** Renders the page over a store, as the Ministry's PC opens it. */
export const render = (book: RecordBook) =>
  show(<MinistryCalendar world={{ book, date }} reference={withStorm} dayText={(day) => `day ${day}`} />);

export const newBook = () => openRecordBook(new FakeStorage().asSpec());
/** The draft the store keeps. */
export const kept = (book: RecordBook) =>
  keptCalendarDraft(book.entries, base, reference.profile, reference.calendar.year);
