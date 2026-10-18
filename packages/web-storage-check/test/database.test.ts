// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Only tests the completion contract, not a simulated IndexedDB implementation.
// Actual IndexedDB read/write/reopen checks belong to the browser QA report.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completed, DATABASE, writeTransaction, type Snapshot } from '../src/database.ts';

function transaction(error: DOMException | null = null): IDBTransaction {
  return { error, oncomplete: null, onabort: null, onerror: null } as IDBTransaction;
}

describe('IndexedDB commit acknowledgement', () => {
  it('does not resolve until the transaction, not a request, completes', async () => {
    const tx = transaction();
    let resolved = false;
    const done = completed(tx).then(() => {
      resolved = true;
    });
    await Promise.resolve();
    assert.equal(resolved, false);
    tx.oncomplete?.call(tx, new Event('complete'));
    await done;
    assert.equal(resolved, true);
  });

  it('rejects aborts, including quota failures', async () => {
    const tx = transaction(new DOMException('Invented quota failure', 'QuotaExceededError'));
    const done = completed(tx);
    tx.onabort?.call(tx, new Event('abort'));
    await assert.rejects(done, /QuotaExceededError/);
  });

  it('rejects transaction errors without exposing their message', async () => {
    const tx = transaction(new DOMException('Not for reporting', 'SecurityError'));
    const done = completed(tx);
    tx.onerror?.call(tx, new Event('error'));
    await assert.rejects(done, (error: Error) => error.message === 'SecurityError');
    assert.equal(DATABASE, 'minhajna-synthetic-storage-check-v1');
  });

  it('aborts if queuing a row throws instead of committing a cleared store', async () => {
    let aborted = false;
    const tx = transaction();
    tx.objectStore = () =>
      ({
        clear: () => undefined,
        put: () => {
          throw new Error('synthetic-clone-error');
        },
      }) as unknown as IDBObjectStore;
    tx.abort = () => {
      aborted = true;
      tx.onabort?.call(tx, new Event('abort'));
    };
    const snapshot = { rows: [{}] } as Snapshot;
    await assert.rejects(writeTransaction(tx, snapshot), /synthetic-clone-error/);
    assert.equal(aborted, true);
  });

  it('keeps the original error when the transaction can no longer abort', async () => {
    const tx = transaction();
    tx.objectStore = () =>
      ({
        clear: () => {
          throw new Error('synthetic-queue-error');
        },
      }) as unknown as IDBObjectStore;
    tx.abort = () => {
      tx.onabort?.call(tx, new Event('abort'));
      throw new DOMException('Already finished', 'InvalidStateError');
    };
    await assert.rejects(writeTransaction(tx, { rows: [] } as unknown as Snapshot), /synthetic-queue-error/);
  });
});
