// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The class's own changes to its plan: a layer of operations over the pack,
// never a copy of it (#225, PRD §4.2, R-4.2-14). Each change names items by
// their IDs and is applied again over whatever release the class is on, so
// a fix to the national pack still reaches the class. The teacher may make
// any change on any item (answer 284). A change is never deleted: taking
// one back adds an `undo`, so the history only grows and the records made
// under a change keep its titles (answer 285). Recorded sessions never
// change; an item they taught that the plan no longer has reads as content
// outside the plan. A change that no longer fits, such as a move of an item
// a new release dropped, is left out rather than guessed.
//
// Splitting gives two parts in the item's place, its sessions and stages
// shared between them, the first part taking the larger half. An added item
// is a lesson. A move puts an item just before another of the same queue,
// in that item's unit, or at the queue's end. A join teaches two items side
// by side in one session, the first one's, as a merge does, and a merge the
// pack proposes holds only while its items stay side by side. Added and
// moved items take the unit and plan week of where they land. Aligning
// with class X, «مواءمة … مع X», is a move that brings X's next item before
// this class's next item, so the items passed follow it (answer 286).
//
// Changes build on each other, so each carries its place in the course's
// order, `seq`; every device applies them in that order, whatever order
// the records travel in. The district and school layers a class has on
// apply first, in that order (#226); a layer's split of an item an
// exam-window answer names is left out, as the class's own would be.

import type { Day } from './day.ts';
import { budgetInSessions, queueItems, stageNames, type PackItem, type PlanPack, type StageTemplate } from './pack.ts';
import type { PlanDecision } from './plan-decisions.ts';
import { layerChanges, layerKey, NO_LAYERS, type CourseLayers } from './variant-layers.ts';

type Made = {
  readonly id: string;
  readonly courseId: string;
  /** The day it was made, kept on the teacher's own devices only. */
  readonly day?: Day;
  readonly seq: number;
};

export type PlanChange = Made &
  (
    | { readonly kind: 'move'; readonly item: string; readonly before: string | null; readonly align?: string }
    | { readonly kind: 'budget'; readonly item: string; readonly sessions: number }
    | { readonly kind: 'split'; readonly item: string; readonly titles: readonly [string, string] }
    | { readonly kind: 'add'; readonly title: string; readonly sessions: number; readonly before: string | null }
    | { readonly kind: 'skip'; readonly item: string }
    | { readonly kind: 'join'; readonly items: readonly [string, string] }
    | { readonly kind: 'undo'; readonly change: string }
  );

export const CHANGE_KINDS = ['move', 'budget', 'split', 'add', 'skip', 'join', 'undo'] as const;

/** Whether a decision is one of the class's own changes, rather than an answer to an exam window. */
export function isChange(decision: { readonly kind: string }): decision is PlanChange {
  return (CHANGE_KINDS as readonly string[]).includes(decision.kind);
}

/** The ID of one part of an item a `split` change splits. */
export function partId(item: string, change: string, part: 1 | 2): string {
  return `${item}~${change}~${part}`;
}

/** The ID of the item an `add` change adds. */
export function addedId(change: string): string {
  return `add~${change}`;
}

type Decisions = ReadonlyMap<string, PlanDecision>;

/** Every change of a course, undos and changes taken back included, in its order. */
function madeFor(decisions: Decisions, courseId: string): PlanChange[] {
  return [...decisions.values()]
    .filter((decision): decision is PlanChange => isChange(decision) && decision.courseId === courseId)
    .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id));
}

/** The place the next change of a course takes in its order. */
export function nextSeq(decisions: Decisions, courseId: string): number {
  return (madeFor(decisions, courseId).at(-1)?.seq ?? 0) + 1;
}

/** A course's changes still in force, in their order, without the ones taken back or the undos. */
export function changesFor(decisions: Decisions, courseId: string): PlanChange[] {
  const all = madeFor(decisions, courseId);
  const undone = new Set(all.flatMap((change) => (change.kind === 'undo' ? [change.change] : [])));
  return all.filter((change) => change.kind !== 'undo' && !undone.has(change.id));
}

const memo = new WeakMap<Decisions, WeakMap<PlanPack, Map<string, PlanPack>>>();

