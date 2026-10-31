// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the stand-in receiving system reads in a delivery it opened (#590,
// answer 618): the teacher's term export, signed by the teacher's key over
// minhajna/signed-export/1 with the certificate's world, subject, public key
// and serial, as a week is signed under its own name, the certificate checked
// against the world's stand-in CA (stand-in-ca.ts); then the export itself,
// minhajna/term-export/1, for the world and for marks, with the school's ID,
// the term, the class, the subject's code, the day it was signed on the device,
// by the world's date (R-5.5-11), the scale, the official formula the averages
// follow or none, the parts by the core's codes (T, F, E, P, O), each once, and
// one row for each pupil, at most MAX_ROWS, each with its own registration
// number, a mark within the scale or absent for every part, since an export is
// sent only when ready (R-3.6-07), the average under a formula and none without
// one, and the appreciation, with no field beyond these. Marks may carry two
// decimals. The text is at most MAX_TEXT bytes. It keeps none of the export:
// the answer is a receipt, marked a stand-in's, that names no pupil, its ID an
// HMAC under the receiving key of the signing device and the text, which
// fingerprints nothing outside the server and gives the same export sent again
// the same receipt.

import { createHmac } from 'node:crypto';
import { caPublicKey, certificateText, ID, PUBLIC_KEY, SIGNATURE, signedBy } from '../worlds/stand-in-ca.js';
import { isDay } from '../worlds/world-rules.js';
import type { Receipt } from '../worlds/world-store.js';

export const MAX_ROWS = 80;
/** The longest export's text in UTF-8 bytes: more than any export of the shape below, and within the body, sealed. */
export const MAX_TEXT = 128 * 1024;
const CODE = /^[a-z0-9-]{1,32}$/;
/** The core's averages' parts (assessment.ts AVERAGE_PARTS) and formulas (FORMULAS), as the export names them. */
const PARTS: readonly unknown[] = ['T', 'F', 'E', 'P', 'O'];
const FORMULAS: readonly unknown[] = [
  'primary-examined',
  'primary-exam-only',
  'cem',
  'lycee',
  'lycee-practical',
  'lycee-oral',
];
const SCHOOL = /^[A-Za-z0-9-]{1,64}$/;
const REGISTRATION = /^[A-Za-z0-9-]{1,32}$/;
const SERIAL = /^[0-9a-f]{32}$/;
const CONTROL = /\p{Cc}|\p{Cf}/u;

type Fields = Record<string, unknown>;

/** Whether a value is an object with exactly these fields. */
export function hasOnly(value: unknown, fields: readonly string[]): value is Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => keys.includes(field));
}

/** Whether a value is a line of text of 1 to `most` characters with no control or format character. */
const isLine = (value: unknown, most: number): value is string =>
  typeof value === 'string' && value.length > 0 && [...value].length <= most && !CONTROL.test(value);

/** Whether a mark is a number within the scale, at most two decimals, or an absence. */
const isMark = (value: unknown, scale: number) =>
  value === 'absent' ||
  (typeof value === 'number' && value >= 0 && value <= scale && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6);

/** Whether a certificate is the world's stand-in CA's, shaped as it issues them. */
function certified(value: unknown, world: string, caKey: string): value is Fields {
  if (!hasOnly(value, ['standIn', 'world', 'subject', 'publicKey', 'issued', 'serial', 'signature'])) return false;
  const { standIn, subject, publicKey, issued, serial, signature } = value;
  const shaped =
    standIn === true &&
    value['world'] === world &&
    typeof subject === 'string' &&
    ID.test(subject) &&
    typeof publicKey === 'string' &&
    PUBLIC_KEY.test(publicKey) &&
    isDay(issued) &&
    typeof serial === 'string' &&
    SERIAL.test(serial) &&
    typeof signature === 'string' &&
    SIGNATURE.test(signature);
  if (!shaped) return false;
  const text = certificateText({ standIn: true, world, subject, publicKey, issued, serial });
  return signedBy(caPublicKey(caKey), text, signature);
}

/** The text a teacher's key signs for an export, as a week's is signed under its own name. */
export function exportText(
  certificate: { world: string; subject: string; publicKey: string; serial: string },
  text: string,
) {
  const { world, subject, publicKey, serial } = certificate;
  return `minhajna/signed-export/1\n${world}\n${subject}\n${publicKey}\n${serial}\n${text}`;
}

