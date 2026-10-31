// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a demo world's store keeps for each joining code this device scanned
// (#564, answer 581): the device's ID there, its signing key's private half
// and the certificate the world's CA gave it, kept before anything goes to
// the school, so a join cut short goes on with the same key and the weeks it
// signs later carry that certificate. A kept key is not yet a join: only the
// channel read back (readJoined) says whether this device's record came
// first. They are device-layer events in the world's store alone, so nothing
// exports or prints them, and they go with the store when the world is left
// for good. Of each code the first event that reads counts, as on the channel,
// so two joins made at once settle on one key; one that does not read is
// ignored.

import { isCertificate } from './certify.ts';
import type { SchoolJoined } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { ID } from './school-key-shape.ts';
import { readJoinCode } from './school-join.ts';
import { PKCS8_TEXT } from './world-keys.ts';

export type { SchoolJoined } from './device-events.ts';

/** A kept join as the store may hold it, or null when it does not read. */
export function readSchoolJoined(value: unknown): SchoolJoined | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { code, device, pkcs8, certificate, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || typeof code !== 'string' || typeof device !== 'string') return null;
  const read = readJoinCode(code);
  if (read === null || !ID.test(device) || typeof pkcs8 !== 'string' || !PKCS8_TEXT.test(pkcs8)) return null;
  if (!isCertificate(certificate) || certificate.subject !== device || certificate.world !== read.world) return null;
  return { code, device, pkcs8, certificate };
}

/** The keys this store holds for joining codes, one each, from the first `school.joined` event that reads for it. */
export function keptJoins(entries: readonly Entry[]): readonly SchoolJoined[] {
  const joins = new Map<string, SchoolJoined>();
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind !== 'school.joined') continue;
    const joined = readSchoolJoined(event.joined);
    if (joined !== null && !joins.has(joined.code)) joins.set(joined.code, joined);
  }
  return [...joins.values()];
}
