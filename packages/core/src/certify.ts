// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Teachers' signing keys and the demo's stand-in CA (#554, PRD §5.5, choice
// D9 of the 0.7.0 demo). The teacher's signing key is made on the device and
// never leaves it: the device asks the CA to certify its public key, proving
// it holds the key by signing the request, and the stand-in CA in the demo
// server, which holds its own key for each world and nothing else, answers
// with a certificate marked as a stand-in's, so no screen can show it as the
// state's. A signed week carries the teacher's signature over its text and
// the certificate; it checks against the world's CA key, which the app takes
// from the world it joined. The demo server is the CA and hands out its key,
// so in the demo a signature proves nothing against the server: it could
// certify a key of its own for any device, which is what "stand-in" means on
// every screen. A request proves only that the device holds its key; in the
// demo anyone with the world's code acts in any role, so the stand-in
// certifies the device a request names, and the state's CA must bind it to an
// identity it checked (answer 564). The signing itself is the platform's
// ECDSA P-256 over a text's UTF-8 bytes, as for signed files, since Android's
// platform has Ed25519 only from API 33 (answer 580), injected as `KeySigner`
// and `KeyChecker`, with each key's SPKI and each signature's DER in base64;
// the drawn signature on paper documents is signature.ts and has nothing to
// do with this.

import { isDay, type Day } from './day.ts';
import { ID } from './school-key-shape.ts';
import { utf8Length, type Verifier } from './signed-read.ts';
import { isWorldId } from './world-code.ts';

export interface KeyChecker {
  /** Whether `signature` is an ECDSA P-256 signature of the text's UTF-8 bytes under `publicKey`; a throw is a no. */
  readonly verify: Verifier;
}

/** The device's own signing key, which never leaves it. */
export interface KeySigner extends KeyChecker {
  readonly publicKey: string;
  readonly sign: (text: string) => Promise<string>;
}

/** What a device sends the CA: the world, its ID, its public key, and its signature over them. */
export interface CertificateRequest {
  readonly world: string;
  readonly subject: string;
  readonly publicKey: string;
  readonly signature: string;
}

export interface Certificate {
  /** Every certificate in the demo is a stand-in's, never the state's. */
  readonly standIn: true;
  /** The world whose stand-in CA issued it. */
  readonly world: string;
  readonly subject: string;
  readonly publicKey: string;
  /** The world's date when it was issued. */
  readonly issued: Day;
  readonly serial: string;
  readonly signature: string;
}

/** A week's text as the teacher signed it, with the signature and the certificate it checks against. */
export interface SignedWeek {
  readonly text: string;
  readonly signature: string;
  readonly certificate: Certificate;
}

export type SignedWeekProblem = 'uncertified' | 'forged';

/** A P-256 public key's SPKI, DER in base64, written the one way its 91 bytes encode. */
const PUBLIC_KEY = /^MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE[A-Za-z0-9+/]{85}[AQgw]==$/u;
/** The last group of padded base64 written the one way, every bit past the data a zero. */
const LAST_GROUP = '(?:[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=|[A-Za-z0-9+/][AQgw]==)?';
/** An ECDSA P-256 signature's DER, 8 to 72 bytes, in padded base64 written the one way. */
const SIGNATURE = new RegExp(
  `^(?=[A-Za-z0-9+/=]{12,96}$)(?![A-Za-z0-9+/]{10}==$)(?:[A-Za-z0-9+/]{4})+${LAST_GROUP}$`,
  'u',
);

function hasOnly(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => keys.includes(field));
}

const test = (value: unknown, form: RegExp): value is string => typeof value === 'string' && form.test(value);

/** Whether a value is a signing key as certificates name it: a P-256 key's SPKI in base64. */
export function isSigningKey(value: unknown): value is string {
  return test(value, PUBLIC_KEY);
}

/** What a device signs to ask for a certificate. */
export function requestText(world: string, subject: string, publicKey: string): string {
  return `minhajna/certificate-request/1\n${world}\n${subject}\n${publicKey}`;
}

/** What the CA signs: every field of the certificate but its signature. */
export function certificateText(certificate: Omit<Certificate, 'signature'>): string {
  const { world, subject, publicKey, issued, serial } = certificate;
  return `minhajna/certificate/1\nstand-in\n${world}\n${subject}\n${publicKey}\n${issued}\n${serial}`;
}

