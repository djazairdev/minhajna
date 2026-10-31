// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school's security key, through the browser's WebAuthn with the PRF
// extension (#572, answer 602). Setting a key up makes a discoverable
// credential on it, on the key itself rather than the PC or a phone, with the
// key's own PIN, named for the teacher and the key's number; the key keeps
// that name, which only its PIN shows. Its user handle is the one the caller
// gives, the same for a teacher's assignment, so setting the key up again
// replaces the credential rather than adding one. Asking it later lets the
// person pick it and type its PIN. Either way the key gives its PRF output for
// one fixed salt, the same each time, which names and opens the place of the
// teacher's session; when the browser gives none while setting up, the new
// credential alone is asked. The challenge is random and checked by no
// server, since no assertion is relied on here; signing with the key itself
// comes later. The relying party is the page's host, so a key set up on one
// host signs in on that host only. A browser or key without the PRF extension
// is refused (E_KEY_PRF), and a prompt the person closed, one that timed out,
// or a key holding no Minhajna sign-in says so (E_KEY_CANCELLED). A phone,
// which has no such browser, has no key.

import { PRF_BYTES } from '@minhajna/core';
import { failed } from '../demo/world-session';

/** Who a key is set up for: the teacher, the key's number, and the credential's user handle. */
export type KeyHolder = { readonly teacher: string; readonly number: string; readonly handle: Uint8Array };

/** A school's security key, as the staffroom PC and the director's PC use it. */
export interface StaffKey {
  /** Sets a credential up on the key for the teacher, with its PIN, and answers its PRF output. */
  readonly setUp: (holder: KeyHolder) => Promise<Uint8Array>;
  /** Asks a key set up before, with its PIN, for its PRF output, until the signal aborts it. */
  readonly ask: (signal?: AbortSignal) => Promise<Uint8Array>;
}

type Prf = { readonly enabled?: boolean; readonly results?: { readonly first?: ArrayBuffer } };
type Credential = { readonly rawId: ArrayBuffer; readonly getClientExtensionResults: () => { readonly prf?: Prf } };
type Credentials = {
  readonly create: (options: unknown) => Promise<Credential | null>;
  readonly get: (options: unknown) => Promise<Credential | null>;
};

const SALT = Uint8Array.from('minhajna/staff-key/prf/1', (one) => one.charCodeAt(0));
const CLOSED = new Set(['NotAllowedError', 'AbortError']);

function prfOf(credential: Credential | null): Uint8Array | null {
  const first = credential?.getClientExtensionResults().prf?.results?.first;
  if (first === undefined) return null;
  const bytes = new Uint8Array(first);
  if (bytes.length !== PRF_BYTES) throw failed('The key gave a PRF output of another length', 'E_KEY_PRF');
  return bytes;
}

async function asked<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    if (typeof name === 'string' && CLOSED.has(name)) throw failed('The key’s prompt was closed', 'E_KEY_CANCELLED');
    if (name === 'NotSupportedError') throw failed('The key or the browser cannot do this', 'E_KEY_PRF');
    throw error;
  }
}

/** The browser's security keys, or null where there is no WebAuthn, as on a phone. */
export function browserKey(random: (length: number) => Uint8Array): StaffKey | null {
  const credentials = (globalThis as { navigator?: { credentials?: Credentials } }).navigator?.credentials;
  const webAuthn = (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  if (credentials === undefined || webAuthn === undefined) return null;
  const extensions = { prf: { eval: { first: SALT } } };
  const hints = ['security-key'];
  const ask = async (signal?: AbortSignal, only?: ArrayBuffer) => {
    const allowCredentials = only === undefined ? undefined : [{ type: 'public-key', id: only }];
    const publicKey = { challenge: random(32), userVerification: 'required', hints, extensions, allowCredentials };
    const found = prfOf(await asked(() => credentials.get({ publicKey, signal })));
    if (found === null) throw failed('The key or the browser gives no PRF output', 'E_KEY_PRF');
    return found;
  };
  const setUp = async ({ teacher, number, handle }: KeyHolder) => {
    const publicKey = {
      rp: { name: 'Minhajna' },
      user: { id: handle, name: teacher, displayName: `${teacher} · ${number}` },
      challenge: random(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      hints,
      extensions,
    };
    const made = await asked(() => credentials.create({ publicKey }));
    const now = prfOf(made);
    if (now !== null) return now;
    if (made?.getClientExtensionResults().prf?.enabled !== true) {
      throw failed('The key or the browser gives no PRF output', 'E_KEY_PRF');
    }
    return ask(undefined, made.rawId);
  };
  return { setUp, ask: (signal) => ask(signal) };
}
