// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A choice to take part that the world's store does not keep (#622, answer
// 697): it is said, the choice staying as it was, in that world alone, and a
// choice kept after clears it. Every world is made up.

import type { RecordBook } from '@minhajna/core';
import { Text, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { useInsightsSending } from '../src/insights/use-insights-sending';

const date = reference.calendar.year.terms[0].to;
let keeps = false;
const book = {
  entries: [],
  record: () => (keeps ? Promise.resolve() : Promise.reject(new Error('Made-up failure'))),
} as unknown as RecordBook;
const digest = (text: string) => Promise.resolve(text);
const send = () => Promise.reject(new Error('Nothing is sent here'));

function Harness({ world }: { readonly world: string }) {
  const taking = useInsightsSending({ open: { world, date, book }, reference, kit: nodeKit, digest, send });
  return (
    <>
      <Text testID="state">{JSON.stringify([taking.choice.on, taking.unkept])}</Text>
      <Text testID="on" onPress={() => taking.choose(true)} />
      <Text testID="off" onPress={() => taking.choose(false)} />
    </>
  );
}

test('a choice not kept is said in its world alone, and a kept one clears it', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  const choose = (testID: string) => ((tree!.root.findByProps({ testID }).props as TextProps).onPress as () => void)();
  const state = () => String(tree!.root.findByProps({ testID: 'state' }).props.children);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Harness world="K7QF4" />);
  });
  expect(state()).toBe('[false,false]');
  await ReactTestRenderer.act(async () => {
    choose('on');
    await Promise.resolve();
  });
  expect(state()).toBe('[false,true]');
  await ReactTestRenderer.act(() => tree!.update(<Harness world="M3PX9" />));
  expect(state()).toBe('[false,false]');
  await ReactTestRenderer.act(() => tree!.update(<Harness world="K7QF4" />));
  expect(state()).toBe('[false,true]');
  keeps = true;
  await ReactTestRenderer.act(async () => {
    choose('off');
    await Promise.resolve();
  });
  expect(state()).toBe('[false,false]');
  await ReactTestRenderer.act(() => tree?.unmount());
});
