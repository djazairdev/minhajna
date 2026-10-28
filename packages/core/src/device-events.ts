// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The device layer's events of the pilot's backups (#247, answer 478), of
// the working copy handed to the teacher's other device and back (#250,
// answers 503 and 514), and of the PC web app's updates (R-6.6-06), apart
// from devices.ts, which reads them, so the events module imports no module
// that imports it back.

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
  | { readonly kind: 'app.updated'; readonly updated: { readonly version: string; readonly build: string } };

export const DEVICE_KINDS = {
  'recovery.set': true,
  'backup.saved': true,
  'handover.sent': true,
  'handover.ended': true,
  'app.updated': true,
} as const;

export const isDeviceEvent = (event: { readonly kind: string }): event is DeviceEvent =>
  Object.hasOwn(DEVICE_KINDS, event.kind);
