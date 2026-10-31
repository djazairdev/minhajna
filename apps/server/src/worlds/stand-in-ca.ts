// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo's stand-in CA (#554, answers 564 and 580): one ECDSA P-256 key, as
// the devices' own are, for each world, made the first time the world needs
// it, kept with the world and erased with it. It certifies a teacher's
// signing key, a P-256 key's SPKI in base64, as packages/core's
// certify.ts checks it: it rebuilds the same texts, and its tests check its
// certificates with the core's own code. It takes a request only when it
// names the world it was sent to and is signed by the key it names, which
// proves that the device holds that key and nothing about who holds the
// device: in the demo, anyone with the world's code acts in any role. Every
// certificate it issues says it is a stand-in's, on the world's date.

import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';

const ID = /^[0-9a-f]{32}$/;
const PUBLIC_KEY = /^MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE[A-Za-z0-9+/]{85}[AQgw]==$/;
/** The last group of padded base64 written the one way, every bit past the data a zero. */
const LAST_GROUP = '(?:[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=|[A-Za-z0-9+/][AQgw]==)?';
/** An ECDSA P-256 signature's DER, 8 to 72 bytes, in padded base64 written the one way. */
const SIGNATURE = new RegExp(`^(?=[A-Za-z0-9+/=]{12,96}$)(?![A-Za-z0-9+/]{10}==$)(?:[A-Za-z0-9+/]{4})+${LAST_GROUP}$`);

export interface CertificateRequest {
  readonly world: string;
  readonly subject: string;
  readonly publicKey: string;
  readonly signature: string;
}

export interface Certificate {
  readonly standIn: true;
  readonly world: string;
  readonly subject: string;
  readonly publicKey: string;
  readonly issued: string;
  readonly serial: string;
  readonly signature: string;
}

function requestText({ world, subject, publicKey }: CertificateRequest): string {
  return `minhajna/certificate-request/1\n${world}\n${subject}\n${publicKey}`;
}

function certificateText(certificate: Omit<Certificate, 'signature'>): string {
  const { world, subject, publicKey, issued, serial } = certificate;
  return `minhajna/certificate/1\nstand-in\n${world}\n${subject}\n${publicKey}\n${issued}\n${serial}`;
}

/** A new CA key, as the store keeps it: its PKCS #8 DER in base64. */
export function newCaKey(): string {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
}

function privateKeyOf(key: string) {
  return createPrivateKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'pkcs8' });
}

/** The CA key's public half, its SPKI in base64, as devices check certificates against it. */
export function caPublicKey(key: string): string {
  return createPublicKey(privateKeyOf(key)).export({ format: 'der', type: 'spki' }).toString('base64');
}

function signedBy(publicKey: string, text: string, signature: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    return verify('sha256', Buffer.from(text, 'utf8'), key, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

/** The request in a body sent to the world, or why it is refused. */
export function readCertificateRequest(body: unknown, world: string): CertificateRequest | string {
  const fields = ['world', 'subject', 'publicKey', 'signature'];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'a request is an object';
  const keys = Object.keys(body);
  if (keys.length !== fields.length || !fields.every((field) => keys.includes(field))) {
    return 'a request has a world, a subject, a public key and a signature, and nothing else';
  }
  const request = body as Record<string, unknown>;
  if (request['world'] !== world) return 'a request names the world it is sent to';
  const { subject, publicKey, signature } = request;
  if (typeof subject !== 'string' || !ID.test(subject)) return 'a subject is a device ID';
  if (typeof publicKey !== 'string' || !PUBLIC_KEY.test(publicKey)) return 'a public key is a P-256 SPKI in base64';
  if (typeof signature !== 'string' || !SIGNATURE.test(signature)) return 'a signature is ECDSA DER in base64';
  const read = { world, subject, publicKey, signature };
  return signedBy(publicKey, requestText(read), signature) ? read : 'the request is not signed by the key it names';
}

/** The certificate the world's stand-in CA issues for a request it read, on the world's date. */
export function issueCertificate(request: CertificateRequest, issued: string, key: string): Certificate {
  const { world, subject, publicKey } = request;
  const serial = randomBytes(16).toString('hex');
  const unsigned = { standIn: true as const, world, subject, publicKey, issued, serial };
  const signature = sign('sha256', Buffer.from(certificateText(unsigned), 'utf8'), privateKeyOf(key)).toString(
    'base64',
  );
  return { ...unsigned, signature };
}
