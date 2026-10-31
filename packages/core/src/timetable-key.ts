// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The timetable key (#552, PRD §5.10, §7.8): it opens the school's
// timetables and the assignments they are built from, and nothing else. It
// is a keyring of its own, as school-key.ts makes them, in the space that
// holds the school's timetables, so its keys are random and owe nothing to
// the school key: a staff member who only helps prepare the timetable holds
// it and can open no pupil record, lesson record or confirmation status.
// The holders of the school key hold it too, the recovery among them, and
// only they add or remove a preparer (answer 559). A preparer holds the
// keyring's keys and could tag a change naming anyone, so each change
// carries what it cannot make (timetable-change.ts): a grant under the
// school key, which the school's devices check and whose epoch never goes
// back, and for each preparer a MAC under its secret, derived from the
// school key's epoch, mixed with the timetable key it holds. When the
// school key loses a device, the timetable keyring drops it first, before
// the removal is sent, and takes the school key's next epoch after, with
// each preparer's new secret (answer 561).

import { type RandomBytes } from './id.ts';
import { isRecoveryHolder } from './school-recovery.ts';
import { sameMac, type Holder, type KeyCrypto, type KeyringProblem, type SchoolKeyring } from './school-key-shape.ts';
import {
  acceptKeyring,
  addHolder,
  latestEpoch,
  openKeyring,
  rekeyKeyring,
  removeHolder,
  startKeyring,
  type OpenedKeyring,
} from './school-key.ts';
import { openAdmitted } from './school-holder.ts';
import {
  grantOf,
  isTimetableChange,
  openRenewed,
  preparerSecret,
  sealSecret,
  vouchOf,
  type HeldTimetable,
} from './timetable-change.ts';

export type { HeldTimetable, TimetableChange, TimetablePurpose } from './timetable-change.ts';
export { TIMETABLE_PURPOSES, timetableKey } from './timetable-change.ts';

function holds(ring: SchoolKeyring, device: string): boolean {
  return ring.holders.some((one) => one.id === device);
}

function checkGrantor(school: SchoolKeyring, by: string): void {
  if (!holds(school, by)) throw new RangeError('Only a holder of the school key changes the timetable key');
}

/** The change for a keyring: granted under the school key's latest epoch, and vouched for each earlier preparer. */
async function vouch(
  school: OpenedKeyring,
  before: HeldTimetable | null,
  opened: OpenedKeyring,
  preparers: readonly string[],
  crypto: KeyCrypto,
  dropping: readonly string[] = before?.change.dropped ?? [],
): Promise<HeldTimetable> {
  const { ring } = opened;
  const epoch = latestEpoch(school);
  const dropped = [...new Set(dropping)].filter((id) => holds(school.ring, id)).sort();
  const earlier = before?.change.preparers ?? [];
  const renewed: Record<string, string> = {};
  for (const id of preparers) {
    if (earlier.includes(id) && before!.change.epoch === epoch) continue;
    renewed[id] = await sealSecret(ring, id, await preparerSecret(school, epoch, id, crypto), crypto);
  }
  const granted = { ring, epoch, preparers: [...preparers].sort(), dropped, renewed };
  const vouched: Record<string, string> = {};
  for (const id of earlier) {
    const secret = await preparerSecret(school, before!.change.epoch, id, crypto);
    vouched[id] = await vouchOf(secret, before!.opened, granted, id, crypto);
  }
  const change = { ...granted, grant: await grantOf(school, granted, crypto), vouched };
  return { opened, change, secret: null };
}

/** The timetable keyring, started in its own space and sealed for every holder of the school key; proposals. */
export async function startTimetableKey(
  school: OpenedKeyring,
  space: string,
  by: string,
  crypto: KeyCrypto,
  random: RandomBytes,
): Promise<readonly HeldTimetable[]> {
  checkGrantor(school.ring, by);
  if (space === school.ring.school) throw new RangeError('The timetable key has a space of its own');
  const maker = school.ring.holders.find((one) => one.id === by)!;
  const steps = [await vouch(school, null, await startKeyring(space, maker, crypto, random), [], crypto)];
  for (const holder of school.ring.holders) {
    if (holder.id === by) continue;
    const before = steps.at(-1)!;
    steps.push(await vouch(school, before, await addHolder(before.opened, holder, by, crypto), [], crypto));
  }
  return steps;
}

