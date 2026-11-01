// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Exchange's export of the school's space whole (#592, R-7.11-02, answer
// 620), against the jest demo server: the file is minhajna/space-export/1
// from a demo world, naming the world, the space held and the world's date,
// with every stream's batches as the relay keeps them, unopened, named by the
// world and the date and kept through the file picker, once for two presses,
// the button waiting while the file is made and said kept; a cancelled picker
// said; a problem reading the space, a batch that does not decode among them,
// said in the world's words with nothing made, and a file not made said as
// such, both as alerts; and without the school key the button waits and says
// why. Every world, school and teacher here is made up.

import { directorSchool, fromBase64Url, latestHeld, seedNationalWorld, SPACE_EXPORT } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { server, setting } from '../jest/timetable-send';
import type { Send } from '../src/demo/world-session';
import { PUBLIC_KEY_BYTES } from '../src/director/school-desk';
import { SchoolExchange } from '../src/director/SchoolExchange';
import files from '../src/native/NativeMinhajnaFiles';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const result = readReference(bundledReference);
if (!result.ok) throw new Error('The bundled reference does not read');
const read = result;
const words = ar.demo.exchange;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const said = () =>
  [(tree!.root.findAllByProps({ testID: 'exchange-export-said' })[0].findByType(Text).props as TextProps).children]
    .flat()
    .map(String)
    .join('');
const alert = () => tree!.root.findAllByProps({ testID: 'exchange-export-said' })[0].props.accessibilityRole as unknown;
const button = () =>
  tree!.root.findAll(
    (node) => node.props.testID === 'exchange-export-button' && typeof node.props.onPress === 'function',
  )[0];

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}

async function render(world: Parameters<typeof SchoolExchange>[0]['world'], send: Send = server.send) {
  const { zones = [], workingDays } = read.profile;
  const school = directorSchool(seedNationalWorld(world.world, zones, workingDays, read.packs))!;
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolExchange world={world} school={school} send={send} dayText={(day) => `day ${day}`} />
      </LocaleDirContext.Provider>,
    );
  });
}

test('exports the space whole, sealed as the relay keeps it, once for two presses', async () => {
  const { id, here } = await setting();
  const makeText = jest.spyOn(files, 'makeText');
  const saveFile = jest.spyOn(files, 'saveFile');
  [makeText, saveFile].forEach((one) => one.mockClear());
  let open = () => undefined as void;
  const held: Send = (request) =>
    request.path.includes('/batches')
      ? new Promise((resolve) => (open = () => void server.send(request).then(resolve)))
      : server.send(request);
  await render(here, held);
  await act(() => {
    const press = (button().props as PressableProps).onPress;
    press?.({} as never);
    press?.({} as never);
  });
  expect([said(), button().props.disabled]).toEqual([words.export.making, true]);
  await act(open);
  expect([makeText.mock.calls.length, saveFile.mock.calls.length, said()]).toEqual([1, 1, words.export.saved]);
  const [text, name, password] = makeText.mock.calls[0];
  const space = latestHeld(here.book.entries, PUBLIC_KEY_BYTES)!.school;
  const file = JSON.parse(text) as {
    format: string;
    demo: boolean;
    world: string;
    school: string;
    exported: string;
    streams: { stream: string; batches: { number: number; bytes: string }[] }[];
  };
  expect([file.format, file.demo, file.world, file.school, file.exported, name, password]).toEqual([
    SPACE_EXPORT,
    true,
    id,
    space,
    here.date,
    `minhajna-space-${id}-${here.date}.json`,
    '',
  ]);
  const kept = await spaceBatches(id, space, server.send);
  expect(file.streams.map((one) => [one.stream, one.batches.length])).toEqual(
    [...kept].map(([stream, batches]) => [stream, batches.length]),
  );
  expect(file.streams.length).toBeGreaterThan(0);
  const first = file.streams[0].batches[0];
  expect([first.number, fromBase64Url(first.bytes)]).toEqual([
    kept.get(file.streams[0].stream)![0].number,
    kept.get(file.streams[0].stream)![0].bytes,
  ]);
});

test('a cancelled picker is said, and a problem reading the space or making the file too', async () => {
  const { here } = await setting();
  jest.spyOn(files, 'saveFile').mockResolvedValueOnce(false);
  await render(here);
  await act(() => (button().props as PressableProps).onPress?.({} as never));
  expect(said()).toBe(words.export.cancelled);
  await ReactTestRenderer.act(() => tree?.unmount());
  const makeText = jest.spyOn(files, 'makeText');
  makeText.mockClear();
  const down: Send = (request) =>
    request.path.includes('/batches')
      ? Promise.resolve({ status: 503, body: null, retryAfter: null })
      : server.send(request);
  await render(here, down);
  await act(() => (button().props as PressableProps).onPress?.({} as never));
  expect([said(), alert(), makeText.mock.calls.length]).toEqual([ar.demo.problem.other, 'alert', 0]);
  await ReactTestRenderer.act(() => tree?.unmount());
  const garbled: Send = (request) =>
    server.send(request).then((answer) => {
      const body = answer.body as { batches?: { bytes: string }[] } | null;
      if (!request.path.includes('/batches') || !body?.batches?.length) return answer;
      return { ...answer, body: { ...body, batches: body.batches.map((one) => ({ ...one, bytes: '*not base64*' })) } };
    });
  await render(here, garbled);
  await act(() => (button().props as PressableProps).onPress?.({} as never));
  expect([said(), makeText.mock.calls.length]).toEqual([ar.demo.problem.other, 0]);
  await ReactTestRenderer.act(() => tree?.unmount());
  makeText.mockRejectedValueOnce(new Error('made-up disk full'));
  await render(here);
  await act(() => (button().props as PressableProps).onPress?.({} as never));
  expect([said(), alert()]).toEqual([words.export.failed, 'alert']);
});

test('without the school key on this device, the export waits and says why', async () => {
  const { id, here } = await setting();
  await render({ world: id, date: here.date, book: await openRecordBook(new FakeStorage().asSpec()) });
  const node = tree!.root.findAllByProps({ testID: 'exchange-export-button' })[0];
  expect([node.props.disabled, said()]).toEqual([true, words.export.noKey]);
});
