// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Grant rendered for its tests (#593): the directorate's page in a made-up
// world, a way to settle its answers, its words and controls, filling the
// form for a school with the first class of its first subject, another grant
// page shown in its place, and unmounting it again.

import { directorSchool, type DemoSchool } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { DirectorateGrant } from '../src/directorate/DirectorateGrant';
import { reference } from './grant-world';
import { nodeKit as kit } from './world-server';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

/** The page rendered last. */
export const rendered = () => tree!;

/** Unmounts the page rendered last, if any. */
export async function unmount() {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
}

export const seeded = (id: string): DemoSchool => directorSchool(seededWorld(id, reference))!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
export async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 60; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
export const texts = () =>
  rendered()
    .root.findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
export const control = (testID: string) =>
  rendered().root.findAll((node) => node.props.testID === testID && node.props.onPress !== undefined)[0];
export const field = (testID: string) =>
  rendered().root.findAll((node) => node.props.testID === testID && node.props.onChangeText !== undefined)[0];
export const press = (testID: string) => act(() => (control(testID).props as PressableProps).onPress?.({} as never));
export const type = (testID: string, text: string) =>
  act(() => (field(testID).props as { onChangeText: (text: string) => void }).onChangeText(text));
export const disabled = (testID: string) => (control(testID).props as { disabled?: boolean }).disabled === true;
export const said = (testID = 'grant-said') => String(rendered().root.findByProps({ testID }).props.children);

type GrantWorld = Parameters<typeof DirectorateGrant>[0]['world'];

const element = (world: GrantWorld, school: DemoSchool, send: Send) => (
  <LocaleDirContext.Provider value="rtl">
    <DirectorateGrant
      world={world}
      school={school}
      reference={reference}
      kit={kit}
      send={send}
      dayText={(day) => `day ${day}`}
    />
  </LocaleDirContext.Provider>
);

/** Renders another grant page in its place, or renders it again, and settles its answers. */
export async function show(shown: ReactElement) {
  await act(() => {
    if (tree === undefined) tree = ReactTestRenderer.create(shown);
    else tree.update(shown);
  });
}

/** Renders M-Grant for a directorate's device and settles its first read. */
export async function page(world: GrantWorld, school: DemoSchool, send: Send) {
  await act(() => {
    tree = ReactTestRenderer.create(element(world, school, send));
  });
}

/** Renders the open page again for a world whose date moved. */
export async function moved(world: GrantWorld, school: DemoSchool, send: Send) {
  await act(() => rendered().update(element(world, school, send)));
}

export async function filled(fingerprint: string, school: DemoSchool) {
  await press(`grant-school-${school.id}`);
  await type('grant-label', 'مفتش اللغة العربية للمقاطعة 3');
  await type('grant-fingerprint', fingerprint);
  const chips = rendered().root.findAll((node) => {
    const { testID, onPress } = node.props as { testID?: unknown; onPress?: unknown };
    return typeof testID === 'string' && testID.startsWith('grant-class-') && onPress !== undefined;
  });
  await act(() => (chips[0].props as PressableProps).onPress?.({} as never));
}
