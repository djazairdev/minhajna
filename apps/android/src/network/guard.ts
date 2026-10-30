// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The guard on the connections the app's code can open (#559, choice D8 of the
// 0.7.0 demo, answer 570), set first as the app starts, on the phone and on a
// PC. It wraps the global `fetch`, `XMLHttpRequest` and `WebSocket`, and on a
// PC `EventSource` and `navigator.sendBeacon`: each refuses any address but the
// demo server, and the demo server too unless a demo world is open, with
// E_REFUSED. On a PC, the page's own origin stays open for its own files, and
// its security policy allows no other address; Android's debug builds keep
// Metro. React Native's `fetch` goes through `XMLHttpRequest`, so both are
// guarded. What the globals do not cover, React Native's native image loading,
// its networking and socket modules imported directly, and native modules' own
// requests, the app's code never uses, which a test checks
// (network-scan.test.ts). Addresses are compared as text, without a URL parser,
// which React Native lacks, once cleaned as a parser cleans them, and the
// platform is given the very string checked; `blob:` and `data:` addresses,
// which name what the page holds, stay open. An address is the server's only
// when it starts with the server's origin and a slash, so no user name or port
// can pass for it, and a relative one never starts with two slashes or
// backslashes, which would name a host. The guard holds no record and sends
// nothing itself.

export interface NetworkRules {
  /** The demo server's origin. */
  readonly server: string;
  /** Whether a demo world is open, read at each request. */
  readonly inWorld: () => boolean;
  /** The page's own origin on a PC, whose files stay open; null on the phone. */
  readonly own: string | null;
  /** Whether every other address stays open: Android's debug builds, for Metro. */
  readonly others: boolean;
}

/** What a refused request says. */
export const REFUSED = 'Minhajna connects only to the demo server, and only inside a demo world';

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
/** Addresses that name what the page already holds, never a connection. */
const LOCAL = /^(?:blob|data):/iu;
const GUARDED = Symbol.for('minhajna.network-guard');

/** The address as a URL parser reads it: tabs and line breaks dropped, controls and spaces trimmed at its ends. */
function cleaned(address: string): string {
  const kept = [...address].filter((one) => one !== '\t' && one !== '\n' && one !== '\r');
  const shown = (one: string | undefined) => one !== undefined && one.charCodeAt(0) > 32;
  let at = 0;
  let end = kept.length;
  while (at < end && !shown(kept[at])) at += 1;
  while (end > at && !shown(kept[end - 1])) end -= 1;
  return kept.slice(at, end).join('');
}

/** Whether the rules let a request to this address go. */
export function mayConnect(given: string, rules: NetworkRules): boolean {
  const address = cleaned(given);
  if (rules.others || LOCAL.test(address)) return true;
  if (!SCHEME.test(address)) return rules.own !== null && !/^[/\\]{2}/u.test(address);
  if (rules.own !== null && address.startsWith(`${rules.own}/`)) return true;
  return address.startsWith(`${rules.server}/`) && rules.inWorld();
}

/** A refused request's error, with its code. */
function refusal(): TypeError {
  return Object.assign(new TypeError(REFUSED), { code: 'E_REFUSED' });
}

/** What the platform is given once the rules let it go: a `Request` as it is, anything else as the string checked. */
function checked(input: unknown, rules: NetworkRules): unknown {
  const whole = typeof Request !== 'undefined' && input instanceof Request;
  const address = whole ? input.url : String(input);
  if (!mayConnect(address, rules)) throw refusal();
  return whole ? input : address;
}

type Constructor = new (...args: never[]) => unknown;

/** The globals the guard wraps, as a page or React Native has them. */
interface Scope {
  fetch?: (input: never, init?: never) => Promise<unknown>;
  XMLHttpRequest?: { prototype: { open: (...args: never[]) => void } };
  WebSocket?: Constructor;
  EventSource?: Constructor;
  navigator?: { sendBeacon?: (address: never, data?: never) => boolean };
}

function guarded<T extends Constructor>(Class: T, rules: NetworkRules): T {
  return new Proxy(Class, {
    construct(target, args: unknown[], newTarget: Constructor) {
      return Reflect.construct(target, [checked(args[0], rules), ...args.slice(1)], newTarget) as object;
    },
  });
}

/** Wraps the scope's connections with the rules; a second call changes nothing. */
export function guardNetwork(rules: NetworkRules, scope: object = globalThis): void {
  const held = scope as Scope & { [GUARDED]?: true };
  if (held[GUARDED]) return;
  held[GUARDED] = true;
  const fetch = held.fetch;
  if (fetch !== undefined) {
    held.fetch = (input: never, init?: never) => {
      try {
        return fetch.call(scope, checked(input, rules) as never, init);
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : refusal());
      }
    };
  }
  const request = held.XMLHttpRequest?.prototype;
  if (request !== undefined) {
    const open = request.open;
    request.open = function (this: unknown, ...args: never[]) {
      open.apply(this, [args[0], checked(args[1], rules), ...args.slice(2)] as never[]);
    };
  }
  if (held.WebSocket !== undefined) held.WebSocket = guarded(held.WebSocket, rules);
  if (held.EventSource !== undefined) held.EventSource = guarded(held.EventSource, rules);
  const { navigator } = held;
  const beacon = navigator?.sendBeacon;
  if (navigator !== undefined && beacon !== undefined) {
    navigator.sendBeacon = (address: never, data?: never) => {
      try {
        return beacon.call(navigator, checked(address, rules) as never, data);
      } catch {
        return false;
      }
    };
  }
}
