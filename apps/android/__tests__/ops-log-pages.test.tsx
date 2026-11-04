// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' admin and security log pages (#619, answer 656): the admin
// log's lines under their heading, newest first as the server gives them, each
// said with its day, the server's start with the changes it applied, worlds
// erased counted in the language's plural, a report marked fixed by the start
// of its ID, a restore test by its result or the step that failed (#620), and
// an action this app does not read; nothing in the log said so; the security
// log's days, each kind with its count, read as one, the kinds this app does
// not know together only when there are any, how many days it keeps from the
// server's answer, and no day said so; reading said, a problem shown with a way
// to read again; each count read as one on a phone, while a PC's browser reads
// the label and the figure; and only the operator's workspace opening each
// page. Every world here is made up.

import type { Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import type { Send } from '../src/demo/world-session';
import { OpsConsole } from '../src/operators/OpsConsole';
import { OpsAdminLog } from '../src/operators/OpsAdminLog';
import { OpsSecurity } from '../src/operators/OpsSecurity';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ops;
const ID = '0123456789abcdef'.repeat(2);
const counts = {
  'rate-limited': 3,
  'pass-refused': 0,
  'starter-refused': 1,
  'certificate-refused': 0,
  'delivery-refused': 2,
};
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 10; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const texts = (testID: string) =>
  tree!.root
    .findAllByProps({ testID })[0]
    .findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));
const answering =
  (body: unknown, status = 200): Send =>
  () =>
    Promise.resolve({ status, body, retryAfter: null });

async function render(page: 'admin' | 'security', send: Send) {
  const Page = page === 'admin' ? OpsAdminLog : OpsSecurity;
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <Page world={{ world: 'AAAAA' }} send={send} dayText={(day: Day) => `day ${day}`} />
      </LocaleDirContext.Provider>,
    );
  });
}

test('says each admin log line with its day, newest first as the server gives them', async () => {
  const lines = [
    { day: '2026-12-04', action: 'restore.tested', detail: { ok: true } },
    { day: '2026-12-04', action: 'restore.tested', detail: { result: 'passed' } },
    { day: '2026-12-04', action: 'restore.tested', detail: { result: 'failed', step: 'room' } },
    { day: '2026-12-04', action: 'restore.tested', detail: { result: 'failed', step: 'fetch' } },
    { day: '2026-12-04', action: 'restore.tested', detail: { result: 'failed', step: 'recover' } },
    { day: '2026-12-04', action: 'restore.tested', detail: { result: 'failed', step: 'check' } },
    { day: '2026-12-03', action: 'problem.fixed', detail: { problem: ID } },
    { day: '2026-12-02', action: 'worlds.erased', detail: { count: 2 } },
    { day: '2026-12-02', action: 'worlds.erased', detail: { count: 3 } },
    { day: '2026-12-01', action: 'server.started', detail: { version: '0.1.0', migrations: ['0004_a', '0005_b'] } },
    { day: '2026-11-30', action: 'server.started', detail: { version: '0.1.0', fingerprint: 'none' } },
  ];
  await render('admin', answering({ lines }));
  const version = isolate('0.1.0');
  expect(texts('ops-admin-lines')).toEqual([
    words.admin.lines,
    words.admin.other,
    'day 2026-12-04',
    words.admin.restore.passed,
    'day 2026-12-04',
    words.admin.restore.room,
    'day 2026-12-04',
    words.admin.restore.fetch,
    'day 2026-12-04',
    words.admin.restore.recover,
    'day 2026-12-04',
    words.admin.restore.check,
    'day 2026-12-04',
    words.admin.fixed.replace('{{id}}', isolate('01234567')),
    'day 2026-12-03',
    words.admin.erased_two,
    'day 2026-12-02',
    words.admin.erased_few.replace('{{count}}', '3'),
    'day 2026-12-02',
    words.admin.startedMigrations
      .replace('{{version}}', version)
      .replace('{{migrations}}', `${isolate('0004_a')}${words.admin.joiner}${isolate('0005_b')}`),
    'day 2026-12-01',
    words.admin.started.replace('{{version}}', version),
    'day 2026-11-30',
  ]);
  expect(texts('ops-admin')).toEqual(expect.arrayContaining([words.admin.lead, words.admin.named, words.admin.kept]));
});

