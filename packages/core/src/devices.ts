// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's own devices and backups in the pilot (#247, Devices-pilot,
// Recovery-sheet, answer 478). Both events belong to the device layer, so they
// never leave the phone: not in an archive, a backup or a transfer file. The
// recovery key is kept so that later backups ask nothing and the sheet prints
// again; a new sheet erases the content of the keys before it. A backup keeps
// only its fact and day, read by the devices page, the log and the 30-day
// reminder (answer 482): due 30 days after the last backup, or after the first
// change when there is none, and never before the day it was put off to, by
// «تذكيري لاحقاً» or a restore.

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
  /** The day of the first change of any kind, from which the reminder counts without a backup. */
  readonly firstChange: Day | null;
}

function keyOf(event: RecordEvent | null): string | null {
  if (event?.kind !== 'recovery.set') return null;
  const key: unknown = event.recovery?.key;
  return typeof key === 'string' && readRecoveryKey(key) === key ? key : null;
}

/** What the devices page, the recovery sheet and the reminder read from the history. */
export function deviceFacts(entries: readonly Entry[]): DeviceFacts {
  let recovery: DeviceFacts['recovery'] = null;
  let lastBackup: Day | null = null;
  const keys: Entry[] = [];
  for (const entry of entries) {
    const event = eventOf(entry);
    const key = keyOf(event);
    if (key !== null) {
      recovery = { key, day: entry.day };
      keys.push(entry);
    }
    if (event?.kind === 'backup.saved') lastBackup = entry.day;
  }
  const current = recovery?.key;
  const earlierKeys = keys.filter((entry) => keyOf(eventOf(entry)) !== current).map((entry) => entry.id);
  const first = entries.find((entry) => entry.kind !== ERASURE);
  return { recovery, earlierKeys, lastBackup, firstChange: first?.day ?? null };
}

/** The day the backup reminder falls due, never before `later`, the day it was put off to; null before any change. */
export function backupReminderDay(facts: DeviceFacts, later: Day | null): Day | null {
  const from = facts.lastBackup ?? facts.firstChange;
  if (from === null) return null;
  const due = addDays(from, BACKUP_REMINDER_DAYS);
  return later === null ? due : maxDay(due, later);
}
