// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signed statement envelope 1.0 (#436, R-5.5-07): format, version, spki
// (base64 DER public key), payload (the exact UTF-8 statement text), and
// signature (base64 DER ECDSA P-256/SHA-256 over that text). The platform's
// Verifier checks the key and signature before any payload is parsed.
// Unlike project reference updates, these are self-signed: a valid result
// says nothing about identity, known-key continuity, state certification or
// legal status. Reader mode must check identity and key changes separately.
// The payload never includes the recipient or the local sharing history.

import { canonicalJson } from './canonical.ts';
import { isFields } from './read.ts';
import { readVersion, utf8Length, type Verifier } from './signed-read.ts';
import {
  readStatement,
  statementPayload,
  STATEMENT_BYTES,
  STATEMENT_FORMAT,
  type ProgressStatement,
} from './statement-read.ts';

/** The signed envelope is distinct from trusted reference-data updates. */
export const SIGNED_STATEMENT_FORMAT = 'minhajna.signed-statement';

/** Version 25-M has 1,000 data codewords: 12 ECI bits + 20 byte-header bits leave 996 UTF-8 bytes. */
export const STATEMENT_QR_LIMIT = 996;

/** Signature validity is not proof of the signer's identity or legal authority. */
export type StatementCheck =
  | { readonly ok: true; readonly statement: ProgressStatement; readonly spki: string }
  | { readonly ok: false; readonly problem: 'invalid' | 'version' | 'signature' | 'payload' };

const BASE64 = /^(?:[A-Za-z0-9+/]{4})+$|^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;

function encoded(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && BASE64.test(value);
}

/** Whether the entire signed text fits one byte-mode, UTF-8 ECI QR, M, at version 25 or smaller. */
export function fitsInQr(text: string): boolean {
  if (typeof text !== 'string') return false;
  const bytes = text.length > STATEMENT_QR_LIMIT ? null : utf8Length(text);
  return bytes !== null && bytes > 0 && bytes <= STATEMENT_QR_LIMIT;
}

/**
 * Whether a statement's signed file will fit one QR code, known before it is signed (answer 486): a P-256 key's
 * SPKI is always 124 base64 characters, and its signature is taken at its longest, 96, so a statement said to fit
 * always does.
 */
export function statementFitsInQr(statement: ProgressStatement): boolean {
  const longest = { spki: 'A'.repeat(124), signature: 'A'.repeat(96) };
  const payload = statementPayload(statement);
  return fitsInQr(
    canonicalJson({ format: SIGNED_STATEMENT_FORMAT, version: { major: 1, minor: 0 }, payload, ...longest }),
  );
}

/** Signs one detached, allowlisted payload with a platform callback; never creates or exports a private key. */
export async function signStatement(
  statement: ProgressStatement,
  spki: string,
  sign: (payload: string) => Promise<string>,
): Promise<string> {
  if (!encoded(spki, 200)) throw new TypeError('Invalid statement public key');
  const payload = statementPayload(statement);
  let signature: string;
  try {
    signature = await sign(payload);
  } catch {
    throw new Error('Statement signing failed');
  }
  if (!encoded(signature, 96)) throw new TypeError('Invalid statement signature');
  const text = canonicalJson({
    format: SIGNED_STATEMENT_FORMAT,
    version: { major: 1, minor: 0 },
    spki,
    payload,
    signature,
  });
  if (utf8Length(text)! > STATEMENT_BYTES) throw new RangeError('Signed statement exceeds size limit');
  return text;
}

/** Whether a payload is a statement of a later major version, which an update of the app may read. */
function newer(payload: string): boolean {
  try {
    const raw: unknown = JSON.parse(payload);
    return isFields(raw) && raw['format'] === STATEMENT_FORMAT && (readVersion(raw['version'])?.major ?? 0) > 1;
  } catch {
    return false;
  }
}

/** Verifies original bytes before reading the payload; returns fixed, content-free failures. */
export async function checkStatement(text: string, verify: Verifier): Promise<StatementCheck> {
  if (typeof text !== 'string') return { ok: false, problem: 'invalid' };
  const bytes = text.length > STATEMENT_BYTES ? null : utf8Length(text);
  if (bytes === null || bytes > STATEMENT_BYTES) return { ok: false, problem: 'invalid' };
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  if (!isFields(raw) || raw['format'] !== SIGNED_STATEMENT_FORMAT) return { ok: false, problem: 'invalid' };
  if (readVersion(raw['version'])?.major !== 1) return { ok: false, problem: 'version' };
  const { spki, payload, signature } = raw;
  if (
    !encoded(spki, 200) ||
    !encoded(signature, 96) ||
    typeof payload !== 'string' ||
    payload === '' ||
    utf8Length(payload) === null
  )
    return { ok: false, problem: 'invalid' };
  let valid: boolean;
  try {
    valid = await verify(spki, payload, signature);
  } catch {
    return { ok: false, problem: 'signature' };
  }
  if (!valid) return { ok: false, problem: 'signature' };
  const read = readStatement(payload);
  return read.ok
    ? { ok: true, statement: read.value, spki }
    : { ok: false, problem: newer(payload) ? 'version' : 'payload' };
}
