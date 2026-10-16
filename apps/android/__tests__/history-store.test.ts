// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The real JavaScript adapter runs the shared contract against synthetic native
// rows. This checks the bridge mapping, not SQLCipher or device durability.

import { historyStoreTests } from '@minhajna/core/test-support';
import { FakeStorage } from '../jest/fake-storage';
import { fromRow, nativeDeps, nativeStore } from '../src/storage/history';

describe('the native history adapter contract with synthetic storage', () => {
  historyStoreTests(
    test,
    async () => {
      const native = new FakeStorage();
      await native.openHistory();
      return {
        store: nativeStore(native.asSpec()),
        readCommitted: () => Promise.resolve(native.rows.map(fromRow)),
      };
    },
    nativeDeps(new FakeStorage().asSpec()),
  );
});
