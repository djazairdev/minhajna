// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A change made from the state once every earlier change is saved (#237):
// it sees the change sent just before it, and gives nothing to save when it
// returns null. Made-up records only.

import type { State } from '@minhajna/core';
import { mount, press, unmount } from '../jest/note-screens';
import { openTestData } from '../jest/app-data';
import { Button } from '../src/components/Button';
import { useAppData } from '../src/storage/AppData';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

afterEach(unmount);

const seen: string[] = [];

function Probe() {
  const { record, recordFrom } = useAppData();
  const name = (state: State) => state.personal?.name ?? 'none';
  return (
    <Button
      testID="probe"
      label="Probe"
      onPress={() => {
        record({ kind: 'teacher.personal.set', personal: { name: 'أستاذة مختلقة' } });
        recordFrom((state) => {
          seen.push(name(state));
          return { kind: 'teacher.personal.set', personal: { name: `${name(state)} 2` } };
        });
        recordFrom((state) => {
          seen.push(name(state));
          return null;
        });
      }}
    />
  );
}

test('makes a change from the state after every earlier change, and saves nothing for null', async () => {
  const data = await openTestData();
  await mount(data, <Probe />);
  const before = data.book.entries.length;
  await press('probe');
  expect(seen).toEqual(['أستاذة مختلقة', 'أستاذة مختلقة 2']);
  expect(data.book.entries.length).toBe(before + 2);
});
