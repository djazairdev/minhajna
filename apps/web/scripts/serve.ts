// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Serves dist/ on this computer only, for checking the web app as its host
// serves it (scripts/host.ts): files only, no application backend, nothing
// outside dist/, and every answer with the host's headers, among them that
// nothing is cached by the browser, so the offline worker's own cache is what a
// second visit sees. The host check runs against it in the tests. The dashboard
// app serves its own dist/ with it (answer 855).

import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hostHeaders, pagePolicy, typeOf } from './host.ts';

/** A server of one folder's files, with the host's headers, read from its page's policy when started. */
export function serveFolder(root: URL): Server {
  const headers = hostHeaders(pagePolicy(readFileSync(new URL('index.html', root), 'utf8')), false);
  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = new URL(name, root);
    const type = typeOf(name);
    if (request.method !== 'GET' || !file.href.startsWith(root.href) || type === undefined) {
      response.writeHead(404).end();
      return;
    }
    readFile(file).then(
      (bytes) => {
        response.writeHead(200, { 'Content-Type': type, ...headers });
        response.end(bytes);
      },
      () => response.writeHead(404).end(),
    );
  });
}

/** Serves the app's dist/ in `root` on this computer at `port`, or PORT when set, and says where. */
export function serveApp(root: URL, port: number, name: string): Server {
  const dist = new URL('dist/', root);
  const at = Number(process.env.PORT ?? port);
  return serveFolder(dist).listen(at, '127.0.0.1', () => {
    process.stdout.write(`${name}: http://127.0.0.1:${at}/\nServing ${fileURLToPath(dist)}\n`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  serveApp(new URL('../', import.meta.url), 4180, 'Minhajna for the web');
