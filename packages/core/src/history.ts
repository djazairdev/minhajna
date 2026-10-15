// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The history is the record (PRD §5.5). Every change adds an entry and
// nothing is overwritten. Each entry is chained to the one before it, so an
// edit, a deletion or a reordering made without recomputing the chain shows.
// The chain has no key: a full rewrite that recomputes every hash is caught
// only once entries are signed with the teacher's key (PRD §5.5), which is
// not built yet.
//
// Deletion is real: erasing an entry removes its content and its salt. The
// chain still verifies, because each entry's hash covers only a salted digest
// of its content, and without the salt that digest reveals nothing about what
// was erased. A later erasure entry keeps the fact and the day of the deletion.

import { canonicalJson } from './canonical.ts';
import { isDay, type Day } from './day.ts';
import { newId, toHex, type RandomBytes } from './id.ts';
import type { Layer } from './layers.ts';

/**
 * SHA-256 of a text's UTF-8 bytes, as lowercase hex. Each app passes in its
 * platform's own implementation: the project writes no cryptography of its
 * own (PRD §6.5).
 */
export type Digest = (text: string) => Promise<string>;

export interface HistoryDeps {
  readonly digest: Digest;
  readonly random: RandomBytes;
}

/** The kind of the entries that record an erasure. They are never erased themselves. */
export const ERASURE = 'erasure';

export interface EntryContent {
  readonly salt: string;
  readonly body: unknown;
}

export interface Entry {
  readonly id: string;
  /** The entry's place in the history, from 0. */
  readonly seq: number;
  /** The day of the change, never its time (PRD §5.5). */
  readonly day: Day;
  readonly layer: Layer;
  readonly kind: string;
  readonly digest: string;
  readonly previous: string;
  readonly hash: string;
  /** Null once erased. */
  readonly content: EntryContent | null;
}

/**
 * Where a history is kept. `append` resolves only once the entry is safely
 * stored, so a crash or a flat battery loses nothing (PRD §6.8).
 */
export interface HistoryStore {
  load(): Promise<readonly Entry[]>;
  append(entry: Entry): Promise<void>;
  eraseContent(ids: readonly string[]): Promise<void>;
}

export type HistoryProblemKind =
  /** An entry is out of place, or one is missing. */
  | 'sequence'
  /** An entry does not point to the one before it. */
  | 'link'
  /** An entry's details were changed. */
  | 'hash'
  /** An entry's content was changed. */
  | 'content'
  /** An entry's content is gone, but no erasure records it. */
  | 'missing-content'
  /** An erasure names entries it cannot erase. */
  | 'erasure';

export interface HistoryProblem {
  readonly seq: number;
  readonly kind: HistoryProblemKind;
}

/**
 * A stored history that does not verify. It names the kinds of problem
 * only, never an entry or its content, which may hold pupil data.
 */
export class HistoryError extends Error {
  readonly kinds: readonly HistoryProblemKind[];

  constructor(kinds: readonly HistoryProblemKind[]) {
    super(`The history does not verify: ${kinds.join(', ')}`);
    this.name = 'HistoryError';
    this.kinds = kinds;
  }
}

// An app bridge can pass any text, so the day is checked at run time too: a
// clock time must never be stored (PRD §5.5).
function checkDay(day: Day): void {
  if (!isDay(day)) throw new RangeError('The day of a change is written YYYY-MM-DD');
}

function contentText(salt: string, bodyText: string): string {
  return `minhajna/content/1\n${salt}\n${bodyText}`;
}

function headerText(entry: Omit<Entry, 'hash' | 'content'>): string {
  const { id, seq, day, layer, kind, digest, previous } = entry;
  return `minhajna/entry/1\n${canonicalJson({ id, seq, day, layer, kind, digest, previous })}`;
}

interface EntryInput {
  readonly day: Day;
  readonly layer: Layer;
  readonly kind: string;
  readonly body: unknown;
}

async function makeEntry(deps: HistoryDeps, previous: Entry | null, input: EntryInput): Promise<Entry> {
  const bodyText = canonicalJson(input.body);
  const salt = toHex(deps.random(16));
  const header = {
    id: newId(deps.random),
    seq: previous === null ? 0 : previous.seq + 1,
    day: input.day,
    layer: input.layer,
    kind: input.kind,
    digest: await deps.digest(contentText(salt, bodyText)),
    previous: previous === null ? '' : previous.hash,
  };
  // The stored body is parsed back from the hashed text, so what is kept is
  // exactly what was hashed, and later changes to the caller's object cannot
  // reach it.
  const body: unknown = JSON.parse(bodyText);
  return { ...header, hash: await deps.digest(headerText(header)), content: { salt, body } };
}

/** The IDs an erasure entry names, or null if its content is not a list of IDs. */
export function erasedIds(entry: Entry): readonly string[] | null {
  if (entry.kind !== ERASURE || entry.content === null) return null;
  const body = entry.content.body;
  if (typeof body !== 'object' || body === null || !('entries' in body)) return null;
  const ids: unknown = body.entries;
  if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) return null;
  return ids;
}

