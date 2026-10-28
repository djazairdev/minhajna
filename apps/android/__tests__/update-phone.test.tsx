// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A phone takes no PC web app updates (#250, answers 516 and 517): it has
// no update module, so Today's device cards hold the backup alone, and the
// update card is never drawn there, nor the APK hashed for it. Made-up
// records only.

import { DAY, mount, root, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import native from '../src/native/NativeMinhajnaBuild';
import { takesUpdates } from '../src/settings/update-offer';
import { TodayDeviceCards } from '../src/today/TodayBackup';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await unmount();
});

test('a phone has no update module, so Today draws no update card and reads no build facts for it', async () => {
  expect(takesUpdates).toBe(false);
  const describe = jest.spyOn(native, 'describe');
  describe.mockClear();
  await mount(await withPupils(), <TodayDeviceCards day={DAY} onSheet={jest.fn()} />);
  expect(root().findAll((node) => String(node.props.testID ?? '').startsWith('today-app-update'))).toHaveLength(0);
  expect(describe).not.toHaveBeenCalled();
});
