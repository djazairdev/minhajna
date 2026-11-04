// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's threshold pages rendered for their tests (#601, answer 633): a
// page or any element in its place, read right to left, and again in place, a
// way to settle its readings, its words, controls, alerts and hidden live
// region, a plan item quoted as the pages quote it, the props a page takes, and
// unmounting it again.

import type { Day, SchoolJoined } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';
import { server } from './timetable-send';
import { reference } from './world-calendar';
import { nodeKit as kit } from './world-server';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

/** Unmounts the page rendered last, if any. */
export async function unmount() {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Runs a step, then lets the page's readings settle. */
export async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 80; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
/** Every text on the page, its parts joined. */
export const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
/** The labelled controls with a test ID, in order. */
export const controls = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && node.props.label !== undefined);
/** Presses the control with a test ID, the first or the one at a place. */
export const press = (testID: string, at = 0) =>
  act(() => (controls(testID)[at].props as PressableProps).onPress?.({} as never));
/** Renders a page right to left. */
export const show = (shown: ReactElement) =>
  act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value="rtl">{shown}</LocaleDirContext.Provider>);
  });
/** Renders the page again in place, right to left, as when its props change. */
export const update = (shown: ReactElement) =>
  act(() => tree!.update(<LocaleDirContext.Provider value="rtl">{shown}</LocaleDirContext.Provider>));
/** How a part of the page with a test ID is said as it changes. */
export const liveRegion = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID)[0].props.accessibilityLiveRegion as unknown;
/** What the page's alerts say. */
export const alerts = () =>
  tree!.root
    .findAll((node) => node.props.accessibilityRole === 'alert' && node.type === Text)
    .map((node) => (node.props as TextProps).children);
/** What the page's hidden live region says. */
export const said = (testID: string) =>
  tree!.root
    .findAll((node) => node.props.testID === `${testID}-said` && node.type === Text)
    .map((node) => (node.props as TextProps).children);
/** A plan item's title, quoted as the pages quote it in Arabic. */
export const quoted = (title: string) => ar.demo.threshold.quoted.replace('{{item}}', isolate(title));

/** A page's props for a phone joined in a world on a date, its days written `day …`. */
export const props = (world: { world: string; date: Day }, join: SchoolJoined) => ({
  world,
  date: world.date,
  join,
  kit,
  send: server.send,
  dayText: (day: Day) => `day ${day}`,
  reference,
  onClose: () => undefined,
});
