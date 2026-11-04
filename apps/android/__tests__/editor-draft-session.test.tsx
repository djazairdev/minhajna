// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A replaced authoring context cannot stay busy on an old request, or
// accept its late response. The relay and every source are invented.

import { addDays } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { packService } from '../jest/pack-release';
import { rendered, show, source, unmount } from '../jest/editor-form';
import type { Send } from '../src/demo/world-session';
import type { PackEditor } from '../src/editor/pack-release-session';
import { usePackDrafts } from '../src/editor/usePackDrafts';
import { leaveWorldNetwork } from '../src/network/world-network';

let desk!: ReturnType<typeof usePackDrafts>;
function Probe({ editor, send, reserved = false }: { editor: PackEditor; send: Send; reserved?: boolean }) {
  const current = usePackDrafts(editor, reserved ? [source] : [], send);
  useEffect(() => {
    desk = current;
  }, [current]);
  return null;
}
async function drain() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise<void>((done) => setImmediate(done));
  });
}
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

test('a fresh context reads the accepted revision, and an old response cannot leave it busy', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack: source });
  let release!: () => void;
  const send: Send = async (request) => {
    const reply = await f.server.send(request);
    if (request.method === 'POST' && request.path.endsWith('/batches'))
      await new Promise<void>((done) => {
        release = done;
      });
    return reply;
  };
  await show(<Probe editor={f.editor} send={send} />);
  await drain();
  let writing!: ReturnType<typeof desk.save>;
  await act(() => {
    writing = desk.save(source, 1);
  });
  await drain();
  expect(desk.busy).toBe(true);
  await act(() => rendered().update(<Probe editor={{ ...f.editor, profile: { ...f.editor.profile } }} send={send} />));
  await drain();
  expect(desk.busy).toBe(false);
  expect(desk.ready).toBe(true);
  expect([...desk.records.values()][0].revision).toBe(2);
  await act(async () => {
    release();
    expect(await writing).toBeNull();
  });
  expect(desk.busy).toBe(false);
  expect([...desk.records.values()][0].revision).toBe(2);
});

test('a write still counts when the day moves and a read starts while it is on its way', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack: source });
  let release!: () => void;
  const send: Send = async (request) => {
    const reply = await f.server.send(request);
    if (request.method === 'POST' && request.path.endsWith('/batches'))
      await new Promise<void>((done) => {
        release = done;
      });
    return reply;
  };
  await show(<Probe editor={f.editor} send={send} />);
  await drain();
  let writing!: ReturnType<typeof desk.save>;
  await act(() => {
    writing = desk.save(source, first.revision);
  });
  await drain();
  const date = addDays(f.world.date, 1);
  f.server.worlds.get(f.world.world)!.date = date;
  const later = <Probe editor={{ ...f.editor, world: { ...f.world, date } }} send={send} />;
  await act(() => rendered().update(<LocaleDirContext.Provider value="rtl">{later}</LocaleDirContext.Provider>));
  await drain();
  expect(desk.busy).toBe(true);
  await act(async () => {
    release();
    expect((await writing)?.revision).toBe(2);
  });
  expect(desk.busy).toBe(false);
});

test('a read begun before a write landed cannot leave its older records behind', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack: source });
  let landWrite!: () => void;
  let endRead = () => undefined as void;
  let holdRead = false;
  const send: Send = async (request) => {
    if (request.method === 'POST' && request.path.endsWith('/batches'))
      await new Promise<void>((done) => {
        landWrite = done;
      });
    const reply = await f.server.send(request);
    if (holdRead && request.method === 'GET' && request.path.includes('/spaces/')) {
      holdRead = false;
      await new Promise<void>((done) => {
        endRead = done;
      });
    }
    return reply;
  };
  await show(<Probe editor={f.editor} send={send} />);
  await drain();
  let writing!: ReturnType<typeof desk.save>;
  await act(() => {
    writing = desk.save(source, first.revision);
  });
  await drain();
  holdRead = true;
  const date = addDays(f.world.date, 1);
  f.server.worlds.get(f.world.world)!.date = date;
  const later = <Probe editor={{ ...f.editor, world: { ...f.world, date } }} send={send} />;
  await act(() => rendered().update(<LocaleDirContext.Provider value="rtl">{later}</LocaleDirContext.Provider>));
  await drain();
  await act(async () => {
    landWrite();
    await writing;
  });
  await drain();
  await act(async () => {
    endRead();
    await Promise.resolve();
  });
  await drain();
  expect([...desk.records.values()][0].revision).toBe(2);
  expect(desk.problem).toBeNull();
  expect(desk.ready).toBe(true);
});

