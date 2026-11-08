// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Worker in front of the demo server's container (#545, answers 544 and
// 753). A request for the health check, a world or the directory goes, headers
// and all, CF-Connecting-IP among them, to one Durable Object, which starts the
// one container if it is asleep and hands the request on once the server
// answers; any other path is 404, so a scanner's guesses wake nothing.
// Cloudflare stops a container SLEEP_AFTER_MS after its Durable Object last had
// a request, by SIGTERM, which the start script needs to archive the last WAL,
// and a new one starts on an empty disk from the bucket. Waking takes as long
// as that restore, so past PATIENCE_MS, under the world client's 20 seconds, a
// request is answered 503 with Retry-After, and the start goes on. So is any
// request while the bucket's settings are missing: the container never starts
// without its sealed archive. While the server is not up, a browser's preflight
// starts it and is answered at once, from the server's own lists (src/cors.ts),
// since its wait would come out of the client's; a page elsewhere wakes
// nothing, and the 503 names the web app's origin back, so its client can read
// it. The daily cron wakes the container like a request: the server sweeps
// worlds past their 7th day as it starts, and the container takes its base
// backup, due after under a day so that a day's wake always finds it due, and
// tests its restore. Plain HTTP goes to HTTPS. The Worker logs nothing. A
// Worker's entry may export only handlers and classes, so nothing else here is.

import { CORS_HEADERS, CORS_METHODS, PREFLIGHT_KEPT, WEB_ORIGINS } from '../src/cors.js';

/** The bucket's settings, set as the Worker's secrets (docs/demo-host.md). */
const SECRETS = ['AWS_ENDPOINT', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'WALG_LIBSODIUM_KEY'] as const;

/** What the bucket is called and how it is reached, and what the server is behind. */
const SETTINGS = {
  WALG_S3_PREFIX: 's3://minhajna-demo/archive',
  WALG_LIBSODIUM_KEY_TRANSFORM: 'hex',
  AWS_REGION: 'auto',
  AWS_S3_FORCE_PATH_STYLE: 'true',
  BACKUP_EVERY: '82800',
  TRUST_PROXY: 'cloudflare',
};

const PORT = 8080;
const NAME = 'demo';
const LOCAL = ['127.0.0.1', 'localhost', '[::1]'];
const SERVED = /^\/(?:health$|(?:worlds|directory)(?:\/|$))/u;
const SLEEP_AFTER_MS = 30 * 60_000;
const PATIENCE_MS = 18_000;
const POLL_MS = 500;
const PING_MS = 5_000;

type Port = { fetch(input: string | Request, init?: RequestInit): Promise<Response> };

/** What the platform gives a Durable Object of its container. */
export type Container = {
  readonly running: boolean;
  start(options: { enableInternet: boolean; env: Record<string, string> }): void;
  setInactivityTimeout(durationMs: number): Promise<void>;
  getTcpPort(port: number): Port;
};

/** What the platform gives a Durable Object. */
export type State = {
  readonly container?: Container;
  blockConcurrencyWhile<T>(work: () => Promise<T>): Promise<T>;
};

export type Env = Partial<Record<(typeof SECRETS)[number], string>> & {
  SERVER: { idFromName(name: string): unknown; get(id: unknown): Port };
};

/** Everything the container needs from its environment, or undefined with a secret missing. */
function containerEnv(env: Env): Record<string, string> | undefined {
  const secrets: Record<string, string> = {};
  for (const name of SECRETS) {
    const value = env[name];
    if (!value) return undefined;
    secrets[name] = value;
  }
  return { ...SETTINGS, ...secrets };
}

/** The headers that let the web app's own pages read an answer of the Worker's. */
function namedBack(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  if (origin === null || !WEB_ORIGINS.has(origin)) return { Vary: 'Origin' };
  return { Vary: 'Origin', 'Access-Control-Allow-Origin': origin, 'Access-Control-Expose-Headers': 'Retry-After' };
}

