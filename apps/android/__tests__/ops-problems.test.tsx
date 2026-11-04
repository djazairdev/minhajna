// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' problem reports (#619, answer 656): a report taken in the
// server's shape and refused otherwise, a bidi control, an isolate, a lone
// surrogate or a note too long among them, a note of 1,000 characters taken;
// the list read through the world for its own path; marking one fixed said as
// erased and logged, or as no longer in the world, and a world that is gone,
// read or marked, said as erased, while a path the server does not know is a
// problem; on the page, each report under its part with its day, version, the
// start of its ID and its note, each line isolated, the world having none said
// so, marking fixed asked, kept on asking to keep it, and taken off the page
// once marked, said politely, focus moved to the next report's button each
// time, or to what was said once none is left; a problem marking it said as an
// alert with the report kept, and cleared on keeping it; a problem reading
// shown with a way to read again; and only the operator's workspace opening the
// page. Every world and report here is made up.

import type { Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import type { Send } from '../src/demo/world-session';
import { markFixed, opsProblem, readProblems } from '../src/operators/ops-problems';
import { OpsProblems } from '../src/operators/OpsProblems';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ops.problems;
const FIRST = '0123456789abcdef'.repeat(2);
const SECOND = 'fedcba9876543210'.repeat(2);
const NO_REPORT = { statusCode: 404, message: 'the world has no such report, or the token is not its own' };
const NO_WORLD = { statusCode: 404, message: 'no world has this id and pass' };
const report = (id: string, note: string) => ({ id, part: 'roll', note, version: '0.7.0', received: '2026-12-02' });
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
const answer = (body: unknown, status = 200) => Promise.resolve({ status, body, retryAfter: null });

/** The test IDs of the hosts focused from now on. */
function focusing(): string[] {
  const [host] = tree!.root.findAll(
    (node) => typeof (node.instance as { focus?: unknown } | null)?.focus === 'function',
  );
  const focused: string[] = [];
  jest
    .spyOn(Object.getPrototypeOf(host.instance) as { focus: () => void }, 'focus')
    .mockImplementation(function (this: { props: { testID?: string } }) {
      focused.push(String(this.props.testID));
    });
  return focused;
}

async function render(send: Send) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <OpsProblems world={{ world: 'AAAAA' }} send={send} dayText={(day: Day) => `day ${day}`} />
      </LocaleDirContext.Provider>,
    );
  });
}

test('takes a report in the server’s shape, and refuses any other', () => {
  const one = report(FIRST, 'The roll does not save.\nTwice.');
  expect(opsProblem(one)).toEqual(one);
  const bidi = String.fromCharCode(0x202e);
  const isolating = String.fromCharCode(0x2066);
  const surrogate = String.fromCharCode(0xd800);
  const astral = String.fromCodePoint(0x1f4da);
  const full = { ...one, note: `${astral}${'x'.repeat(999)}` };
  expect(opsProblem(full)).toEqual(full);
  for (const odd of [
    { ...one, note: `${astral}${'x'.repeat(1000)}` },
    { ...one, note: `a ${isolating}b` },
    { ...one, note: `a ${surrogate}b` },
    null,
    [],
    { ...one, id: FIRST.toUpperCase() },
    { ...one, part: 'kitchen' },
    { ...one, note: '   ' },
    { ...one, note: 'x'.repeat(1001) },
    { ...one, note: `left ${bidi}right` },
    { ...one, note: 'bell\u0007' },
    { ...one, version: 'v 1' },
    { ...one, received: '2026-02-30' },
  ])
    expect(opsProblem(odd)).toBeNull();
});

test('reads the list and marks a report fixed through the world for their own paths', async () => {
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>(() => answer({ problems: [report(FIRST, 'A')] }));
  await expect(readProblems('AAAAA', send)).resolves.toHaveLength(1);
  expect(send).toHaveBeenCalledWith({ method: 'GET', path: '/worlds/AAAAA/problems' });
  await expect(readProblems('AAAAA', () => answer({ problems: [{ id: FIRST }] }))).rejects.toMatchObject({
    code: 'E_WORLD_SERVER',
  });
  send.mockImplementation(() => answer({ id: FIRST }));
  await expect(markFixed('AAAAA', FIRST, send)).resolves.toBe('fixed');
  expect(send).toHaveBeenLastCalledWith({ method: 'POST', path: `/worlds/AAAAA/problems/${FIRST}/fixed` });
  await expect(markFixed('AAAAA', FIRST, () => answer(NO_REPORT, 404))).resolves.toBe('gone');
  await expect(markFixed('AAAAA', FIRST, () => answer(NO_WORLD, 404))).rejects.toMatchObject({
    code: 'E_NO_SUCH_WORLD',
  });
  await expect(readProblems('AAAAA', () => answer(NO_WORLD, 404))).rejects.toMatchObject({
    code: 'E_NO_SUCH_WORLD',
  });
  await expect(markFixed('AAAAA', FIRST, () => answer(null, 500))).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  await expect(markFixed('AAAAA', FIRST, () => answer({ message: 'Cannot POST' }, 404))).rejects.toMatchObject({
    code: 'E_WORLD_SERVER',
  });
  await expect(markFixed('AAAAA', FIRST, () => answer(null, 429))).rejects.toMatchObject({ code: 'E_WORLD_BUSY' });
});

