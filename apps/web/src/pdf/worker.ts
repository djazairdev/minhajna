// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A dedicated parser worker, without app storage or network capabilities.
// The PDF engine is imported after these restrictions. No viewer, scripting,
// annotation actions or PDF-supplied HTML enters the application.

for (const key of [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'indexedDB',
  'caches',
  'BroadcastChannel',
  'Worker',
  'SharedWorker',
])
  Object.defineProperty(globalThis, key, { value: undefined, writable: false, configurable: false });

await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
export {};
