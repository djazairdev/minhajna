// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's own devices and backups in the pilot (#247, Devices-pilot,
// Recovery-sheet, answer 478). Their events belong to the device layer, so
// they never leave the phone: not in an archive, a backup or a transfer
// file. The recovery key is kept so that later backups ask nothing and the
// sheet prints again; a new sheet erases the content of the keys before it.
// A backup keeps only its fact and day, read by the devices page, the log,
// the erase screen and the 30-day reminder (answer 482): due 30 days after
// the last backup, or after the first change when there is none, and never
// before the day it was put off to, by «تذكيري لاحقاً» or a restore. A
// working copy handed to the other device (answer 503) keeps the day and
// the last entry it held, until the copy comes back or the teacher takes
// over here.

import { addDays, maxDay, type Day } from './day.ts';
import { eventOf, type RecordEvent } from './events.ts';
import { ERASURE, type Entry } from './history.ts';
import { readRecoveryKey } from './recovery-key.ts';

export { DEVICE_KINDS, type DeviceEvent } from './device-events.ts';

/** Days without a backup before the reminder, and the days «تذكيري لاحقاً» and a restore put it off. */
export const BACKUP_REMINDER_DAYS = 30;
export const BACKUP_LATER_DAYS = 7;

export interface DeviceFacts {
  /** The recovery key confirmed last, and its day; null when none is kept. */
  readonly recovery: { readonly key: string; readonly day: Day } | null;
  /** The entries of earlier keys whose content is still kept, which a new sheet erases. */
  readonly earlierKeys: readonly string[];
  /** The day of the last backup saved, or null. */
  readonly lastBackup: Day | null;
  /** The entries recorded after the last backup, which no backup holds; all of them when there is none. */
  readonly sinceBackup: number;
  /** The day of the first change of any kind, from which the reminder counts without a backup. */
  readonly firstChange: Day | null;
  /** The working copy on the other device: since when, and the hash of the last entry it held; null when here. */
  readonly handedOver: { readonly day: Day; readonly last: string } | null;
}

/** A hash as the history writes it: SHA-256 in lowercase hex. */
const HASH = /^[0-9a-f]{64}$/u;

function keyOf(event: RecordEvent | null): string | null {
  if (event?.kind !== 'recovery.set') return null;
  const key: unknown = event.recovery?.key;
  return typeof key === 'string' && readRecoveryKey(key) === key ? key : null;
}

/** What the devices page, the recovery sheet and the reminder read from the history. */
export function deviceFacts(entries: readonly Entry[]): DeviceFacts {
  let recovery: DeviceFacts['recovery'] = null;
  let lastBackup: Day | null = null;
  let sinceBackup = 0;
  let handedOver: DeviceFacts['handedOver'] = null;
  const keys: Entry[] = [];
  for (const entry of entries) {
    const event = eventOf(entry);
    const key = keyOf(event);
    if (key !== null) {
      recovery = { key, day: entry.day };
      keys.push(entry);
    }
    sinceBackup += 1;
    if (event?.kind === 'backup.saved') {
      lastBackup = entry.day;
      sinceBackup = 0;
    }
    if (event?.kind === 'handover.sent') {
      const last: unknown = event.handover?.last;
      handedOver = typeof last === 'string' && HASH.test(last) ? { day: entry.day, last } : handedOver;
    }
    if (event?.kind === 'handover.ended') handedOver = null;
  }
  const current = recovery?.key;
  const earlierKeys = keys.filter((entry) => keyOf(eventOf(entry)) !== current).map((entry) => entry.id);
  const first = entries.find((entry) => entry.kind !== ERASURE);
  return { recovery, earlierKeys, lastBackup, sinceBackup, firstChange: first?.day ?? null, handedOver };
}

/** The day the backup reminder falls due, never before `later`, the day it was put off to; null before any change. */
export function backupReminderDay(facts: DeviceFacts, later: Day | null): Day | null {
  const from = facts.lastBackup ?? facts.firstChange;
  if (from === null) return null;
  const due = addDays(from, BACKUP_REMINDER_DAYS);
  return later === null ? due : maxDay(due, later);
}