test('shows each report under its part, asks before marking it fixed, and takes it off once marked', async () => {
  const listed = [
    report(FIRST, 'The roll does not save'),
    { ...report(SECOND, 'Marks vanish\nin 4M3'), part: 'marks' },
  ];
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>((request) =>
    request.method === 'GET' ? answer({ problems: listed }) : answer({ id: FIRST }),
  );
  await render(send);
  const facts = (id: string) =>
    words.facts
      .replace('{{day}}', 'day 2026-12-02')
      .replace('{{version}}', isolate('0.7.0'))
      .replace('{{id}}', isolate(id.slice(0, 8)));
  expect(texts(`ops-problem-${FIRST}`).slice(0, 3)).toEqual([
    ar.report.parts.roll,
    facts(FIRST),
    isolate('The roll does not save'),
  ]);
  expect(texts(`ops-problem-${SECOND}`)[2]).toBe(`${isolate('Marks vanish')}\n${isolate('in 4M3')}`);
  expect(texts('ops-problems-list')[0]).toBe(words.reports);
  await press(`ops-problem-${FIRST}-fix`);
  expect(texts(`ops-problem-${FIRST}`)).toContain(words.ask);
  await press(`ops-problem-${FIRST}-keep`);
  expect(texts(`ops-problem-${FIRST}`)).not.toContain(words.ask);
  expect(send).toHaveBeenCalledTimes(1);
  const focused = focusing();
  await press(`ops-problem-${FIRST}-fix`);
  await press(`ops-problem-${FIRST}-yes`);
  expect(send).toHaveBeenLastCalledWith({ method: 'POST', path: `/worlds/AAAAA/problems/${FIRST}/fixed` });
  expect(shown(`ops-problem-${FIRST}`)).toBe(false);
  expect(shown(`ops-problem-${SECOND}`)).toBe(true);
  expect(texts('ops-problems-done')).toEqual([words.fixed.replace('{{id}}', isolate('01234567'))]);
  expect(focused).toEqual([`ops-problem-${SECOND}-fix`]);
  send.mockImplementation(() => answer(NO_REPORT, 404));
  await press(`ops-problem-${SECOND}-fix`);
  await press(`ops-problem-${SECOND}-yes`);
  expect(shown(`ops-problem-${SECOND}`)).toBe(false);
  expect(texts('ops-problems-done')).toEqual([words.gone.replace('{{id}}', isolate('fedcba98'))]);
  expect(texts('ops-problems-list')).toEqual([words.reports, words.none]);
  expect(focused).toEqual([`ops-problem-${SECOND}-fix`, 'ops-problems-said']);
});

test('moves focus to the next report each time, even the same one again', async () => {
  const THIRD = '00112233445566778899aabbccddeeff';
  const listed = [report(FIRST, 'A'), report(SECOND, 'B'), report(THIRD, 'C')];
  await render((request) => (request.method === 'GET' ? answer({ problems: listed }) : answer({ id: FIRST })));
  const focused = focusing();
  for (const id of [FIRST, THIRD]) {
    await press(`ops-problem-${id}-fix`);
    await press(`ops-problem-${id}-yes`);
  }
  expect(focused).toEqual([`ops-problem-${SECOND}-fix`, `ops-problem-${SECOND}-fix`]);
});

test('says a problem marking a report fixed as an alert, keeps the report, and clears it on keeping', async () => {
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>((request) =>
    request.method === 'GET' ? answer({ problems: [report(FIRST, 'A')] }) : answer(null, 500),
  );
  await render(send);
  await press(`ops-problem-${FIRST}-fix`);
  await press(`ops-problem-${FIRST}-yes`);
  const alert = () =>
    tree!.root.findAll((node) => node.props.testID === 'ops-problems-problem' && 'style' in node.props);
  expect(alert()[0].props).toMatchObject({ accessibilityRole: 'alert', children: ar.demo.problem.other });
  expect(shown(`ops-problem-${FIRST}`)).toBe(true);
  expect(texts(`ops-problem-${FIRST}`)).toContain(words.ask);
  send.mockImplementation(() => answer(NO_WORLD, 404));
  await press(`ops-problem-${FIRST}-yes`);
  expect(alert()[0].props).toMatchObject({ children: ar.demo.problem.none });
  await press(`ops-problem-${FIRST}-keep`);
  expect(alert()).toEqual([]);
  expect(texts(`ops-problem-${FIRST}`)).not.toContain(words.ask);
});

test('shows a problem reading the reports with a way to read again', async () => {
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>(() => answer(null, 500));
  await render(send);
  expect(texts('ops-problems')).toContain(ar.demo.problem.other);
  send.mockImplementation(() => answer({ problems: [] }));
  await press('ops-problems-again');
  expect(texts('ops-problems-list')).toEqual([words.reports, words.none]);
});

test('says when the world has no report', async () => {
  await render(() => answer({ problems: [] }));
  expect(texts('ops-problems-list')).toEqual([words.reports, words.none]);
});

test('only the operator’s workspace opens the page, whose words read in every language', () => {
  const props = { open: { world: 'AAAAA' }, dayText: String } as unknown as WorkspacePagesProps;
  expect(workspacePage('operator', 'problems', props)?.type).toBe(OpsProblems);
  for (const role of ['ministry', 'directorate', 'director', 'preparer', 'curator', 'observatory'] as const)
    expect(workspacePage(role, 'problems', props)).toBeNull();
  const places = (value: object) =>
    Object.entries(value).map(([key, one]) => [key, (String(one).match(/\{\{\w+\}\}/gu) ?? []).sort()]);
  for (const one of [en, fr]) expect(places(one.demo.ops.problems)).toEqual(places(words));
});
