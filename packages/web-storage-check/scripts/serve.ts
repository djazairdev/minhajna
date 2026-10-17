// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Optional loopback-only static file server for QA. No application backend.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../dist/', import.meta.url);
const types: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
};
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = new URL(name, root);
  if (
    request.method !== 'GET' ||
    !file.href.startsWith(root.href) ||
    !/\.(html|js|css|json|webmanifest|svg|txt)$/.test(name)
  ) {
    response.writeHead(404).end();
    return;
  }
  void readFile(file)
    .then((bytes) => {
      response.writeHead(200, {
        'Content-Type': types[name.split('.').at(-1) ?? ''] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(bytes);
    })
    .catch(() => {
      response.writeHead(404).end();
    });
});
server.listen(4179, '127.0.0.1', () =>
  process.stdout.write(`Local: http://127.0.0.1:4179/\nStatic directory: ${fileURLToPath(root)}\n`),
);
