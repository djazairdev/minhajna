// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signed updates (#223, PRD §4.8, R-4.8-04, R-4.8-05, answers 303 to 305).
// A file carries the text of one update as its payload, the ID of the key
// that signed it, and the signature: ECDSA P-256 over SHA-256 of the
// payload's UTF-8 bytes, in DER form, base64-encoded. The app trusts only
// the keys its reference data lists, each with who holds it and its
// published fingerprint, and what it may sign: calendar updates, plan
// packs, or both (answer 327). The platform checks the signature, Android's own
// crypto on the phone and Node's in tests, before the payload is read at
// all, so a file changed after signing is refused and nothing is applied.
// The file is read strictly: other fields, another format or a newer major
// version are refused, and a newer minor version is read as far as known.

import { at, isFields, Reader, type ParseResult } from './read.ts';
import type { LocalizedText } from './reference.ts';
import { readName } from './reference-fields.ts';

export const SIGNED_FORMAT = 'minhajna.signed';

/** The most a signed calendar update may weigh, in UTF-8 bytes, as a QR code still carries it. */
export const SIGNED_BYTES = 16_384;

/** The most a signed plan pack may weigh, in UTF-8 bytes; it travels as a file only (answer 328). */
export const PACK_BYTES = 1_048_576;

/** The kinds of data a key may sign (answer 327). */
export const SIGNED_KINDS = ['calendar', 'packs'] as const;

export type SignedKind = (typeof SIGNED_KINDS)[number];

const KEY_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Padded base64 in whole four-character units, which every platform's decoder reads the same way. */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})+$|^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

/** A key the app trusts: who holds it, its public half (SubjectPublicKeyInfo, DER, base64) and its fingerprint. */
export interface TrustedKey {
  readonly id: string;
  readonly holder: LocalizedText;
  readonly spki: string;
  /** SHA-256 of the public half, in hex, as published with the code. */
  readonly fingerprint: string;
  /** What the key may sign; a file of another kind signed with it is refused. */
  readonly signs: readonly SignedKind[];
}

/** Checks a signature over a payload's UTF-8 bytes with a public key; never throws for a bad signature. */
export type Verifier = (spki: string, payload: string, signature: string) => Promise<boolean>;

export const SIGNED_PROBLEMS = ['invalid', 'version', 'unknown-key', 'signature', 'payload'] as const;

export type SignedProblem = (typeof SIGNED_PROBLEMS)[number];

export type Opened =
  | { readonly ok: true; readonly key: TrustedKey; readonly minor: number; readonly payload: unknown }
  | { readonly ok: false; readonly problem: SignedProblem; readonly key?: TrustedKey };

/** A file's version, `{major, minor}` and nothing else, or null; the caller checks the major version it reads. */
export function readVersion(value: unknown): { readonly major: number; readonly minor: number } | null {
  if (!isFields(value) || Object.keys(value).some((name) => name !== 'major' && name !== 'minor')) return null;
  const { major, minor } = value;
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || (major as number) < 1 || (minor as number) < 0)
    return null;
  return { major: major as number, minor: minor as number };
}

/** The UTF-8 length of a text, or null when it holds a lone surrogate, which no file can. */
export function utf8Length(text: string): number | null {
  let bytes = 0;
  for (const char of text) {
    const point = char.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) return null;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/** Reads a signed file and checks its signature with one of `keys`; the payload is parsed only once it checks. */
export async function openSigned(
  text: string,
  keys: readonly TrustedKey[],
  verify: Verifier,
  limit = SIGNED_BYTES,
): Promise<Opened> {
  const bytes = text.length > limit ? null : utf8Length(text);
  if (bytes === null || bytes > limit) return { ok: false, problem: 'invalid' };
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  if (!isFields(raw) || raw['format'] !== SIGNED_FORMAT) return { ok: false, problem: 'invalid' };
  const version = readVersion(raw['version']);
  if (version?.major !== 1) return { ok: false, problem: 'version' };
  const { key: id, payload, signature } = raw;
  const known = ['format', 'version', 'key', 'payload', 'signature'];
  if (
    Object.keys(raw).some((name) => !known.includes(name)) ||
    typeof id !== 'string' ||
    !KEY_ID.test(id) ||
    typeof payload !== 'string' ||
    payload === '' ||
    utf8Length(payload) === null ||
    typeof signature !== 'string' ||
    signature.length > 200 ||
    !BASE64.test(signature)
  )
    return { ok: false, problem: 'invalid' };
  const key = keys.find((one) => one.id === id);
  if (key === undefined) return { ok: false, problem: 'unknown-key' };
  const checks = await verify(key.spki, payload, signature).catch(() => false);
  if (!checks) return { ok: false, problem: 'signature', key };
  try {
    return { ok: true, key, minor: version.minor, payload: JSON.parse(payload) as unknown };
  } catch {
    return { ok: false, problem: 'payload', key };
  }
}

/** Reads the keys the app trusts, from the reference data's key list. */
export function parseTrustedKeys(input: unknown): ParseResult<TrustedKey[]> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');
  const ids = new Set<string>();
  const keys = reader.list(
    input,
    'keys',
    '',
    (raw, path): TrustedKey | undefined => {
      if (!isFields(raw)) {
        reader.fail(path, 'invalid');
        return undefined;
      }
      const id = reader.requiredText(raw, 'id', path, KEY_ID);
      if (ids.has(id)) reader.fail(at(path, 'id'), 'duplicate');
      ids.add(id);
      const holder = readName(reader, raw, path, 'holder');
      const spki = reader.requiredText(raw, 'spki', path, BASE64);
      if (spki.length > 200) reader.fail(at(path, 'spki'), 'invalid');
      const fingerprint = reader.requiredText(raw, 'fingerprint', path, FINGERPRINT);
      const signs = reader.codes(raw, 'signs', path, SIGNED_KINDS, true) as SignedKind[] | undefined;
      return holder === undefined || signs === undefined ? undefined : { id, holder, spki, fingerprint, signs };
    },
    { nonEmpty: false },
  );
  return reader.problems.length > 0 ? { ok: false, problems: reader.problems } : { ok: true, value: keys };
}
