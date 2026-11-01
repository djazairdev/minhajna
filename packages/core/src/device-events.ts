// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The device layer's events of the pilot's backups (#247, answer 478), of the
// working copy handed to the teacher's other device and back (#250, answers 503
// and 514), of the PC web app's updates (R-6.6-06), and of where a restored
// copy came from (#251, answer 525), of the demo world a store belongs to
// (#560, answer 573), of the schools joined in it (#564, answer 581), and of
// the school key a director's device holds there and the codes and security
// keys it issues (#570, answer 596), of a device waiting to be admitted to it
// (#571, answer 600), and of the versions of the school's timetable it
// publishes (#578, answer 606), of the sessions its director marks for cover
// (#586, answer 614), and of the substitutes' appointments it records (#587,
// answer 615), and of the school's choice to send absences (#592, answer 620),
// and of the key pair an inspector's device keeps in a world and the grant
// requests a directorate makes there (#593, answer 621), and of the spot-check
// sheet an inspector's device keeps for a grant (#594, answer 622), and of the
// Ministry's draft of a calendar update (#607, answer 623), apart from
// devices.ts, world-kept.ts, school-joined.ts, school-issue.ts,
// school-holder.ts, school-timetable.ts, school-cover.ts,
// school-substitution.ts, school-exchange.ts, directorate-space.ts,
// grant-request.ts, spot-sheet.ts and calendar-draft.ts, which read them, so
// the events module imports no module that imports it back.

import type { Certificate } from './certify.ts';
import type { Day } from './day.ts';
import type { CalendarEntry } from './reference.ts';
import type { SchoolKeyring } from './school-key-shape.ts';
import type { ImportedSession } from './timetable-import.ts';
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
  | { readonly kind: 'school.joined'; readonly joined: SchoolJoined }
  /** In a demo world's own store: this device's place in a school's key, and the keyring as it holds it. */
  | { readonly kind: 'school.held'; readonly held: SchoolHeld }
  /** In a demo world's own store: a joining code or a security key this device issued for an assignment. */
  | { readonly kind: 'school.issued'; readonly issued: SchoolIssued }
  /** In a demo world's own store: this device waiting to be admitted to a school's key, or null once it gave up. */
  | { readonly kind: 'school.waiting'; readonly waiting: SchoolWaiting | null }
  /** In a demo world's own store: a version of a school's timetable this device published (answer 606). */
  | { readonly kind: 'school.timetable'; readonly published: TimetablePublished }
  /** In a demo world's own store: a session the director marked for cover on a day, and how it is covered. */
  | { readonly kind: 'school.cover'; readonly cover: SchoolCover }
  /** In a demo world's own store: a substitute's appointment the director recorded, and its end once recorded. */
  | { readonly kind: 'school.substitution'; readonly substitution: SchoolSubstitution }
  /** In a demo world's own store: whether the school sends absences to the sector's system (answer 620). */
  | { readonly kind: 'school.absences'; readonly absences: SchoolAbsences }
  /** In a demo world's own store: the key pair this device keeps as an inspector there (answer 621). */
  | { readonly kind: 'inspector.device'; readonly inspector: InspectorDevice }
  /** In a demo world's own store: a grant request this device made as a directorate (answer 621). */
  | { readonly kind: 'grant.requested'; readonly requested: GrantRequested }
  /** In a demo world's own store: the spot-check sheet an inspector's phone keeps for a grant (answer 622). */
  | { readonly kind: 'inspector.sheet'; readonly sheet: SpotSheet }
  /** In a demo world's own store: the Ministry's draft of a calendar update, never sent (answer 623). */
  | { readonly kind: 'ministry.calendar'; readonly draft: CalendarDraft };

/** A school's key as a device holding it keeps it: its ID, its agreement pair, and the keyring (answer 596). */
export interface SchoolHeld {
  readonly school: string;
  readonly device: string;
  /** The agreement pair's public half, in hex, as the keyring names the device. */
  readonly publicKey: string;
  /** Its private half, PKCS #8 DER in base64, which never leaves the world's store. */
  readonly pkcs8: string;
  readonly ring: SchoolKeyring;
  /** Set when the device took the school's key seeded with its world (#548), never when it started or was added. */
  readonly seeded?: true;
}