/**
 * The pack with a course's layers and changes applied, in their order.
 * Budgets are kept in the pack's own unit, turned from sessions with the
 * class's session length, so every reader of the pack counts them as before.
 */
export function layered(
  pack: PlanPack,
  decisions: Decisions,
  courseId: string,
  sessionMinutes: number,
  layers: CourseLayers = NO_LAYERS,
): PlanPack {
  const byPack = memo.get(decisions) ?? new WeakMap<PlanPack, Map<string, PlanPack>>();
  memo.set(decisions, byPack);
  const byCourse = byPack.get(pack) ?? new Map<string, PlanPack>();
  byPack.set(pack, byCourse);
  const key = [courseId, sessionMinutes, ...[layers.on, layers.known].map((list) => list.map(layerKey).join(' '))];
  const known = byCourse.get(key.join('\n'));
  if (known !== undefined) return known;
  const result = apply(pack, decisions, courseId, sessionMinutes, layers);
  byCourse.set(key.join('\n'), result);
  return result;
}

function apply(
  pack: PlanPack,
  decisions: Decisions,
  courseId: string,
  sessionMinutes: number,
  layers: CourseLayers,
): PlanPack {
  const own = madeFor(decisions, courseId);
  if (own.length === 0 && layers.known.length === 0) return pack;
  const answered = new Set(
    [...decisions.values()].flatMap((one) =>
      isChange(one) || one.courseId !== courseId ? [] : one.kind === 'leave-out' ? [one.item] : one.items,
    ),
  );
  const fromLayers = layers.on
    .flatMap((layer) => layerChanges(layer, courseId))
    .filter((change) => change.kind !== 'split' || !answered.has(change.item));
  const made = [...layers.known.flatMap((layer) => layerChanges(layer, courseId)), ...own];
  const changes = [...fromLayers, ...changesFor(decisions, courseId)];
  const layerSkips: string[] = [];
  const layerJoins: [string, string][] = [];
  const items: PackItem[] = [...pack.items];
  const templates: StageTemplate[] = [...pack.stageTemplates];
  const current = (): PlanPack => ({ ...pack, items, stageTemplates: templates });
  const inUnit = (sessions: number): number =>
    pack.anchor.kind !== 'weeks' && pack.anchor.unit === 'hours' ? (sessions * sessionMinutes) / 60 : sessions;
  const at = (id: string): number => items.findIndex((item) => item.id === id && item.kind !== 'unit');
  const queueOf = (item: PackItem): 'td' | 'main' => (item.kind === 'td' ? 'td' : 'main');
  const place = (item: PackItem, before: string | null): boolean => {
    const queue = queueItems(current(), queueOf(item));
    const target = before === null ? undefined : queue.find((one) => one.id === before);
    if (before !== null && target === undefined) return false;
    const { unit, week } = target ?? queue.at(-1) ?? {};
    const moved: { -readonly [K in keyof PackItem]: PackItem[K] } = { ...item };
    delete moved.unit;
    delete moved.week;
    if (unit !== undefined) moved.unit = unit;
    if (week !== undefined) moved.week = week;
    if (target === undefined) {
      const last = queue.at(-1);
      items.splice(last === undefined ? items.length : items.indexOf(last) + 1, 0, moved);
    } else items.splice(items.indexOf(target), 0, moved);
    return true;
  };

  for (const change of changes) {
    switch (change.kind) {
      case 'budget': {
        const index = at(change.item);
        if (index >= 0 && change.sessions >= 1) items[index] = { ...items[index]!, budget: inUnit(change.sessions) };
        break;
      }
      case 'split': {
        const index = at(change.item);
        if (index < 0) break;
        const item = items[index]!;
        const sessions = budgetInSessions(current(), item, sessionMinutes);
        const first = Math.ceil(sessions / 2);
        const names = stageNames(current(), item);
        const cut = Math.ceil(names.length / 2);
        const part = (n: 1 | 2): PackItem => {
          const stages = n === 1 ? names.slice(0, cut) : names.slice(cut);
          const { stages: whole, ...rest } = item;
          const template = `${whole ?? ''}~${change.id}~${n}`;
          if (stages.length > 0) templates.push({ id: template, stages });
          return {
            ...rest,
            id: partId(item.id, change.id, n),
            title: n === 1 ? change.titles[0] : change.titles[1],
            budget: inUnit(n === 1 ? first : Math.max(1, sessions - first)),
            ...(stages.length > 0 && { stages: template }),
          };
        };
        items.splice(index, 1, part(1), part(2));
        break;
      }
      case 'add':
        if (change.sessions >= 1 && change.title.trim() !== '') {
          const id = addedId(change.id);
          const added: PackItem = { id, kind: 'lesson', title: change.title, budget: inUnit(change.sessions) };
          if (!place(added, change.before)) place(added, null);
        }
        break;
      case 'move': {
        const index = at(change.item);
        if (index < 0 || change.before === change.item) break;
        const item = items[index]!;
        const target = change.before === null ? undefined : items.find((one) => one.id === change.before);
        if (target !== undefined && (target.kind === 'unit' || queueOf(target) !== queueOf(item))) break;
        if (change.before !== null && target === undefined) break;
        items.splice(index, 1);
        place(item, change.before);
        break;
      }
      case 'skip':
        if (fromLayers.includes(change)) layerSkips.push(change.item);
        break;
      case 'join':
        if (fromLayers.includes(change)) layerJoins.push([...change.items]);
        break;
      case 'undo':
        break;
    }
  }
  const ids = new Set(items.map((item) => item.id));
  const sideBySide = (plan: PlanPack, group: readonly string[]): boolean =>
    (['main', 'td'] as const).some((queue) => {
      const order = queueItems(plan, queue).map((item) => item.id);
      const at = group.map((id) => order.indexOf(id)).sort((x, y) => x - y);
      return at.every((index, n) => index >= 0 && (n === 0 || index === at[n - 1]! + 1));
    });
  const holds = (group: readonly string[]): boolean =>
    group.every((id) => ids.has(id)) && (!sideBySide(pack, group) || sideBySide(current(), group));
  const retired = made.flatMap((change): PackItem[] => {
    const named: [string, string][] =
      change.kind === 'add'
        ? [[addedId(change.id), change.title]]
        : change.kind === 'split'
          ? [
              [partId(change.item, change.id, 1), change.titles[0]],
              [partId(change.item, change.id, 2), change.titles[1]],
            ]
          : [];
    return named.filter(([id]) => !ids.has(id)).map(([id, title]) => ({ id, kind: 'lesson', title }));
  });
  return {
    ...current(),
    merges: pack.merges.filter(holds),
    ...(retired.length > 0 && { retired }),
    ...(layerSkips.length + layerJoins.length > 0 && { fromLayers: { skips: layerSkips, joins: layerJoins } }),
  };
}

