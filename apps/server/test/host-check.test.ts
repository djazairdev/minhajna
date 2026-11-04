// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The host check (host/check.ts), against a made-up server on this computer: it
// passes what stands as it should, and names each thing that does not. It also
// runs against the real server's own answers, so the check and the server keep
// to one list of web addresses.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, describe, it } from 'node:test';
import { checkServer, plainProblems, WEB_APPS, waitForServer } from '../host/check.js';
import { cors, WEB_ORIGINS } from '../src/cors.js';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const servers: Server[] = [];
after(() => servers.forEach((server) => server.close()));

/** The server as it should stand, through the real cors middleware. */
const standing: Handler = (request, response) => {
  cors(request, response, () => {
    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ version: '9.1.0' }));
    } else {
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end('{}');
    }
  });
};

async function serve(handler: Handler): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** The standing server with one change made to each answer. */
function changed(change: (response: ServerResponse, request: IncomingMessage) => void): Handler {
  return (request, response) => {
    change(response, request);
    standing(request, response);
  };
}

describe('the demo server’s host check', () => {
  it('keeps to the server’s own list of the web app’s public addresses', () => {
    assert.deepEqual(
      WEB_APPS,
      [...WEB_ORIGINS].filter((origin) => origin.startsWith('https:')),
    );
  });

  it('passes a server that stands as it should', async () => {
    assert.deepEqual(await checkServer(await serve(standing), '9.1.0'), []);
  });

  it('refuses plain HTTP away from this computer', async () => {
    assert.deepEqual(await checkServer('http://minhajna-demo.example', '9.1.0'), [
      'http://minhajna-demo.example/ is not HTTPS',
    ]);
  });

  it('names another version', async () => {
    const problems = await checkServer(await serve(standing), '9.2.0');
    assert.deepEqual(problems, ['/health: answers {"version":"9.1.0"}, not the version 9.2.0']);
  });

  it('stops at a health check that fails', async () => {
    const address = await serve((_request, response) => {
      response.writeHead(503, { 'Retry-After': '15' });
      response.end();
    });
    assert.deepEqual(await checkServer(address, '9.1.0'), ['/health: status 503']);
  });

  for (const [header, value] of [
    ['X-Powered-By', 'Made-up'],
    ['Set-Cookie', 'a=1'],
    ['NEL', '{}'],
    ['Report-To', '{}'],
    ['Reporting-Endpoints', 'a="https://reports.example"'],
    ['Via', 'made-up'],
    ['Access-Control-Allow-Credentials', 'true'],
  ] as const) {
    it(`names ${header} on an answer`, async () => {
      const address = await serve(changed((response) => response.setHeader(header, value)));
      const problems = await checkServer(address, '9.1.0');
      assert.ok(problems.includes(`/health: sends ${header.toLowerCase()}`), problems.join('\n'));
    });
  }

  it('names a server header that says what it runs, and passes Cloudflare’s', async () => {
    const named = await serve(changed((response) => response.setHeader('Server', 'made-up/1.0')));
    assert.ok((await checkServer(named, '9.1.0')).includes('/health: its server is made-up/1.0'));
    const front = await serve(changed((response) => response.setHeader('Server', 'cloudflare')));
    assert.deepEqual(await checkServer(front, '9.1.0'), []);
  });

  for (const status of ['HIT', 'STALE', 'UPDATING', 'REVALIDATED']) {
    it(`names an answer whose cache status is ${status}, and passes one that came from no cache`, async () => {
      const cached = await serve(changed((response) => response.setHeader('CF-Cache-Status', status)));
      assert.ok((await checkServer(cached, '9.1.0')).includes(`/health: its cache status is ${status}`));
      const fresh = await serve(changed((response) => response.setHeader('CF-Cache-Status', 'DYNAMIC')));
      assert.deepEqual(await checkServer(fresh, '9.1.0'), []);
    });
  }

  it('names timing that speaks of the server, and passes Cloudflare’s own', async () => {
    const told = await serve(changed((response) => response.setHeader('Server-Timing', 'db;dur=12')));
    assert.ok((await checkServer(told, '9.1.0')).includes('/health: its timing is db;dur=12'));
    const mixed = await serve(changed((response) => response.setHeader('Server-Timing', 'cfL4;dur=1, db;dur=12')));
    assert.ok((await checkServer(mixed, '9.1.0')).includes('/health: its timing is cfL4;dur=1, db;dur=12'));
    const own = 'cfCacheStatus;desc="DYNAMIC", cfEdge;dur=9,cfOrigin;dur=20,cfL4;desc="made-up"';
    const front = await serve(changed((response) => response.setHeader('Server-Timing', own)));
    assert.deepEqual(await checkServer(front, '9.1.0'), []);
  });

  it('names a cookie on the refusal of a page elsewhere', async () => {
    const address = await serve((request, response) => {
      if (request.headers.origin === 'https://not-the-web-app.example') response.setHeader('Set-Cookie', 'a=1');
      standing(request, response);
    });
    assert.deepEqual(await checkServer(address, '9.1.0'), ['a page elsewhere: sends set-cookie']);
  });

  describe('plain HTTP', () => {
    const base = new URL('https://minhajna-demo.example/');
    const moved = (status: number, location: string, more: Record<string, string> = {}) =>
      new Response(null, { status, headers: { Location: location, ...more } });

    it('passes a move to the same address over HTTPS', () => {
      assert.deepEqual(plainProblems(moved(301, 'https://minhajna-demo.example/health'), base), []);
      assert.deepEqual(plainProblems(moved(308, 'https://minhajna-demo.example/health'), base), []);
    });

    for (const [why, answer] of [
      ['a look-alike address', moved(301, 'https://minhajna-demo.example.evil.example/health')],
      ['plain HTTP again', moved(301, 'http://minhajna-demo.example/health')],
      ['a move for now only', moved(302, 'https://minhajna-demo.example/health')],
      ['no move at all', new Response('{}', { status: 200 })],
      ['an address that is not one', moved(301, 'nowhere')],
    ] as const) {
      it(`names ${why}`, () => {
        assert.deepEqual(plainProblems(answer, base), ['plain HTTP does not go to HTTPS']);
      });
    }

    it('names a cookie on the move', () => {
      const answer = moved(301, 'https://minhajna-demo.example/health', { 'Set-Cookie': 'a=1' });
      assert.deepEqual(plainProblems(answer, base), ['plain HTTP: sends set-cookie']);
    });
  });

  it('names a web address the server does not allow', async () => {
    const address = await serve(standing);
    const problems = await checkServer(address, '9.1.0', ['https://other-web-app.example']);
    assert.ok(problems.includes('https://other-web-app.example: may not call the server'));
    assert.ok(problems.includes('https://other-web-app.example: may not read an answer'));
    assert.ok(problems.includes("https://other-web-app.example: the preflight's status is 403, not 204"));
  });

  it('names a page elsewhere that may call the server', async () => {
    const address = await serve((request, response) => {
      response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? '');
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }
      standing(request, response);
    });
    const problems = await checkServer(address, '9.1.0');
    assert.ok(problems.includes("a page elsewhere: the preflight's status is 204, not 403"));
    assert.ok(problems.includes('a page elsewhere may call the server'));
  });

  it('names a path the server should not answer', async () => {
    const address = await serve((request, response) => {
      if (request.url === '/worlds/not/a/path/here') {
        response.writeHead(200);
        response.end();
        return;
      }
      standing(request, response);
    });
    assert.deepEqual(await checkServer(address, '9.1.0'), ['a path the server lacks: status 200, not 404']);
  });

  it('gives up with the last problems once its time has passed', async () => {
    const address = await serve(standing);
    assert.deepEqual(await waitForServer(address, '9.2.0', 0), [
      '/health: answers {"version":"9.1.0"}, not the version 9.2.0',
    ]);
  });

  it('turns an address out of reach into a problem', async () => {
    const problems = await waitForServer('http://127.0.0.1:9', '9.1.0', 0);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? '', /^http:\/\/127\.0\.0\.1:9: /u);
  });
});
