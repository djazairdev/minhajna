// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the PDF parser's worker gives up before the engine loads: its network
// and storage entry points, on the global and on every prototype behind it,
// since a method left there could still be called on the global. If one can't
// be taken away, the worker stops rather than run with it.

export const DENIED = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'WebSocketStream',
  'WebTransport',
  'EventSource',
  'indexedDB',
  'caches',
  'BroadcastChannel',
  'Worker',
  'SharedWorker',
] as const;

function take(owner: object, key: string) {
  for (let at: object | null = Object.getPrototypeOf(owner) as object | null; at !== null;) {
    if (!Reflect.deleteProperty(at, key)) throw new Error('E_PDF_DENY');
    at = Object.getPrototypeOf(at) as object | null;
  }
  Object.defineProperty(owner, key, { value: undefined, writable: false, configurable: false });
}

/** Takes the entry points away from a worker's global and its navigator. */
export function deny(scope: object, navigator: object) {
  for (const key of DENIED) take(scope, key);
  take(navigator, 'storage');
}
