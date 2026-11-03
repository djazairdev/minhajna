// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A cut room's decider's key on a key holder's device (#601, answer 632): the
// P-256 pair its seed gives (deciderSeed), made as a recovery's is
// (recovery-device.ts), named as certificates name a key, its SPKI in base64,
// and certified by the world's CA for this device the first time it signs in a
// world, kept in memory only. A seed's public key is worked out once, as the
// curve's arithmetic runs in JavaScript.

import { toBase64Url, toHex } from '@minhajna/core';
import { seededPair } from '../demo/recovery-device';
import type { Send, WorldKit } from '../demo/world-session';
import type { IssueDesk } from '../director/school-desk';
import { fromHex } from '../storage/history';
import { certify, type Signing } from '../timetable/send-session';

/** The DER head of a P-256 public key's SPKI, before its uncompressed point. */
const SPKI_HEAD = '3059301306072a8648ce3d020106082a8648ce3d030107034200';
/** The deciders' certified keys, by world, device and seed, in memory only. */
const deciders = new Map<string, Promise<Signing>>();
/** Each seed's public key, by the seed in hex. */
const publicKeys = new Map<string, string>();

/** A P-256 point in hex as certificates name a key: its SPKI in base64. */
export function spkiOf(point: string): string {
  const text = toBase64Url(fromHex(`${SPKI_HEAD}${point}`))
    .replace(/-/gu, '+')
    .replace(/_/gu, '/');
  return text.padEnd(Math.ceil(text.length / 4) * 4, '=');
}

/** The public key, as certificates name it, of the decider a seed gives. */
export function deciderKey(seed: Uint8Array): string {
  const at = toHex(seed);
  const known = publicKeys.get(at) ?? spkiOf(seededPair(seed).publicKey);
  publicKeys.set(at, known);
  return known;
}

/** The decider's key a seed gives, certified for this device. */
export function deciderSigning(
  world: string,
  desk: IssueDesk,
  seed: Uint8Array,
  ca: string,
  kit: WorldKit,
  send: Send,
): Promise<Signing> {
  const at = JSON.stringify([world, desk.held.device, toHex(seed)]);
  const made = () => {
    const pair = seededPair(seed);
    return certify(world, desk.held.device, ca, kit, send, { spki: spkiOf(pair.publicKey), pkcs8: pair.pkcs8 });
  };
  const kept = deciders.get(at) ?? made();
  deciders.set(at, kept);
  kept.catch(() => deciders.delete(at));
  return kept;
}