function weekText(certificate: Certificate, text: string): string {
  const { world, subject, publicKey, serial } = certificate;
  return `minhajna/signed-week/1\n${world}\n${subject}\n${publicKey}\n${serial}\n${text}`;
}

/** A request for the device's signing key to be certified in a world. */
export async function certificateRequest(
  world: string,
  subject: string,
  signer: KeySigner,
): Promise<CertificateRequest> {
  if (!isWorldId(world) || !ID.test(subject) || !PUBLIC_KEY.test(signer.publicKey)) {
    throw new RangeError('A request names a world, a device and its key');
  }
  const { publicKey } = signer;
  return { world, subject, publicKey, signature: await signer.sign(requestText(world, subject, publicKey)) };
}

/** Whether a request has exactly the shape of one and is signed by the key it names. */
export async function checkRequest(value: unknown, checker: KeyChecker): Promise<boolean> {
  if (!hasOnly(value, ['world', 'subject', 'publicKey', 'signature'])) return false;
  const { world, subject, publicKey, signature } = value;
  if (!isWorldId(world) || !test(subject, ID) || !test(publicKey, PUBLIC_KEY) || !test(signature, SIGNATURE)) {
    return false;
  }
  return checker.verify(publicKey, requestText(world, subject, publicKey), signature).catch(() => false);
}

/** Whether a value has exactly the shape of a certificate. */
export function isCertificate(value: unknown): value is Certificate {
  if (!hasOnly(value, ['standIn', 'world', 'subject', 'publicKey', 'issued', 'serial', 'signature'])) return false;
  const { standIn, world, subject, publicKey, issued, serial, signature } = value;
  if (standIn !== true || !isWorldId(world) || !test(subject, ID) || !test(publicKey, PUBLIC_KEY)) return false;
  return typeof issued === 'string' && isDay(issued) && test(serial, ID) && test(signature, SIGNATURE);
}

/** Whether a certificate is the world's CA's, for that world. */
export async function checkCertificate(
  value: unknown,
  world: string,
  caKey: string,
  checker: KeyChecker,
): Promise<boolean> {
  if (!isCertificate(value) || value.world !== world) return false;
  return checker.verify(caKey, certificateText(value), value.signature).catch(() => false);
}

/**
 * The certificate the world's stand-in CA issues for a request it checked,
 * on the world's date. The request proves only that the device holds its
 * key; a CA that is not a stand-in issues it only once it has checked, by
 * other means, that the request comes from the device it names.
 */
export async function issueCertificate(
  request: CertificateRequest,
  issued: Day,
  serial: string,
  ca: KeySigner,
): Promise<Certificate> {
  if (!(await checkRequest(request, ca)) || !isDay(issued) || !ID.test(serial)) {
    throw new RangeError('Not a request the stand-in CA certifies');
  }
  const { world, subject, publicKey } = request;
  const unsigned = { standIn: true as const, world, subject, publicKey, issued, serial };
  return { ...unsigned, signature: await ca.sign(certificateText(unsigned)) };
}

/** A week's text signed on the teacher's device, with the certificate of its key. */
export async function signWeek(text: string, certificate: Certificate, signer: KeySigner): Promise<SignedWeek> {
  if (certificate.publicKey !== signer.publicKey) throw new RangeError('The certificate is for another key');
  if (utf8Length(text) === null) throw new RangeError('A week’s text holds whole characters only');
  return { text, signature: await signer.sign(weekText(certificate, text)), certificate };
}

/**
 * Checks a signed week against the world's CA key: 'uncertified' when its
 * certificate is not the world's CA's, 'forged' when it is not shaped as one
 * or the signature does not check; otherwise the week, whose certificate is
 * a stand-in's, as every screen that shows it says.
 */
export async function checkSignedWeek(
  value: unknown,
  world: string,
  caKey: string,
  checker: KeyChecker,
): Promise<SignedWeek | SignedWeekProblem> {
  if (!hasOnly(value, ['text', 'signature', 'certificate'])) return 'forged';
  const { text, signature, certificate } = value;
  if (typeof text !== 'string' || utf8Length(text) === null || !test(signature, SIGNATURE)) return 'forged';
  if (!(await checkCertificate(certificate, world, caKey, checker))) return 'uncertified';
  const certified = certificate as Certificate;
  const signed = await checker.verify(certified.publicKey, weekText(certified, text), signature).catch(() => false);
  return signed ? { text, signature, certificate: certified } : 'forged';
}