test.each([
  ['clears a read error', 'fail', 'saveError', null],
  ['leaves an erased world', 'gone', 'worldErased', 'worldErased'],
] as const)('a write that lands %s from a read during it', async (_, how, during, after) => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack: source });
  let landWrite!: () => void;
  let endRead!: () => void;
  let reads: 'fine' | 'fail' | 'gone' | 'hold' = 'fine';
  const send: Send = async (request) => {
    if (request.method === 'POST' && request.path.endsWith('/batches'))
      await new Promise<void>((done) => {
        landWrite = done;
      });
    else if (request.path.endsWith('/date') && reads === 'fail') throw new Error('Made-up offline');
    else if (request.path.endsWith('/date') && reads === 'gone') return { status: 404, body: null, retryAfter: null };
    else if (request.path.endsWith('/date') && reads === 'hold')
      await new Promise<void>((done) => {
        endRead = done;
      });
    return f.server.send(request);
  };
  await show(<Probe editor={f.editor} send={send} />);
  await drain();
  let writing!: ReturnType<typeof desk.save>;
  await act(() => {
    writing = desk.save(source, first.revision);
  });
  await drain();
  reads = how;
  const date = addDays(f.world.date, 1);
  f.server.worlds.get(f.world.world)!.date = date;
  const later = <Probe editor={{ ...f.editor, world: { ...f.world, date } }} send={send} />;
  await act(() => rendered().update(<LocaleDirContext.Provider value="rtl">{later}</LocaleDirContext.Provider>));
  await drain();
  expect(desk.problem).toBe(during);
  reads = 'hold';
  await act(async () => {
    landWrite();
    await writing;
  });
  await drain();
  expect(desk.problem).toBe(after);
  expect(desk.ready).toBe(false);
  reads = 'fine';
  await act(async () => {
    endRead();
    await Promise.resolve();
  });
  await drain();
  expect(desk.ready).toBe(true);
});

test('a failed read in a replaced context cannot leave an old write holding the desk busy', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack: source });
  const send: Send = async (request) => {
    if (request.method === 'POST' && request.path.endsWith('/batches')) await new Promise<void>(() => undefined);
    return f.server.send(request);
  };
  await show(<Probe editor={f.editor} send={send} />);
  await drain();
  await act(() => {
    void desk.save(source, first.revision);
  });
  await drain();
  expect(desk.busy).toBe(true);
  const failing: Send = () => Promise.reject(new Error('Made-up offline'));
  const other = <Probe editor={{ ...f.editor, profile: { ...f.editor.profile } }} send={failing} />;
  await act(() => rendered().update(<LocaleDirContext.Provider value="rtl">{other}</LocaleDirContext.Provider>));
  await drain();
  expect(desk.busy).toBe(false);
  expect(desk.problem).toBe('saveError');
});

test('saving before a read has succeeded reads again instead of doing nothing', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack: source });
  let online = false;
  const send: Send = (request) => (online ? f.server.send(request) : Promise.reject(new Error('Made-up offline')));
  await show(<Probe editor={f.editor} send={send} />);
  await drain();
  expect(desk.ready).toBe(false);
  online = true;
  await act(async () => {
    expect(await desk.save(source, 1)).toBeNull();
  });
  await drain();
  expect(desk.ready).toBe(true);
  expect(desk.records.size).toBe(1);
});

test('an immutable reference identity cannot be created as a new world draft', async () => {
  const f = await packService();
  f.server.seen.length = 0;
  await show(<Probe editor={f.editor} send={f.server.send} reserved />);
  await drain();
  await act(async () => {
    expect(await desk.save(source, 0)).toBeNull();
  });
  expect(desk.problem).toBe('saveError');
  expect(f.server.seen.some((one) => one.method === 'POST')).toBe(false);
});

test('an oversized draft has a size message and can be shortened without reloading', async () => {
  const f = await packService();
  await show(<Probe editor={f.editor} send={f.server.send} />);
  await drain();
  const large = { ...source, provenance: { ...source.provenance, issuer: 'x'.repeat(300_000) } };
  await act(async () => {
    expect(await desk.save(large, 0)).toBeNull();
  });
  expect(desk.problem).toBe('packSize');
  expect(desk.ready).toBe(true);
});
