// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The device layer's events of the pilot's backups (#247, answer 478), of the
// working copy handed to the teacher's other device and back (#250, answers 503
// and 514), of the PC web app's updates (R-6.6-06), and of where a restored
// copy came from (#251, answer 525), of the demo world a store belongs to
// (#560, answer 573) and of the schools joined in it (#564, answer 581), apart
// from devices.ts, world-kept.ts and school-joined.ts, which read them, so the
// events module imports no module that imports it back.

import type { Certificate } from './certify.ts';
import type { WorldKind } from './world-keys.ts';

export type DeviceEvent =
  /** The recovery key the teacher printed or wrote, then typed back to confirm it (answer 478). */
  | { readonly kind: 'recovery.set'; readonly recovery: { readonly key: string } }
  /** A backup saved through the file picker: only the fact and its day. */
  | { readonly kind: 'backup.saved' }
  /** The other device opened a direct transfer, as the teacher confirmed: the hash of the last entry it held. */
  | { readonly kind: 'handover.sent'; readonly handover: { readonly last: string } }
  /** This device works again: the copy came back from the other device, or the teacher took over here. */
  | { readonly kind: 'handover.ended'; readonly handover: { readonly how: 'back' | 'taken' } }
  /** The PC web app installed an update the teacher accepted: its version and build checksum. */
  | { readonly kind: 'app.updated'; readonly updated: { readonly version: string; readonly build: string } }
  /** A copy restored into the empty history, by its route only: never the file, a key or the other device. */
  | { readonly kind: 'copy.received'; readonly received: { readonly from: CopyRoute } }
  /** In a demo world's own store: its kind and code, and the starter token where the world was started. */
  | { readonly kind: 'world.kept'; readonly kept: WorldKept }
  /** In a demo world's own store: the key this device keeps for a school's joining code. */
  | { readonly kind: 'school.joined'; readonly joined: SchoolJoined };

/** A demo world's own facts, kept only in its store (answer 572). */
export interface WorldKept {
  readonly kind: WorldKind;
  readonly code: string;
  readonly starter: string | null;
}

/** A joining code scanned in a demo world, as scanned, with this device's ID there, its signing key and certificate. */
export interface SchoolJoined {
  readonly code: string;
  readonly device: string;
  /** The signing key's private half, PKCS #8 DER in base64, which never leaves the world's store. */
  readonly pkcs8: string;
  readonly certificate: Certificate;
}

/** A restore's routes: a transfer from the other device, a backup, or an export. */
export type CopyRoute = 'phone' | 'backup' | 'archive';

/** Whether a kept route is one of a restore's; anything else is ignored. */
export const isCopyRoute = (from: unknown): from is CopyRoute =>
  from === 'phone' || from === 'backup' || from === 'archive';

export const DEVICE_KINDS = {
  'recovery.set': true,
  'backup.saved': true,
  'handover.sent': true,
  'handover.ended': true,
  'app.updated': true,
  'copy.received': true,
  'world.kept': true,
  'school.joined': true,
} as const;

export const isDeviceEvent = (event: { readonly kind: string }): event is DeviceEvent =>
  Object.hasOwn(DEVICE_KINDS, event.kind);
