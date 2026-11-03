// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// My log, the log of a role's own actions in a demo world (#573, §7.8,
// R-7.8-09, answer 603): worked out from this device's history, never kept
// apart, by the day each was made and in the history's order, never a clock
// time. Only what this device did is listed: the school key started here, taken
// here as the key seeded with the world (#548), whose first code for each
// teacher, made by the seeding, is never listed, or this device added to it by
// another holder, again when it holds the key as a new device; then, only in
// keyrings this device made, never a change another holder made and this device
// followed, devices added to or removed from the key, counted without the
// recovery, and the recovery made or renewed, its old holder's removal being
// part of the renewal; each joining code, new when it replaces a code or a key,
// and said as after the key changed when the code it replaces was made under an
// older epoch, as D-Issue issues stale codes again; and each security key, by
// its number, replacing an earlier one when it follows another; and each change
// of the school's choice to send absences (answer 620), from the one before it,
// off at first. An issue kept twice is listed once. Each line names its
// school's space, and teachers by their assignment, for the app to name.
// Signing in is never listed.

import type { Day } from './day.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { readSchoolAbsences } from './school-exchange.ts';
import { joinedKey, readSchoolHeld, readSchoolIssued } from './school-issue.ts';
import type { Holder, KeyCrypto, SchoolKeyring } from './school-key-shape.ts';
import { isRecoveryHolder } from './school-recovery.ts';

/** A line of the role's own log. */
export type StaffLine = { readonly day: Day; readonly school: string } & (
  | { readonly kind: 'key-started' | 'key-taken' | 'key-admitted' | 'recovery-made' | 'recovery-renewed' }
  | { readonly kind: 'absences-on' | 'absences-off' }
  | { readonly kind: 'holders-added' | 'holders-removed'; readonly count: number }
  | { readonly kind: 'code-issued' | 'code-replaced' | 'code-reissued'; readonly assignment: string }
  | { readonly kind: 'key-issued' | 'key-replaced'; readonly assignment: string; readonly number: string }
);

type Held = { readonly device: string; readonly ring: SchoolKeyring; readonly seeded?: true };

async function ringLines(day: Day, now: Held, before: Held | undefined, crypto: KeyCrypto): Promise<StaffLine[]> {
  const { school, by, version } = now.ring;
  if (before === undefined && now.seeded === true) return [{ kind: 'key-taken', day, school }];
  if (before === undefined)
    return [{ kind: by === now.device && version === 1 ? 'key-started' : 'key-admitted', day, school }];
  if (version <= before.ring.version || by !== now.device) return [];
  const recovery = async (holders: readonly Holder[]) => {
    const found: Holder[] = [];
    for (const one of holders) if (await isRecoveryHolder(one, crypto)) found.push(one);
    return found;
  };
  const had = new Set(before.ring.holders.map((one) => one.id));
  const has = new Set(now.ring.holders.map((one) => one.id));
  const added = now.ring.holders.filter((one) => !had.has(one.id));
  const removed = before.ring.holders.filter((one) => !has.has(one.id));
  const [newRecovery, oldRecovery] = [await recovery(added), await recovery(removed)];
  const lines: StaffLine[] = [];
  if (added.length > newRecovery.length)
    lines.push({ kind: 'holders-added', day, school, count: added.length - newRecovery.length });
  if (removed.length > oldRecovery.length) {
    lines.push({ kind: 'holders-removed', day, school, count: removed.length - oldRecovery.length });
  }
  if (newRecovery.length > 0) {
    const renewing = (await recovery(before.ring.holders)).length > 0;
    lines.push({ kind: renewing ? 'recovery-renewed' : 'recovery-made', day, school });
  }
  return lines;
}

/** The school-key actions this device took in the world, as the director's and deputies' log lists them. */
export async function staffLog(entries: readonly Entry[], crypto: KeyCrypto): Promise<StaffLine[]> {
  const lines: StaffLine[] = [];
  const rings = new Map<string, Held>();
  const issues = new Set<string>();
  const last = new Map<string, { readonly access: 'phone' | 'key'; readonly epoch: number }>();
  const absences = new Map<string, boolean>();
  const seeded = new Set<string>();
  for (const entry of entries) {
    const event = eventOf(entry);
    const { day } = entry;
    if (event?.kind === 'school.held') {
      const held = readSchoolHeld(event.held, crypto.publicKeyBytes);
      if (held === null) continue;
      if (held.seeded === true) seeded.add(held.school);
      const kept = rings.get(held.school);
      const before = kept?.device === held.device ? kept : undefined;
      lines.push(...(await ringLines(day, held, before, crypto)));
      if (before === undefined || held.ring.version > before.ring.version) rings.set(held.school, held);
    } else if (event?.kind === 'school.absences') {
      const read = readSchoolAbsences(event.absences);
      if (read === null || read.send === (absences.get(read.school) ?? false)) continue;
      absences.set(read.school, read.send);
      lines.push({ kind: read.send ? 'absences-on' : 'absences-off', day, school: read.school });
    } else if (event?.kind === 'school.issued') {
      const issued = readSchoolIssued(event.issued);
      const at = issued === null ? '' : `${issued.school}:${joinedKey(issued.assignment, issued.issue)}`;
      if (issued === null || issues.has(at)) continue;
      issues.add(at);
      const { school, assignment, epoch, access, keyNumber } = issued;
      const after = last.get(`${school}:${assignment}`);
      last.set(`${school}:${assignment}`, { access, epoch });
      if (seeded.has(school) && after === undefined && issued.issue === 1 && epoch === 0 && keyNumber === null)
        continue;
      if (keyNumber !== null) {
        const kind = after?.access === 'key' ? 'key-replaced' : 'key-issued';
        lines.push({ kind, day, school, assignment, number: keyNumber });
      } else if (after === undefined) lines.push({ kind: 'code-issued', day, school, assignment });
      else {
        const kind = after.access === 'phone' && after.epoch < epoch ? 'code-reissued' : 'code-replaced';
        lines.push({ kind, day, school, assignment });
      }
    }
  }
  return lines;
}