/** Why a term export's rows are refused, or null when each is a pupil's marks under the parts. */
function rowsProblem(rows: unknown, parts: readonly string[], scale: number, averaged: boolean): string | null {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) return `an export has 1 to ${MAX_ROWS} rows`;
  const seen = new Set<string>();
  for (const row of rows) {
    if (!hasOnly(row, ['registration', 'values', 'average', 'appreciation'])) {
      return 'a row has a registration number, values, an average and an appreciation, and nothing else';
    }
    const { registration, values, average, appreciation } = row;
    if (typeof registration !== 'string' || !REGISTRATION.test(registration) || seen.has(registration)) {
      return 'each row has its own registration number';
    }
    seen.add(registration);
    if (!hasOnly(values, parts) || !parts.every((part) => isMark(values[part], scale))) {
      return 'a row has a mark within the scale, or absent, for each part and no other';
    }
    if (averaged ? !(typeof average === 'number' && isMark(average, scale)) : average !== null) {
      return 'a row has an average within the scale under a formula, and none without one';
    }
    if (!isLine(appreciation, 200)) return 'a row has its appreciation';
  }
  return null;
}

/**
 * Reads what a device sealed for the stand-in, opened: the teacher's signed
 * term export for the world and kind, checked against the world's CA key, on
 * the world's date. Answers its receipt, its ID keyed with the receiving key,
 * or why it is refused.
 */
export function readDelivery(
  opened: Buffer,
  world: { readonly id: string; readonly date: string },
  keys: { readonly ca: string; readonly receiver: string },
): Receipt | string {
  const { id: worldId, date } = world;
  let signed: unknown;
  try {
    signed = JSON.parse(opened.toString('utf8'));
  } catch {
    return 'a delivery is a signed export written as JSON';
  }
  if (!hasOnly(signed, ['text', 'signature', 'certificate'])) {
    return 'a delivery has the export’s text, its signature and the signing key’s certificate, and nothing else';
  }
  const { text, signature, certificate } = signed;
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_TEXT) {
    return `an export’s text is at most ${MAX_TEXT} bytes`;
  }
  if (!certified(certificate, worldId, keys.ca)) return 'the signing key is not certified by the world’s stand-in CA';
  const key = certificate as { world: string; subject: string; publicKey: string; serial: string };
  if (typeof signature !== 'string' || !signedBy(key.publicKey, exportText(key, text), signature)) {
    return 'the export is not signed by the certified key';
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return 'an export’s text is JSON';
  }
  const fields = [
    'format',
    'world',
    'kind',
    'school',
    'term',
    'class',
    'subject',
    'signed',
    'scale',
    'formula',
    'parts',
    'rows',
  ];
  if (!hasOnly(body, fields) || body['format'] !== 'minhajna/term-export/1') {
    return `an export is minhajna/term-export/1 with ${fields.slice(1).join(', ')}, and nothing else`;
  }
  if (body['world'] !== worldId || body['kind'] !== 'marks') return 'an export names the world and kind it is sent as';
  const { school, term, subject, scale, formula, parts } = body;
  if (typeof school !== 'string' || !SCHOOL.test(school)) return 'an export names its school by ID';
  if (term !== 1 && term !== 2 && term !== 3) return 'an export’s term is 1, 2 or 3';
  if (!isLine(body['class'], 32) || typeof subject !== 'string' || !CODE.test(subject)) {
    return 'an export names its class and its subject’s code';
  }
  if (!isDay(body['signed']) || body['signed'] > date)
    return 'an export says the day it was signed, by the world’s date';
  if (typeof scale !== 'number' || !Number.isInteger(scale) || scale < 1 || scale > 100) {
    return 'an export’s scale is a whole number from 1 to 100';
  }
  if (formula !== null && !FORMULAS.includes(formula)) {
    return 'an export names the official formula its averages follow, or none';
  }
  const named = Array.isArray(parts) && parts.length > 0;
  if (!named || !parts.every((part) => PARTS.includes(part)) || new Set(parts).size < parts.length) {
    return 'an export names its parts among T, F, E, P and O, each once';
  }
  const problem = rowsProblem(body['rows'], parts as string[], scale, formula !== null);
  if (problem !== null) return problem;
  return {
    standIn: true,
    id: createHmac('sha256', keys.receiver).update(`${key.subject}\n${text}`).digest('hex').slice(0, 32),
    kind: 'marks',
    term,
    class: body['class'],
    subject,
    rows: (body['rows'] as unknown[]).length,
    signed: body['signed'],
    received: date,
    signer: key.subject,
  };
}
