// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it } from 'node:test';
import { MemoryStore } from '@minhajna/core';
import { historyStoreTests } from '@minhajna/core/test-support';
import { deps } from './support.ts';

describe('MemoryStore contract', () => {
  historyStoreTests(
    it,
    () => {
      const store = new MemoryStore();
      return { store, readCommitted: () => store.load() };
    },
    deps,
  );
});