/** Checks the whole chain. An empty list means nothing was changed outside the app. */
export async function verifyHistory(digest: Digest, entries: readonly Entry[]): Promise<HistoryProblem[]> {
  const problems: HistoryProblem[] = [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const erasedAt = new Map<string, number>();

  for (const entry of entries) {
    if (entry.kind !== ERASURE) continue;
    const ids = erasedIds(entry);
    const valid =
      ids !== null &&
      ids.every((id) => {
        const target = byId.get(id);
        return (
          target !== undefined && target.kind !== ERASURE && target.seq < entry.seq && target.layer === entry.layer
        );
      });
    if (!valid) {
      problems.push({ seq: entry.seq, kind: 'erasure' });
      continue;
    }
    for (const id of ids) if (!erasedAt.has(id)) erasedAt.set(id, entry.seq);
  }

  let previousHash = '';
  for (const [index, entry] of entries.entries()) {
    if (entry.seq !== index) problems.push({ seq: entry.seq, kind: 'sequence' });
    if (entry.previous !== previousHash) problems.push({ seq: entry.seq, kind: 'link' });
    if ((await digest(headerText(entry))) !== entry.hash) problems.push({ seq: entry.seq, kind: 'hash' });
    if (entry.content === null) {
      if (!erasedAt.has(entry.id)) problems.push({ seq: entry.seq, kind: 'missing-content' });
    } else {
      const text = contentText(entry.content.salt, canonicalJson(entry.content.body));
      if ((await digest(text)) !== entry.digest) problems.push({ seq: entry.seq, kind: 'content' });
    }
    previousHash = entry.hash;
  }
  return problems;
}

/** A history that is only ever added to, kept in a store. */
export class HistoryLog {
  readonly #store: HistoryStore;
  readonly #deps: HistoryDeps;
  #entries: Entry[];
  // Appends run one at a time, so no two entries claim the same place in the chain.
  #queue: Promise<unknown> = Promise.resolve();

  private constructor(store: HistoryStore, deps: HistoryDeps, entries: Entry[]) {
    this.#store = store;
    this.#deps = deps;
    this.#entries = entries;
  }

  /**
   * Opens a stored history, but only one that verifies. Nothing in it is
   * acted on before then, so an erasure that fails the checks never runs.
   */
  static async open(store: HistoryStore, deps: HistoryDeps): Promise<HistoryLog> {
    const entries = [...(await store.load())].sort((a, b) => a.seq - b.seq);
    const problems = await verifyHistory(deps.digest, entries);
    if (problems.length > 0) throw new HistoryError([...new Set(problems.map((problem) => problem.kind))]);
    const log = new HistoryLog(store, deps, entries);
    await log.#finishErasures();
    return log;
  }

  get entries(): readonly Entry[] {
    return this.#entries;
  }

  append(day: Day, layer: Layer, kind: string, body: unknown): Promise<Entry> {
    if (kind === ERASURE) return Promise.reject(new Error('Erasures are made with erase()'));
    return this.#serialised(async () => {
      checkDay(day);
      const entry = await makeEntry(this.#deps, this.#entries.at(-1) ?? null, { day, layer, kind, body });
      await this.#store.append(entry);
      this.#entries.push(entry);
      return entry;
    });
  }

  /**
   * Erases the content of entries that share one layer, and records the fact
   * and the day. It erases exactly the entries it is given, even one version
   * of a record alone, so only RecordBook calls it: RecordBook erases whole
   * records.
   */
  erase(day: Day, ids: readonly string[]): Promise<Entry> {
    return this.#serialised(async () => {
      checkDay(day);
      const targets = ids.map((id) => this.#entries.find((entry) => entry.id === id));
      const first = targets[0];
      if (first === undefined) throw new Error('Nothing to erase');
      for (const target of targets) {
        if (target === undefined) throw new Error('Unknown entry');
        if (target.kind === ERASURE) throw new Error('An erasure cannot be erased');
        if (target.layer !== first.layer) throw new Error('Erase one layer at a time');
      }
      // The erasure is stored before the content is removed. If the app stops
      // in between, `open` finishes the job.
      const erasure = await makeEntry(this.#deps, this.#entries.at(-1) ?? null, {
        day,
        layer: first.layer,
        kind: ERASURE,
        body: { entries: [...ids] },
      });
      await this.#store.append(erasure);
      this.#entries.push(erasure);
      await this.#removeContent(ids);
      return erasure;
    });
  }

  async #finishErasures(): Promise<void> {
    const pending = this.#entries
      .flatMap((entry) => erasedIds(entry) ?? [])
      .filter((id) => this.#entries.some((entry) => entry.id === id && entry.content !== null));
    if (pending.length > 0) await this.#removeContent(pending);
  }

  async #removeContent(ids: readonly string[]): Promise<void> {
    await this.#store.eraseContent(ids);
    const erased = new Set(ids);
    this.#entries = this.#entries.map((entry) => (erased.has(entry.id) ? { ...entry, content: null } : entry));
  }

  #serialised<T>(task: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(task);
    this.#queue = result.catch(() => undefined);
    return result;
  }
}