/** A device waiting to hold a school's key: its ID, its agreement pair and the secret its QR code shows. */
export interface SchoolWaiting {
  readonly device: string;
  readonly publicKey: string;
  /** Its private half, PKCS #8 DER in base64, which never leaves the world's store. */
  readonly pkcs8: string;
  readonly secret: string;
}

/** A joining code issued for an assignment, or a security key given instead (answer 596); the code is not kept. */
export interface SchoolIssued {
  readonly school: string;
  readonly assignment: string;
  /** 1, then one more for each code or key that replaces the last. */
  readonly issue: number;
  /** The school key's epoch the code was made under. */
  readonly epoch: number;
  readonly access: 'phone' | 'key';
  /** The security key's four-digit number, or null for a code. */
  readonly keyNumber: string | null;
}

/** A version of a school's timetable as published: its number, first day, whether for one day, and its sessions. */
export interface TimetablePublished {
  readonly school: string;
  /** 1, then one more for each version published. */
  readonly version: number;
  readonly from: Day;
  readonly once: boolean;
  /** The timetable's sessions as read or entered, without the rows they were read from. */
  readonly sessions: readonly Omit<ImportedSession, 'row'>[];
}

/** How a session needing cover is covered (R-7.7-04): supervision by default. */
export type CoverArrangement = 'supervision' | 'study' | 'merge' | 'swap' | 'colleague' | 'release';

/** A session marked for cover on a day, by its ID in the school's space, or unmarked; never a reason (answer 614). */
export interface SchoolCover {
  readonly school: string;
  readonly day: Day;
  readonly session: string;
  /** How it is covered, or null once unmarked. */
  readonly arrangement: CoverArrangement | null;
  /** The staff list's ID of the person who takes it, or null. */
  readonly by: string | null;
}

/** A substitute's appointment as the director records it: the directorate's decision, for the holder's classes. */
export interface SchoolSubstitution {
  readonly school: string;
  readonly id: string;
  /** The holder's and the substitute's staff list IDs. */
  readonly holder: string;
  readonly substitute: string;
  /** The directorate's decision reference, as written. */
  readonly decision: string;
  readonly classes: readonly string[];
  readonly from: Day;
  /** The timetable version that passed the classes over. */
  readonly version: number;
  /** The day the holder returned, or null while the appointment lasts. */
  readonly ended: Day | null;
}

/** The school's choice to send absences to the sector's system, by its space; never a clock time (answer 620). */
export interface SchoolAbsences {
  readonly school: string;
  readonly send: boolean;
}

/** An inspector's device in a world: its ID and its agreement pair, which grants are sealed for (answer 621). */
export interface InspectorDevice {
  readonly device: string;
  /** The agreement pair's public half, in hex, as the inspector's key is posted. */
  readonly publicKey: string;
  /** Its private half, PKCS #8 DER in base64, which never leaves the world's store. */
  readonly pkcs8: string;
}

/** An inspector's spot-check sheet for a grant: the days drawn, and the notes, never sent (answer 622). */
export interface SpotSheet {
  readonly grant: string;
  readonly days: readonly Day[];
  readonly notes: string;
  /** What the pupils' exercise books show, by the key of a drawn day's row. */
  readonly books: readonly { readonly row: string; readonly note: string }[];
}

/** The Ministry's draft of a calendar update: the entries it adds or changes, and the IDs it takes out. */
export interface CalendarDraft {
  readonly entries: readonly CalendarEntry[];
  readonly removed: readonly string[];
}

/** A grant request a directorate made, as grant-request.ts reads it. */
export interface GrantRequested {
  readonly request: unknown;
}

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
  'school.held': true,
  'school.issued': true,
  'school.waiting': true,
  'school.timetable': true,
  'school.cover': true,
  'school.substitution': true,
  'school.absences': true,
  'inspector.device': true,
  'grant.requested': true,
  'inspector.sheet': true,
  'ministry.calendar': true,
} as const;

export const isDeviceEvent = (event: { readonly kind: string }): event is DeviceEvent =>
  Object.hasOwn(DEVICE_KINDS, event.kind);
