// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a release's item IDs came from an earlier release of the same pack
// (#322, answer 487, R-4.2-13, R-4.2-17): its migration entries. An item
// renamed under a new ID, split in two or more, several merged into one, or
// removed has an entry; a page or title change that keeps its ID needs none.
// An ID is never used again for another item, so an ID a release has is
// always its own, and only an ID it lacks is looked up in the entries.
//
// A release that names no earlier one follows the release before it on the
// phone, with every ID kept. The chain from a class's release to a newer one
// goes through every release between them, one step each, and each step is
// checked against the release it starts from: every earlier item is still
// there or in an entry, every old ID was an earlier item, no new ID was one,
// an entry keeps its items' kind, and no ID an earlier release of the chain
// had comes back. When a release in between is not on the phone, or a step
// fails, no move is offered. Nothing recorded is rewritten: readings follow
// an old ID one step at a time, so an ID renamed twice is one item, never two
// merged. The phone keeps one pack a release.

import { compareReleases } from './pack-catalogue.ts';
import type { PackItem, PlanPack } from './pack.ts';
import { ITEM_ID } from './pack-fields.ts';
import { isFields, Reader, RELEASE } from './read.ts';

export type MigrationEntry =
  | { readonly kind: 'rename'; readonly from: string; readonly to: string }
  | { readonly kind: 'split'; readonly from: string; readonly to: readonly string[] }
  | { readonly kind: 'merge'; readonly from: readonly string[]; readonly to: string }
  | { readonly kind: 'remove'; readonly item: string };

export interface PackMigration {
  /** The earlier release the entries start from. */
  readonly from: string;
  readonly entries: readonly MigrationEntry[];
}

/** One release's entries, with the release they start from and the release itself. */
export interface MigrationStep {
  readonly entries: readonly MigrationEntry[];
  readonly before: PlanPack;
  readonly after: PlanPack;
}

/** The steps from a release to a later one, oldest first; none when nothing changed. */
export type Migration = readonly MigrationStep[];

/** The steps to a release, or why the class cannot move to it. */
export type ReleaseChain =
  | { readonly ok: true; readonly steps: Migration }
  | { readonly ok: false; readonly problem: 'missing' | 'broken' | 'not-newer'; readonly release: string };

export const oldIds = (entry: MigrationEntry): readonly string[] =>
  entry.kind === 'remove' ? [entry.item] : typeof entry.from === 'string' ? [entry.from] : entry.from;
export const newIds = (entry: MigrationEntry): readonly string[] =>
  entry.kind === 'remove' ? [] : typeof entry.to === 'string' ? [entry.to] : entry.to;

/** Units, TD items and the main queue's items stay apart: an entry never mixes them. */
const sortOf = (item: PackItem): string => (item.kind === 'unit' || item.kind === 'td' ? item.kind : 'main');

function failed(reader: Reader, path: string, problem: 'required' | 'invalid'): undefined {
  reader.fail(path, problem);
  return undefined;
}

function readIds(reader: Reader, value: unknown, path: string, least: number): string[] | undefined {
  if (value === undefined) return failed(reader, path, 'required');
  const list: unknown = least === 1 ? [value] : value;
  if (!Array.isArray(list) || list.length < least || new Set(list).size !== list.length) {
    return failed(reader, path, 'invalid');
  }
  if (!list.every((id) => typeof id === 'string' && ITEM_ID.test(id))) return failed(reader, path, 'invalid');
  return list as string[];
}

function readEntry(reader: Reader, raw: unknown, path: string): MigrationEntry | undefined {
  if (!isFields(raw)) return failed(reader, path, 'invalid');
  switch (raw['kind']) {
    case 'rename': {
      const [from] = readIds(reader, raw['from'], `${path}.from`, 1) ?? [];
      const [to] = readIds(reader, raw['to'], `${path}.to`, 1) ?? [];
      return from === undefined || to === undefined ? undefined : { kind: 'rename', from, to };
    }
    case 'split': {
      const [from] = readIds(reader, raw['from'], `${path}.from`, 1) ?? [];
      const to = readIds(reader, raw['to'], `${path}.to`, 2);
      return from === undefined || to === undefined ? undefined : { kind: 'split', from, to };
    }
    case 'merge': {
      const from = readIds(reader, raw['from'], `${path}.from`, 2);
      const [to] = readIds(reader, raw['to'], `${path}.to`, 1) ?? [];
      return from === undefined || to === undefined ? undefined : { kind: 'merge', from, to };
    }
    case 'remove': {
      const [item] = readIds(reader, raw['item'], `${path}.item`, 1) ?? [];
      return item === undefined ? undefined : { kind: 'remove', item };
    }
    default:
      return failed(reader, `${path}.kind`, raw['kind'] === undefined ? 'required' : 'invalid');
  }
}

/**
 * Reads a release's `migration`. Its new IDs must be the release's items, of
 * one kind, its old IDs never items of the release, and no ID may be in two
 * entries.
 */
