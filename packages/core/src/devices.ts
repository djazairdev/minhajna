// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's own devices and backups in the pilot (#247, Devices-pilot,
// Recovery-sheet, answer 478). Their events belong to the device layer, so they
// never leave the phone: not in an archive, a backup or a transfer file. The
// recovery key is kept so that later backups ask nothing and the sheet prints
// again; a new sheet erases the content of the keys before it. A backup keeps
// its snapshot boundary and day (#485), read by the devices page, the log, the erase screen
// and the 30-day reminder (answer 482): due 30 days after the last backup, or
// after the first change when there is none, and never before the day it was
// put off to, by «تذكيري لاحقاً» or a restore. A working copy handed to the
// other device (answer 503) keeps the day and the last entry it held, until the
// copy comes back or the teacher takes over here. The copy here keeps where it
// came from, last: a restore's route, or the copy back from the other device
// (#251, answer 525).
// A restore keeps the file's day and boundary atomically. Its own erasures
// and receipt are bookkeeping, not unsaved teaching. An unrecognised boundary
// grants no coverage. Old facts remain readable without changing the history.

import { addDays, compareDays, isDay, maxDay, type Day } from './day.ts';
import { eventOf, type RecordEvent } from './events.ts';
import { ERASURE, type Entry } from './history.ts';
import { readRecoveryKey } from './recovery-key.ts';
import { isFields } from './read.ts';

import { isCopyRoute, type CopyRoute } from './device-events.ts';

export { DEVICE_KINDS, type CopyFile, type CopyRoute, type DeviceEvent } from './device-events.ts';

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
  /** Where the copy here came from, last, and its day; null when this device started fresh. */
  readonly received: { readonly day: Day; readonly from: CopyRoute | 'back' } | null;
  /** The source file restored here and changes after it; a phone transfer is not a retained backup. */
  readonly restoredFile: { readonly from: CopyRoute; readonly day: Day; readonly since: number } | null;
}

/** A hash as the history writes it: SHA-256 in lowercase hex. */
const HASH = /^[0-9a-f]{64}$/u;

function keyOf(event: RecordEvent | null): string | null {
  if (event?.kind !== 'recovery.set') return null;
  const key: unknown = event.recovery?.key;
  return typeof key === 'string' && readRecoveryKey(key) === key ? key : null;
}

/** A real earlier boundary only; an unknown hash or malformed date must never hide unsaved changes. */
function fileOf(value: unknown, before: ReadonlyMap<string, number>, day: Day): { made: Day; last: number } | null {
  if (!isFields(value) || typeof value['made'] !== 'string' || !isDay(value['made'])) return null;
  if (compareDays(value['made'], day) > 0 || typeof value['last'] !== 'string') return null;
  const last = value['last'] === '' && before.size === 0 ? -1 : before.get(value['last']);
  return last === undefined ? null : { made: value['made'], last };
}

/** What the devices page, the recovery sheet and the reminder read from the history. */
export function deviceFacts(entries: readonly Entry[]): DeviceFacts {
  let recovery: DeviceFacts['recovery'] = null;
  let lastBackup: Day | null = null;
  let sinceBackup = 0;
  let handedOver: DeviceFacts['handedOver'] = null;
  let received: DeviceFacts['received'] = null;
  let restored: { from: CopyRoute; day: Day; at: number } | null = null;
  const keys: Entry[] = [];
  const before = new Map<string, number>();
  for (const [index, entry] of entries.entries()) {
    const event = eventOf(entry);
    const key = keyOf(event);
    if (key !== null) {
      recovery = { key, day: entry.day };
      keys.push(entry);
    }
    sinceBackup += 1;
    if (event?.kind === 'backup.saved') {
      const file = fileOf(event.backup, before, entry.day);
      if (event.backup === undefined || file !== null) {
        lastBackup = file?.made ?? entry.day;
        sinceBackup = file === null ? 0 : index - file.last - 1;
        restored = null;
      }
    }
    if (event?.kind === 'handover.sent') {
      const last: unknown = event.handover?.last;
      handedOver = typeof last === 'string' && HASH.test(last) ? { day: entry.day, last } : handedOver;
    }
    if (event?.kind === 'handover.ended') handedOver = null;
    if (event?.kind === 'handover.ended' && event.handover?.how !== 'taken')
      received = { day: entry.day, from: 'back' };
    if (event?.kind === 'copy.received' && isCopyRoute(event.received?.from)) {
      received = { day: entry.day, from: event.received.from };
      const file = fileOf(event.received.file, before, entry.day);
      if (
        file !== null &&
        entries.slice(file.last + 1, index).every((one) => one.kind === ERASURE && one.day === entry.day)
      )
        restored = { from: event.received.from, day: file.made, at: index };
    }
    before.set(entry.hash, index);
  }
  const current = recovery?.key;
  const earlierKeys = keys.filter((entry) => keyOf(eventOf(entry)) !== current).map((entry) => entry.id);
  const first = entries.find((entry) => entry.kind !== ERASURE);
  return {
    recovery,
    earlierKeys,
    lastBackup,
    sinceBackup,
    firstChange: first?.day ?? null,
    handedOver,
    received,
    restoredFile:
      restored === null ? null : { from: restored.from, day: restored.day, since: entries.length - restored.at - 1 },
  };
}

/** The day the backup reminder falls due, never before `later`, the day it was put off to; null before any change. */
export function backupReminderDay(facts: DeviceFacts, later: Day | null): Day | null {
  const file = facts.restoredFile;
  const from = (file !== null && file.from !== 'phone' ? file.day : null) ?? facts.lastBackup ?? facts.firstChange;
  if (from === null) return null;
  const due = addDays(from, BACKUP_REMINDER_DAYS);
  return later === null ? due : maxDay(due, later);
}
