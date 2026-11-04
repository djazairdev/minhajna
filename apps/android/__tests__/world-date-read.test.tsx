// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every device of a demo world reads whether its date moved (#630, answer 724),
// against made-up answers: a device reads the date once a minute; a reading
// that fails, or an answer that is not a date, is passed over and the next
// tries again; a date no later than the one shown offers nothing; an answer
// still on its way when the world is left is dropped, and no reading goes after
// that. Every world is made up.

import { useState } from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { DATE_READ_MS, readWorldDate, useMovedDate, useWorldDateRead } from '../src/demo/world-date-read';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  jest.useRealTimers();
});

const REAL = ['Date', 'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'setTimeout'] as const;
const settle = () => ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const tick = async () => {
  jest.advanceTimersByTime(DATE_READ_MS);
  await settle();
};

function Dated({ world, send }: { readonly world: string | null; readonly send: Send }) {
  const [shown, setShown] = useState<string[]>([]);
  useWorldDateRead(world, (_id, date) => setShown((before) => [...before, date]), send);
  return <Text testID="dates">{shown.join(' ')}</Text>;
}

function Moved({ shown, send }: { readonly shown: Parameters<typeof useMovedDate>[0]; readonly send: Send }) {
  return <Text testID="dates">{useMovedDate(shown, send) ?? 'none'}</Text>;
}

const dates = () => String(tree!.root.findByProps({ testID: 'dates' }).props.children);
const answering = (...answers: readonly (() => Promise<unknown>)[]) => {
  const left = [...answers];
  return jest.fn(() => left.shift()!()) as unknown as jest.MockedFunction<Send>;
};
const dated =
  (date: unknown, status = 200) =>
  () =>
    Promise.resolve({ status, body: { date }, retryAfter: null });

async function mount(element: React.ReactElement) {
  jest.useFakeTimers({ doNotFake: [...REAL, 'clearTimeout', 'clearImmediate'] });
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
}

describe('reading the world’s date', () => {
  it('reads only the world’s own path, and answers only a day', async () => {
    const send = answering(dated('2027-02-18'), dated('someday'), dated('2027-02-18', 500));
    expect(await readWorldDate('K1MT1', send)).toBe('2027-02-18');
    expect(send).toHaveBeenCalledWith({ method: 'GET', path: '/worlds/K1MT1/date' });
    expect(await readWorldDate('K1MT1', send)).toBeNull();
    expect(await readWorldDate('K1MT1', send)).toBeNull();
  });

  it('offers only a later date of the world in hand', async () => {
    const send = answering(dated('2027-02-18'), dated('2027-03-02'), dated('2027-02-18'));
    await mount(<Moved shown={{ world: 'K1MT1', date: '2027-02-18' as never }} send={send} />);
    await tick();
    expect(dates()).toBe('none');
    await tick();
    expect(dates()).toBe('2027-03-02');
    await ReactTestRenderer.act(() =>
      tree!.update(<Moved shown={{ world: 'K1MT1', date: '2027-03-02' as never }} send={send} />),
    );
    expect(dates()).toBe('none');
    await tick();
    expect(dates()).toBe('none');
    await ReactTestRenderer.act(() =>
      tree!.update(<Moved shown={{ world: 'K1MT2', date: '2027-01-01' as never }} send={send} />),
    );
    expect(dates()).toBe('none');
  });

  it('reads once a minute, and a render does not start the minute again', async () => {
    expect(DATE_READ_MS).toBe(60_000);
    const send = answering(dated('2027-03-02'));
    await mount(<Dated world="K1MT1" send={send} />);
    jest.advanceTimersByTime(DATE_READ_MS / 2);
    await ReactTestRenderer.act(() => tree!.update(<Dated world="K1MT1" send={send} />));
    expect(send).not.toHaveBeenCalled();
    jest.advanceTimersByTime(DATE_READ_MS / 2);
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reads each minute, passing over a failure and an answer that is no date', async () => {
    const send = answering(() => Promise.reject(new Error('offline')), dated('someday'), dated('2027-03-02'));
    await mount(<Dated world="K1MT1" send={send} />);
    await settle();
    expect(send).not.toHaveBeenCalled();
    await tick();
    await tick();
    expect(dates()).toBe('');
    await tick();
    expect(dates()).toBe('2027-03-02');
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('drops an answer on its way when the world is left, and reads no more', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const send = answering(() => new Promise((resolve) => (answer = resolve)));
    await mount(<Dated world="K1MT1" send={send} />);
    await tick();
    expect(send).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => tree!.update(<Dated world={null} send={send} />));
    answer({ status: 200, body: { date: '2027-03-02' }, retryAfter: null });
    await tick();
    expect(dates()).toBe('');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