/**
 * The timetable keyring with a preparer's device, scanned from its QR code,
 * added by a holder of the school key; a proposal. The scanning device
 * sends it with the admission its QR code allows, and the preparer opens it
 * with `admitPreparer`.
 */
export async function addPreparer(
  held: HeldTimetable,
  school: OpenedKeyring,
  preparer: Holder,
  by: string,
  crypto: KeyCrypto,
): Promise<HeldTimetable> {
  checkGrantor(school.ring, by);
  if (holds(school.ring, preparer.id)) throw new RangeError('Not a preparer’s device');
  const opened = await addHolder(held.opened, preparer, by, crypto);
  return vouch(school, held, opened, [...held.change.preparers, preparer.id], crypto);
}

/** The timetable keyring without a preparer's device, under a new key it is never given; a proposal. */
export async function removePreparer(
  held: HeldTimetable,
  school: OpenedKeyring,
  preparer: string,
  by: string,
  crypto: KeyCrypto,
  random: RandomBytes,
): Promise<HeldTimetable> {
  checkGrantor(school.ring, by);
  if (!held.change.preparers.includes(preparer)) throw new RangeError('Not a preparer of this school');
  const opened = await removeHolder(held.opened, preparer, by, crypto, random);
  return vouch(
    school,
    held,
    opened,
    held.change.preparers.filter((id) => id !== preparer),
    crypto,
  );
}

/** The devices dropped from the timetable keyring that still hold the school key: a removal to finish or restore. */
export function pendingDrops(held: HeldTimetable, school: SchoolKeyring): readonly string[] {
  return held.change.dropped.filter((id) => holds(school, id));
}

/** The preparers: the timetable key's holders that its latest change names as preparers. */
export function preparersOf(held: HeldTimetable): readonly Holder[] {
  return held.opened.ring.holders.filter((one) => held.change.preparers.includes(one.id));
}

/** Devices to keep out of the timetable keyring until their removal lands, or to let back when it is abandoned. */
export interface FollowOptions {
  readonly drop?: readonly string[];
  readonly restore?: readonly string[];
}

/**
 * The changes that make the timetable keyring follow the school key: each
 * holder that is neither a holder of the school key nor a preparer, or that
 * is dropped, is removed under a new key; each holder of the school key it
 * lacks and that is not dropped is added; and when the school key has a new
 * epoch, the first change under it carries each preparer's secret for it, a
 * new key alone if nothing else changes, as also when only the dropped list
 * changes. The recovery is never dropped. Proposals, in order. To remove a
 * device from the school key, first follow dropping it and send that; the
 * changes name it as dropped until its removal lands, so no other holder's
 * follow adds it back. Once that is in the timetable's space, the app sends
 * the removal from the school key at once, and once that lands, follows
 * again. A removal that is abandoned is undone by following with `restore`.
 */
export async function followSchool(
  held: HeldTimetable,
  school: OpenedKeyring,
  by: string,
  crypto: KeyCrypto,
  random: RandomBytes,
  options: FollowOptions = {},
): Promise<readonly HeldTimetable[]> {
  checkGrantor(school.ring, by);
  const { drop = [], restore = [] } = options;
  if (drop.includes(by)) throw new RangeError('A device does not drop itself');
  for (const one of school.ring.holders) {
    if (drop.includes(one.id) && (await isRecoveryHolder(one, crypto))) throw new RangeError('The recovery stays');
  }
  const dropped = [...held.change.dropped.filter((id) => !restore.includes(id)), ...drop];
  const { preparers } = held.change;
  const kept = (id: string) => holds(school.ring, id) && !dropped.includes(id);
  const leaving = held.opened.ring.holders.filter((one) => !kept(one.id) && !preparers.includes(one.id));
  const joining = school.ring.holders.filter((one) => kept(one.id) && !holds(held.opened.ring, one.id));
  const steps: HeldTimetable[] = [];
  const latest = () => steps.at(-1) ?? held;
  const next = async (opened: OpenedKeyring) =>
    steps.push(await vouch(school, latest(), opened, preparers, crypto, dropped));
  for (const { id } of leaving) await next(await removeHolder(latest().opened, id, by, crypto, random));
  for (const holder of joining) await next(await addHolder(latest().opened, holder, by, crypto));
  const listed =
    [...new Set(dropped)]
      .filter((id) => holds(school.ring, id))
      .sort()
      .join() !== held.change.dropped.join();
  if (steps.length === 0 && (listed || latestEpoch(school) > held.change.epoch)) {
    await next(await rekeyKeyring(held.opened, by, crypto, random));
  }
  return steps;
}

