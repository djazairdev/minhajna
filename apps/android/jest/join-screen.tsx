// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The join screen in a test (answer 808): a made-up school recorded first,
// the screen rendered in a direction, its controls pressed and its field typed
// in, with every update awaited inside `act`. Every name is made up.

import { parseDay, type School } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { Join } from '../src/join/Join';
import { openTestData, withData, type TestData } from './app-data';

/** The phone's made-up school, whose code is the made-up delivery's school. */
export const CHOSEN: School = {
  id: 's-1',
  name: 'متوسطة النجاح',
  code: 'cem-16-1',
  levels: ['cem'],
  subjects: ['arabic'],
  zone: '16',
};

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
/** What the screen calls when it leaves. */
export const onDone = jest.fn();
const root = () => tree!.root;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Test data with `schools` recorded. */
export async function withSchools(...schools: readonly School[]): Promise<TestData> {
  const data = await openTestData();
  for (const school of schools) await data.book.record(parseDay('2026-10-01'), { kind: 'school.set', school });
  return data;
}

/** Shows the join, into the school `named` when given, in `direction`. */
export async function showJoin(data: TestData, named?: string, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Join named={named} onDone={onDone} />)}
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
}

/** Unmounts the screen, if it shows, and forgets the calls. */
export async function closeJoin() {
  const shown = tree;
  tree = undefined;
  if (shown !== undefined) await ReactTestRenderer.act(() => shown.unmount());
  onDone.mockReset();
}

/** The screen's root, for queries. */
export const joinRoot = (): ReactTestInstance => root();

/** The nodes with `id`, host and composite alike counted once. */
export const withId = (id: string) => root().findAll((one) => one.props.testID === id, { deep: false });

/** Presses the control `id` and lets what it starts settle. */
export async function press(id: string) {
  const [node] = root().findAll(
    (one) => one.props.testID === id && typeof (one.props as PressableProps).onPress === 'function',
    { deep: false },
  );
  if (node === undefined) throw new Error(`Nothing to press has the test ID ${id}`);
  await ReactTestRenderer.act(async () => {
    (node.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

/** Types `value` into the code field. */
export async function typeCode(value: string) {
  const input = withId('join-code')[0].findByType(TextInput);
  await ReactTestRenderer.act(() => {
    (input.props as TextInputProps).onChangeText?.(value);
  });
}

/** Every text on the screen, as shown. */
export const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
