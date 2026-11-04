// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The parser worker's deny-list reaches the prototypes behind its global, as
// the browser keeps fetch and storage there, and stops a worker it can't
// complete. The real worker is checked in a browser (pack-editor-forms.md).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DENIED, deny } from '../src/pdf/deny.ts';

const called = () => 'reached';

function worker() {
  class Scope {
    fetch = undefined as unknown;
  }
  Object.assign(Scope.prototype, { caches: called, indexedDB: called });
  delete (Scope.prototype as { fetch?: unknown }).fetch;
  Object.defineProperty(Scope.prototype, 'fetch', { value: called, configurable: true });
  const scope = Object.create(Scope.prototype) as Record<string, unknown>;
  scope.WebSocket = called;
  class Nav {
    get storage() {
      return 'reached';
    }
  }
  return { scope, Scope, navigator: new Nav() as object, Nav };
}

test('nothing on the list stays reachable, on the global or behind it', () => {
  const { scope, Scope, navigator, Nav } = worker();
  deny(scope, navigator);
  for (const key of DENIED) {
    assert.equal(scope[key], undefined, key);
    assert.equal(Reflect.get(Scope.prototype, key), undefined, key);
    assert.throws(() => {
      scope[key] = called;
    }, TypeError);
  }
  assert.equal(Reflect.get(navigator, 'storage'), undefined);
  assert.equal(Object.getOwnPropertyDescriptor(Nav.prototype, 'storage'), undefined);
  assert.ok(DENIED.includes('WebTransport'));
});

test('a worker stops when an entry point can’t be taken away', () => {
  const { scope, Scope, navigator } = worker();
  Object.defineProperty(Scope.prototype, 'caches', { value: called, configurable: false });
  assert.throws(() => deny(scope, navigator), { message: 'E_PDF_DENY' });
});
