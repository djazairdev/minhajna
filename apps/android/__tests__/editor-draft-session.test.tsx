// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A replaced authoring context cannot stay busy on an old request, or
// accept its late response. The relay and every source are invented.

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

test('an immutable reference identity cannot be created as a new world draft', async () => {
  const f = await packService();
  f.server.seen.length = 0;
  await show(<Probe editor={f.editor} send={f.server.send} reserved />);
  await drain();
  await act(async () => {
    expect(await desk.save(source, 0)).toBeNull();
  });
  expect(desk.error).toBe(true);
  expect(f.server.seen.some((one) => one.method === 'POST')).toBe(false);
});
