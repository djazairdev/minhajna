// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's statements received and teachers named (#246, answer 489,
// R-Open, R-5.5-07, R-4.9-01). A statement is kept once its signature checks
// (`checkStatement`, whose success keeping it takes), exactly as signed, with
// how it came; the same signed text is kept once. Reading one back only parses
// it, and one this version cannot read is left out. A statement names no
// teacher, so the reader knows a teacher by the key that signs, and may name
// them: the latest name for a key counts. The first statement kept under a key
// is the one later ones are compared with. A store keeps only the statements
// of its own world (#563): a demo world's store, known by its `world.kept`,
// those signed in that world, and the teacher's own those signed in none.

import { isOneLine } from './calendar-notice-read.ts';
import { canonicalJson } from './canonical.ts';
import type { Day } from './day.ts';
import { eventOf, type RecordEvent } from './events.ts';
import type { Entry } from './history.ts';
import { isFields } from './read.ts';
import { RECEIVED_HOWS, type ReceivedHow, type TeacherName } from './share-events.ts';
import { readStatement, type ProgressStatement } from './statement-read.ts';
import { SIGNED_STATEMENT_FORMAT, statementWorld, type StatementCheck } from './statement-signature.ts';
import { worldIdOfCode } from './world-code.ts';
import { keptWorld } from './world-kept.ts';

export { RECEIVED_HOWS, type ReceivedHow, type ReceivedStatement, type TeacherName } from './share-events.ts';

/** A statement kept in reader mode, read back. */
export interface Received {
  readonly id: string;
  /** The day it was kept. */
  readonly day: Day;
  readonly how: ReceivedHow;
  readonly text: string;
  /** The key that signed it: SPKI, base64. */
  readonly spki: string;
  readonly statement: ProgressStatement;
}

/** The longest name or school a reader may give a teacher. */
export const TEACHER_NAME_LIMIT = 80;

/** A signed statement's key and statement, read without checking the signature again. */
function opened(
  text: string,
  world: string | null,
): { readonly spki: string; readonly statement: ProgressStatement } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isFields(raw) || raw['format'] !== SIGNED_STATEMENT_FORMAT || statementWorld(raw) !== world) return null;
  const { spki, payload } = raw;
  if (typeof spki !== 'string' || spki === '' || typeof payload !== 'string') return null;
  const read = readStatement(payload);
  return read.ok ? { spki, statement: read.value } : null;
}

/** The world a store belongs to, by its ID, or null for the teacher's own. */
export function storeWorld(entries: readonly Entry[]): string | null {
  const kept = keptWorld(entries);
  return kept === null ? null : worldIdOfCode(kept.code);
}

const isHow = (value: unknown): value is ReceivedHow => (RECEIVED_HOWS as readonly unknown[]).includes(value);

const received = new WeakMap<readonly Entry[], { readonly last: Entry | undefined; readonly list: Received[] }>();

/** The statements kept, in the order they came, each signed text once; kept while the history ends the same. */
export function receivedStatements(entries: readonly Entry[]): Received[] {
  const known = received.get(entries);
  if (known !== undefined && known.last === entries.at(-1)) return known.list;
  const texts = new Set<string>();
  const list: Received[] = [];
  const world = storeWorld(entries);
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind !== 'statement.received' || !isHow(event.received.how) || texts.has(event.received.text)) continue;
    const read = opened(event.received.text, world);
    if (read === null) continue;
    texts.add(event.received.text);
    list.push({ ...event.received, day: entry.day, ...read });
  }
  received.set(entries, { last: entries.at(-1), list });
  return list;
}

/** The latest name the reader gave each key. */
export function teacherNames(entries: readonly Entry[]): Map<string, TeacherName> {
  const names = new Map<string, TeacherName>();
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind === 'teacher.named') names.set(event.named.spki, event.named);
  }
  return names;
}

/**
 * The record keeping a statement, given `checkStatement`'s success for its
 * text, or null when the same signed text is kept already; throws for text
 * that is no signed statement, belongs to another world than the store's, or
 * was checked as another statement or under another key.
 */
export function receiveStatement(
  entries: readonly Entry[],
  text: string,
  checked: Extract<StatementCheck, { ok: true }>,
  how: ReceivedHow,
  id: string,
): RecordEvent | null {
  const read = opened(text, storeWorld(entries));
  const same = read !== null && canonicalJson(read.statement) === canonicalJson(checked.statement);
  if (!same || read.spki !== checked.spki || !isHow(how)) throw new RangeError('Not a signed statement');
  if (receivedStatements(entries).some((one) => one.text === text)) return null;
  return { kind: 'statement.received', received: { id, text, how } };
}

/** The record naming the teacher who signs with a key; throws for an empty or overlong name or school. */
export function nameTeacher(spki: string, name: string, school = ''): RecordEvent {
  const [who, where] = [name.trim(), school.trim()];
  const fits = (value: string) => value === '' || isOneLine(value, TEACHER_NAME_LIMIT);
  if (spki === '' || who === '' || !fits(who) || !fits(where)) throw new RangeError('Not a teacher name');
  return { kind: 'teacher.named', named: { spki, name: who, ...(where !== '' && { school: where }) } };
}

/** The first statement kept under a key, which later ones from it are compared with. */
export function firstUnderKey(list: readonly Received[], spki: string): Received | undefined {
  return list.find((one) => one.spki === spki);
}