export function readMigration(
  reader: Reader,
  value: unknown,
  release: string,
  items: readonly PackItem[],
): PackMigration | undefined {
  if (value === undefined) return undefined;
  if (!isFields(value)) return failed(reader, 'migration', 'invalid');
  const from = reader.requiredText(value, 'from', 'migration', RELEASE);
  if (from !== '' && RELEASE.test(release) && compareReleases(from, release) >= 0)
    reader.fail('migration.from', 'invalid');
  const raw = value['entries'];
  if (!Array.isArray(raw)) return failed(reader, 'migration.entries', raw === undefined ? 'required' : 'invalid');
  const entries: MigrationEntry[] = [];
  const seenOld = new Set<string>();
  const seenNew = new Set<string>();
  const has = (id: string) => items.some((item) => item.id === id);
  raw.forEach((rawEntry: unknown, index) => {
    const path = `migration.entries[${index}]`;
    const entry = readEntry(reader, rawEntry, path);
    if (entry === undefined) return;
    if (oldIds(entry).some(has)) return reader.fail(path, 'invalid');
    if (!newIds(entry).every(has)) return reader.fail(path, 'unknown-reference');
    const kinds = new Set(newIds(entry).map((id) => sortOf(items.find((item) => item.id === id)!)));
    if (kinds.size > 1) return reader.fail(path, 'invalid');
    if (oldIds(entry).some((id) => seenOld.has(id)) || newIds(entry).some((id) => seenNew.has(id))) {
      return reader.fail(path, 'duplicate');
    }
    oldIds(entry).forEach((id) => seenOld.add(id));
    newIds(entry).forEach((id) => seenNew.add(id));
    entries.push(entry);
  });
  return from === '' ? undefined : { from, entries };
}

/** The release a release's entries start from: its own `from`, or the one before it on the phone. */
function previous(packs: readonly PlanPack[], pack: PlanPack): string | null {
  if (pack.migration !== undefined) return pack.migration.from;
  const earlier = packs
    .filter((other) => other.id === pack.id && compareReleases(other.release, pack.release) < 0)
    .sort((a, b) => compareReleases(b.release, a.release));
  return earlier[0]?.release ?? null;
}

/** Whether a release's entries fit the release they start from (see the head of this file). */
function fits(step: MigrationStep): boolean {
  const before = new Map(step.before.items.map((item) => [item.id, item]));
  const after = new Map(step.after.items.map((item) => [item.id, item]));
  const changed = new Set(step.entries.flatMap(oldIds));
  for (const id of before.keys()) if (!after.has(id) && !changed.has(id)) return false;
  for (const entry of step.entries) {
    const old = oldIds(entry).map((id) => before.get(id));
    if (old.some((item) => item === undefined)) return false;
    if (newIds(entry).some((id) => before.has(id))) return false;
    const sorts = new Set([...old, ...newIds(entry).map((id) => after.get(id))].map((item) => sortOf(item!)));
    if (sorts.size > 1) return false;
  }
  return true;
}

/** The first step that brings back an ID an earlier release of the chain had, or -1. */
function firstReuse(steps: readonly MigrationStep[]): number {
  const seen = new Set(steps[0]?.before.items.map((item) => item.id));
  return steps.findIndex((step) => {
    const before = new Set(step.before.items.map((item) => item.id));
    const back = step.after.items.some((item) => !before.has(item.id) && seen.has(item.id));
    step.after.items.forEach((item) => seen.add(item.id));
    return back;
  });
}

/**
 * The steps from `since` up to `target`, or, without `since`, as far back as
 * the phone's releases go and fit; or why no move to `target` is offered.
 */
export function releaseChain(packs: Iterable<PlanPack>, target: PlanPack, since?: string): ReleaseChain {
  if (since !== undefined && compareReleases(since, target.release) >= 0) {
    return { ok: false, problem: 'not-newer', release: since };
  }
  const all = [...packs].filter((pack) => pack.id === target.id);
  if (since !== undefined && !all.some((pack) => pack.release === since)) {
    return { ok: false, problem: 'missing', release: since };
  }
  const steps: MigrationStep[] = [];
  let at: PlanPack = target;
  while (at.release !== since) {
    const from = previous(all, at);
    const before =
      from === null ? undefined : all.find((pack) => pack.release === from && compareReleases(from, at.release) < 0);
    const step = before === undefined ? undefined : { entries: at.migration?.entries ?? [], before, after: at };
    if (since === undefined) {
      if (step === undefined || !fits(step)) break;
    } else if (step === undefined) {
      return { ok: false, problem: 'missing', release: from ?? since };
    } else if (compareReleases(step.before.release, since) < 0 || !fits(step)) {
      return { ok: false, problem: 'broken', release: at.release };
    }
    steps.push(step);
    at = step.before;
  }
  steps.reverse();
  const reused = firstReuse(steps);
  if (reused < 0) return { ok: true, steps };
  if (since !== undefined) return { ok: false, problem: 'broken', release: steps[reused]!.after.release };
  return { ok: true, steps: steps.slice(reused + 1) };
}

/** Where an ID of an earlier release is in the last step's release: itself, the IDs it became, or none. */
export function followId(migration: Migration, id: string): string[] {
  let ids = [id];
  for (const step of migration) {
    ids = ids.flatMap((one) => {
      const entry = step.entries.find((candidate) => oldIds(candidate).includes(one));
      return entry === undefined ? [one] : [...newIds(entry)];
    });
  }
  return [...new Set(ids)];
}
