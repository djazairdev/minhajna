// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's host on Cloudflare (answers 534 and 537): a Worker in
// front of one release's files that answers as scripts/serve.ts does, with
// the rules of scripts/host.ts, so the host check passes against it. Only a
// GET for a file of a kind the build holds is answered, with its media type
// and the host's headers, read once from the page's own policy; anything
// else is 404, with no fallback page. Plain HTTP is sent to HTTPS, but on
// this computer. The Worker sets no cookie and keeps no log
// (apps/web/host/wrangler.jsonc).

import { hostHeaders, pagePolicy, typeOf } from './host.ts';

/** The release's files, as the Worker's assets binding serves them. */
export type Assets = { fetch(input: URL): Promise<Response> };

const LOCAL = ['127.0.0.1', 'localhost', '[::1]'];
const policies = new WeakMap<Assets, Promise<string>>();

/** The page's security policy, read once for each set of files. */
function policyOf(assets: Assets, origin: string): Promise<string> {
  const known = policies.get(assets);
  if (known !== undefined) return known;
  const read = assets.fetch(new URL('/index.html', origin)).then(async (page) => {
    if (page.status !== 200) throw new Error(`index.html: status ${page.status}`);
    return pagePolicy(await page.text());
  });
  policies.set(assets, read);
  read.catch(() => policies.delete(assets));
  return read;
}

/** The file a path names, or undefined for one no build holds. */
function fileName(pathname: string): string | undefined {
  try {
    const name = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    return typeOf(name) === undefined ? undefined : name;
  } catch {
    return undefined;
  }
}

/** The answer to one request, from the release's files. */
export async function answer(request: Request, assets: Assets): Promise<Response> {
  const url = new URL(request.url);
  if (url.protocol === 'http:' && !LOCAL.includes(url.hostname)) {
    url.protocol = 'https:';
    return new Response(null, { status: 301, headers: { Location: url.href } });
  }
  const name = fileName(url.pathname);
  if (request.method !== 'GET' || name === undefined) return new Response(null, { status: 404 });
  const file = await assets.fetch(new URL(url.pathname === '/' ? '/index.html' : url.pathname, url.origin));
  if (file.status !== 200) return new Response(null, { status: 404 });
  const headers = hostHeaders(await policyOf(assets, url.origin), url.protocol === 'https:');
  return new Response(file.body, { status: 200, headers: { 'Content-Type': typeOf(name) ?? '', ...headers } });
}

export default {
  fetch: (request: Request, env: { ASSETS: Assets }): Promise<Response> => answer(request, env.ASSETS),
};
