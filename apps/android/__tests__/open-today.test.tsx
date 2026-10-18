// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the app opens (#183): on the welcome for a fresh install and while
// setup is left halfway, and on Today after a restart once setup was
// finished, which the history records. Made-up records only.

import ReactTestRenderer from 'react-test-renderer';
import { parseDay, type RecordEvent } from '@minhajna/core';
import App from '../App';
import { FakeStorage } from '../jest/fake-storage';
import { typePin } from '../jest/unlock';
import { openRecordBook } from '../src/storage/history';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const day = parseDay('2026-10-15');
const school: RecordEvent = {
  kind: 'school.set',
  school: { id: 'school-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
};

/** The test IDs on the first screen the app shows once its history has opened, past the lock where there is one. */
async function firstScreen(storage: FakeStorage): Promise<string[]> {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  if (storage.pin !== null) await typePin(tree!, storage.pin);
  const ids = tree!.root
    .findAll((node) => typeof node.props.testID === 'string')
    .map((node) => String(node.props.testID));
  await ReactTestRenderer.act(() => tree!.unmount());
  return ids;
}

async function recorded(storage: FakeStorage, events: readonly RecordEvent[]) {
  const book = await openRecordBook(storage.asSpec());
  await book.recordAll(day, events);
  storage.pin = '1234';
}

test('a fresh install opens on the welcome', async () => {
  const ids = await firstScreen(new FakeStorage());
  expect(ids).toContain('welcome-start');
  expect(ids).not.toContain('tab-Today');
});

test('setup left halfway opens on the welcome again', async () => {
  const storage = new FakeStorage();
  await recorded(storage, [school]);
  const ids = await firstScreen(storage);
  expect(ids).toContain('welcome-start');
  expect(ids).not.toContain('tab-Today');
});

test('a restart after setup opens on Today', async () => {
  const storage = new FakeStorage();
  await recorded(storage, [school, { kind: 'setup.finished' }]);
  const ids = await firstScreen(storage);
  expect(ids).toContain('tab-Today');
  expect(ids).not.toContain('welcome-start');
});