/**
 * An item by its ID: one the plan has, or one a change made and the class
 * has since taken back, so a record made under it keeps its title.
 */
export function findPackItem(pack: PlanPack | null | undefined, id: string): PackItem | undefined {
  return pack?.items.find((item) => item.id === id) ?? pack?.retired?.find((item) => item.id === id);
}

/** The items a course's layers and changes skip, among those its layered pack has, each once. */
export function skippedBy(pack: PlanPack, decisions: Decisions, courseId: string): string[] {
  const own = changesFor(decisions, courseId).flatMap((change) => (change.kind === 'skip' ? [change.item] : []));
  const skips = new Set([...(pack.fromLayers?.skips ?? []), ...own]);
  return [...skips].filter((id) => pack.items.some((item) => item.id === id && item.kind !== 'unit'));
}

/**
 * A course's joins that still fit, its layers' first: both items in the
 * layered pack's same queue, side by side. As with merges, an item takes
 * part in one only.
 */
export function joinsOf(pack: PlanPack, decisions: Decisions, courseId: string): [string, string][] {
  const joins: [string, string][] = [];
  const own = changesFor(decisions, courseId).flatMap((change) => (change.kind === 'join' ? [change.items] : []));
  for (const items of [...(pack.fromLayers?.joins ?? []), ...own]) {
    for (const queue of ['main', 'td'] as const) {
      const order = queueItems(pack, queue).map((item) => item.id);
      const [a, b] = items.map((id) => order.indexOf(id)) as [number, number];
      if (a >= 0 && b >= 0 && Math.abs(a - b) === 1) joins.push(a < b ? [items[0], items[1]] : [items[1], items[0]]);
    }
  }
  return joins;
}
