// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's comparison and the sendings due (#623, answer 700), against a
// made-up demo server: with taking part on, what is due goes before the term's
// collection ends, even while still going; one that fails stops there, the term
// staying open, until it goes; a refusal with the term open is a failure, and a
// sending after it ended says it came too late and is not sent again. Every
// world is made up.

import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  all,
  asked,
  harness,
  host,
  openInsights,
  openLink,
  press,
  reply,
  server,
  settle,
  takePart,
  turns,
} from '../jest/compare-world';
import { catalogues } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

test('with taking part on, what is due goes before the term’s collection ends, even while still going', async () => {
  await openInsights();
  let release = () => undefined as void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  harness.override = (request) => (request.method === 'PUT' ? held.then(() => server.send(request)) : null);
  await takePart();
  await ReactTestRenderer.act(async () => {
    (harness.tree!.root.findAllByProps({ testID: openLink() })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns(10);
  expect(server.seen.filter((one) => one.path.endsWith('/closed'))).toEqual([]);
  release();
  await turns();
  const order = asked().map((one) => `${one.method} ${one.path.split('/insights')[1].split('?')[0]}`);
  expect(order.indexOf('PUT /sendings')).toBeGreaterThanOrEqual(0);
  expect(order.lastIndexOf('PUT /sendings')).toBeLessThan(order.indexOf('POST /closed'));
  expect(host('insights-compare-here')).toHaveLength(1);
});

test('a due sending that fails stops there, the term staying open, until it goes', async () => {
  await openInsights();
  harness.override = (request) => (request.method === 'PUT' ? reply(500) : null);
  await takePart();
  await press(openLink());
  expect(host('insights-compare-problem')).toHaveLength(1);
  expect(server.seen.filter((one) => one.path.endsWith('/closed'))).toEqual([]);
  harness.override = null;
  await press('insights-compare-again');
  expect(host('insights-compare-here')).toHaveLength(1);
  expect(server.seen.filter((one) => one.method === 'PUT').length).toBeGreaterThan(0);
});

test('a refusal with the term still open is a failure, not late', async () => {
  await openInsights();
  harness.override = (request) => (request.method === 'PUT' ? reply(409) : null);
  await takePart();
  expect(host('insights-sending-failed')).toHaveLength(1);
  expect(host('insights-sending-late')).toHaveLength(0);
});

test('a sending for a term whose collection ended says it came too late, and is not sent again', async () => {
  await openInsights();
  await press(openLink());
  await press('insights-compare-back');
  await takePart();
  expect(host('insights-sending-late')).toHaveLength(1);
  expect(host('insights-sending-failed')).toHaveLength(0);
  expect(all()).toContain(catalogues.en.demo.insights.sending.late);
  const puts = () => server.seen.filter((one) => one.method === 'PUT').length;
  const sent = puts();
  expect(sent).toBeGreaterThan(0);
  await press('insights-back');
  await press('world-move-date');
  await press('world-insights-open');
  expect(puts()).toBe(sent);
  expect(host('insights-sending-late')).toHaveLength(1);
});
