// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Serves dist/ on this computer only, for checking the web app before any
// host is chosen (answer 500): files only, no application backend, nothing
// outside dist/, and every answer marked not to be cached by the browser,
// so the offline worker's own cache is what a second visit sees.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../dist/', import.meta.url);
const port = Number(process.env.PORT ?? 4180);

/** The media type of each file kind in dist/. */
const TYPES: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  png: 'image/png',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = new URL(name, root);
  const type = TYPES[name.split('.').at(-1) ?? ''];
  if (request.method !== 'GET' || !file.href.startsWith(root.href) || type === undefined) {
    response.writeHead(404).end();
    return;
  }
  readFile(file).then(
    (bytes) => {
      response.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(bytes);
    },
    () => response.writeHead(404).end(),
  );
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Minhajna for the web: http://127.0.0.1:${port}/\nServing ${fileURLToPath(root)}\n`);
});