test('says when the admin log is empty', async () => {
  await render('admin', answering({ lines: [] }));
  expect(texts('ops-admin-lines')).toEqual([words.admin.lines, words.admin.none]);
});

test('says each security day’s counts by kind, and how many days the server keeps', async () => {
  const days = [
    { day: '2026-12-02', counts },
    { day: '2026-12-01', counts: { ...counts, newer: 4 } },
  ];
  await render('security', answering({ keptDays: 3, days }));
  expect(texts('ops-security-kept')).toEqual([words.security.kept_few.replace('{{count}}', '3')]);
  expect(texts('ops-security-2026-12-02')).toEqual([
    'day 2026-12-02',
    words.security.kind['rate-limited'],
    '3',
    words.security.kind['pass-refused'],
    '0',
    words.security.kind['starter-refused'],
    '1',
    words.security.kind['certificate-refused'],
    '0',
    words.security.kind['delivery-refused'],
    '2',
  ]);
  expect(texts('ops-security-2026-12-01').slice(-2)).toEqual([words.security.others, '4']);
  const row = tree!.root.findAll(
    (node) => node.props.testID === 'ops-security-2026-12-02-rate-limited' && 'accessibilityLabel' in node.props,
  )[0];
  expect(row.props).toMatchObject({
    accessible: true,
    accessibilityLabel: words.security.row
      .replace('{{kind}}', words.security.kind['rate-limited'])
      .replace('{{count}}', '3'),
  });
  expect(texts('ops-security')).toEqual(expect.arrayContaining([words.security.apart, words.security.never]));
  await ReactTestRenderer.act(() => tree!.unmount());
  jest.replaceProperty(Platform, 'OS', 'web');
  await render('security', answering({ keptDays: 3, days }));
  const pc = tree!.root.findAll(
    (node) => node.props.testID === 'ops-security-2026-12-02-rate-limited' && 'accessible' in node.props,
  )[0];
  expect(pc.props).toMatchObject({ accessible: false, accessibilityLabel: undefined });
  expect(shown('ops-security-none')).toBe(false);
  await ReactTestRenderer.act(() => tree!.unmount());
  await render('security', answering({ keptDays: 7, days: [] }));
  expect(texts('ops-security-none')).toEqual([words.security.none]);
});

test('says it is reading, shows a problem with a way to read again, and reads again', async () => {
  let pending: (() => void) | undefined;
  const slow: Send = () =>
    new Promise((resolve) => {
      pending = () => resolve({ status: 200, body: { lines: [] }, retryAfter: null });
    });
  await render('admin', slow);
  expect(texts('ops-admin')).toContain(words.reading);
  await act(() => pending!());
  expect(texts('ops-admin')).not.toContain(words.reading);
  await ReactTestRenderer.act(() => tree!.unmount());
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>(answering(null, 500));
  await render('security', send);
  expect(texts('ops-security')).toContain(ar.demo.problem.other);
  expect(shown('ops-security-kept')).toBe(false);
  send.mockImplementation(answering({ keptDays: 7, days: [] }));
  await press('ops-security-again');
  expect(shown('ops-security-none')).toBe(true);
  expect(texts('ops-security')).not.toContain(ar.demo.problem.other);
  expect(send).toHaveBeenCalledTimes(2);
});

test('the operator’s workspace opens the map, the admin log and the security log, and no other role does', () => {
  const props = { open: { world: 'AAAAA' }, dayText: String } as unknown as WorkspacePagesProps;
  expect(workspacePage('operator', 'map', props)?.type).toBe(OpsConsole);
  expect(workspacePage('operator', 'admin', props)?.type).toBe(OpsAdminLog);
  expect(workspacePage('operator', 'security', props)?.type).toBe(OpsSecurity);
  for (const role of ['ministry', 'directorate', 'director', 'preparer', 'curator', 'observatory'] as const)
    for (const page of ['admin', 'security'] as const) expect(workspacePage(role, page, props)).toBeNull();
});