/** A request the server can't take yet. */
function starting(request: Request): Response {
  return new Response(JSON.stringify({ statusCode: 503, message: 'the demo server is starting' }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '15',
      ...namedBack(request),
    },
  });
}

/** Whether a request is a browser's preflight. */
function isPreflight(request: Request): boolean {
  return request.method === 'OPTIONS' && request.headers.has('Access-Control-Request-Method');
}

/** A preflight's answer while the server is not up, from src/cors.ts's lists, which each browser checks itself. */
function preflight(request: Request): Response {
  if (!WEB_ORIGINS.has(request.headers.get('Origin') ?? '')) {
    return new Response(JSON.stringify({ statusCode: 403, message: 'this origin, method or header is not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' },
    });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...namedBack(request),
      'Access-Control-Allow-Methods': [...CORS_METHODS].join(', '),
      'Access-Control-Allow-Headers': [...CORS_HEADERS].join(', '),
      'Access-Control-Max-Age': String(PREFLIGHT_KEPT),
      'Cache-Control': 'no-store',
    },
  });
}

/** The request as the container takes it: only plain HTTP reaches a container's port. */
function forContainer(request: Request): Request {
  const { pathname, search } = new URL(request.url);
  return new Request(new URL(`${pathname}${search}`, 'http://container'), request);
}

/** The Durable Object that holds the one container. */
export class DemoServer {
  private answering = false;
  private sleepSet = false;

  constructor(
    private readonly state: State,
    private readonly env: Env,
  ) {
    const container = state.container;
    if (container?.running) {
      void state.blockConcurrencyWhile(() => container.setInactivityTimeout(SLEEP_AFTER_MS).catch(() => undefined));
    }
  }

  private async start(container: Container, settings: Record<string, string>): Promise<void> {
    try {
      if (!container.running) {
        container.start({ enableInternet: true, env: settings });
        this.sleepSet = false;
      }
      if (!this.sleepSet) {
        await container.setInactivityTimeout(SLEEP_AFTER_MS);
        this.sleepSet = true;
      }
    } catch {
      this.answering = false;
    }
  }

  /** Starts the container if it is asleep and waits for the server, within PATIENCE_MS. */
  private async wake(container: Container, settings: Record<string, string>): Promise<boolean> {
    const deadline = Date.now() + PATIENCE_MS;
    while (Date.now() < deadline) {
      await this.start(container, settings);
      try {
        const signal = AbortSignal.timeout(Math.min(PING_MS, deadline - Date.now()));
        const answer = await container.getTcpPort(PORT).fetch('http://container/health', { signal });
        await answer.body?.cancel();
        if (answer.ok) {
          this.answering = true;
          return true;
        }
      } catch {
        this.answering = false;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    return false;
  }

  async fetch(request: Request): Promise<Response> {
    const container = this.state.container;
    const settings = containerEnv(this.env);
    const up = this.answering && container?.running === true;
    if (!up && isPreflight(request)) {
      if (container !== undefined && settings !== undefined && WEB_ORIGINS.has(request.headers.get('Origin') ?? '')) {
        await this.start(container, settings);
      }
      return preflight(request);
    }
    if (container === undefined || settings === undefined) return starting(request);
    if (!up) {
      this.answering = false;
      if (!(await this.wake(container, settings))) return starting(request);
    }
    try {
      return await container.getTcpPort(PORT).fetch(forContainer(request));
    } catch {
      this.answering = false;
      return isPreflight(request) ? preflight(request) : starting(request);
    }
  }
}

function server(env: Env): Port {
  return env.SERVER.get(env.SERVER.idFromName(NAME));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol === 'http:' && !LOCAL.includes(url.hostname)) {
      url.protocol = 'https:';
      return new Response(null, { status: 301, headers: { Location: url.href } });
    }
    if (!SERVED.test(url.pathname))
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    try {
      return await server(env).fetch(request);
    } catch {
      return isPreflight(request) ? preflight(request) : starting(request);
    }
  },
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await (await server(env).fetch('https://minhajna-demo.djazair.dev/health')).body?.cancel();
  },
};