/**
 * A new preparer's first keyring, opened from the change that added it by
 * the admission its QR code allowed, with its secret. The admission binds
 * the keyring; which holders are preparers is checked from its next change.
 */
export async function admitPreparer(
  change: unknown,
  admitted: string,
  device: string,
  secret: string,
  crypto: KeyCrypto,
): Promise<HeldTimetable | KeyringProblem> {
  if (!isTimetableChange(change, crypto.publicKeyBytes) || !change.preparers.includes(device)) return 'forged';
  const opened = await openAdmitted(change.ring, admitted, device, secret, crypto);
  if (typeof opened === 'string') return opened;
  const mine = await openRenewed(change, device, crypto);
  return mine === null ? 'forged' : { opened, change, secret: mine };
}

/**
 * Adopts the next change of the timetable keyring, as `acceptKeyring` does,
 * once what vouches for it checks. On a device that holds the school key,
 * `school` is the school's keyring it holds: the grant must check under the
 * epoch it names, which never goes back, and a later epoch than the device
 * holds reads as 'behind': the device catches up with the school's space
 * and reads it again once, and skips it as forked if it is still behind. On
 * a preparer's device, `school` is null and its own MAC must check; a new
 * secret sealed for it with a new epoch is kept.
 */
export async function acceptTimetableChange(
  held: HeldTimetable,
  change: unknown,
  school: OpenedKeyring | null,
  device: string,
  crypto: KeyCrypto,
): Promise<HeldTimetable | KeyringProblem | 'behind'> {
  if (!isTimetableChange(change, crypto.publicKeyBytes)) return 'forged';
  if (school !== null) {
    if (change.epoch > latestEpoch(school)) return 'behind';
    if (change.epoch < held.change.epoch) return 'forked';
    if (!sameMac(change.grant, await grantOf(school, change, crypto))) return 'forked';
  } else {
    const mine = change.vouched[device];
    if (held.secret === null || mine === undefined) return 'forked';
    if (!sameMac(mine, await vouchOf(held.secret, held.opened, change, device, crypto))) return 'forked';
  }
  const opened = await acceptKeyring(held.opened, change.ring, device, crypto);
  if (opened === held.opened) return held;
  if (typeof opened === 'string') return opened;
  if (school !== null || change.epoch === held.change.epoch) return { opened, change, secret: held.secret };
  const secret = await openRenewed(change, device, crypto);
  return secret === null ? 'forged' : { opened, change, secret };
}

/**
 * Opens the timetable keyring with a recovered school key (school-recovery.ts):
 * from the first change of the timetable's space that the school key grants
 * and the recovery opens, it adopts each next one as a holder would.
 */
export async function recoverTimetableKey(
  school: OpenedKeyring,
  recovery: { readonly holder: Holder; readonly crypto: KeyCrypto },
  changes: readonly unknown[],
): Promise<HeldTimetable | 'wrong' | 'replaced'> {
  const { holder, crypto } = recovery;
  let held: HeldTimetable | undefined;
  for (const change of changes) {
    if (held !== undefined) {
      const next = await acceptTimetableChange(held, change, school, holder.id, crypto);
      if (next === 'removed') return 'replaced';
      if (typeof next !== 'string') held = next;
    } else if (isTimetableChange(change, crypto.publicKeyBytes) && change.epoch <= latestEpoch(school)) {
      const granted = sameMac(change.grant, await grantOf(school, change, crypto));
      const opened = granted ? await openKeyring(change.ring, holder.id, crypto) : 'forged';
      if (typeof opened !== 'string') held = { opened, change, secret: null };
    }
  }
  return held ?? 'wrong';
}
