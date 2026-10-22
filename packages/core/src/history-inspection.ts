// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// R-5.5-04: inspect without opening a writable book, replaying an erasure,
// sorting, repairing or saving anything. Only a contiguous, self-consistent
// prefix can expose content. A later valid hash is not a new trust anchor.
// An unsigned hash chain proves neither authorship nor completeness.

import { canonicalJson } from './canonical.ts';
import { freezeInspection, inspectionEntries } from './history-inspection-read.ts';
import { contentText, headerText } from './history-text.ts';
import { ERASURE, erasedIds, type Digest, type Entry, type HistoryProblemKind } from './history.ts';

/**
 * Structure and duplicate-identity faults join the existing integrity problems, without payload details;
 * 'unverified-erasure' marks a body an erasure removed when that erasure lies past the consistent prefix.
 */
export type HistoryInspectionProblemKind = HistoryProblemKind | 'structure' | 'identity' | 'unverified-erasure';

/** Unchecked bodies and salts are withheld; an erased body is never reconstructed from an older copy. */
export interface HistoryInspectionRow {
  readonly position: number;
  readonly status: 'consistent' | 'unverified' | 'unreadable';
  readonly contentStatus: 'available' | 'erased' | 'withheld';
  readonly entry: Entry | null;
  readonly problems: readonly HistoryInspectionProblemKind[];
}

/** A read-only view, not recovered application state or proof of a complete, authentic history. */
export interface HistoryInspection {
  readonly readOnly: true;
  readonly integrity: 'intact' | 'broken';
  readonly consistentPrefixLength: number;
  readonly rows: readonly HistoryInspectionRow[];
}

async function checkedDigest(digest: Digest, text: string): Promise<string> {
  try {
    const result = await digest(text);
    if (!/^[0-9a-f]{64}$/.test(result)) throw new Error();
    return result;
  } catch {
    throw new Error('History inspection is unavailable');
  }
}

/** Validate an erasure against unique, earlier entries in the same layer, without applying it. */
function erasureTargets(
  entry: Entry,
  position: number,
  byId: ReadonlyMap<string, number[]>,
  entries: readonly (Entry | null)[],
) {
  const ids = erasedIds(entry);
  if (ids === null) return null;
  return ids.every((id) => {
    const matches = byId.get(id);
    const targetPosition = matches?.length === 1 ? matches[0] : undefined;
    const target = targetPosition === undefined ? null : entries[targetPosition];
    return (
      targetPosition !== undefined &&
      targetPosition < position &&
      target !== null &&
      target !== undefined &&
      target.seq < entry.seq &&
      target.kind !== ERASURE &&
      target.layer === entry.layer
    );
  })
    ? ids
    : null;
}

/** Inspect untrusted loaded rows in their supplied order; the caller never grants a writable store. */
export async function inspectHistory(digest: Digest, input: unknown): Promise<HistoryInspection> {
  const entries = inspectionEntries(input);
  const problems: HistoryInspectionProblemKind[][] = entries.map((entry) => (entry === null ? ['structure'] : []));
  const byId = new Map<string, number[]>();
  entries.forEach((entry, position) => {
    if (entry === null) return;
    const positions = byId.get(entry.id) ?? [];
    positions.push(position);
    byId.set(entry.id, positions);
  });
  for (const positions of byId.values()) {
    if (positions.length > 1) for (const position of positions) problems[position]!.push('identity');
  }
  for (const [position, entry] of entries.entries()) {
    if (entry === null) continue;
    if (entry.seq !== position) problems[position]!.push('sequence');
    if (entry.previous !== (position === 0 ? '' : entries[position - 1]?.hash)) problems[position]!.push('link');
    if ((await checkedDigest(digest, headerText(entry))) !== entry.hash) problems[position]!.push('hash');
    if (entry.content !== null) {
      const text = contentText(entry.content.salt, canonicalJson(entry.content.body));
      if ((await checkedDigest(digest, text)) !== entry.digest) problems[position]!.push('content');
    }
  }
  const erasedAt = new Map<string, number>();
  for (const [position, entry] of entries.entries()) {
    if (entry?.kind !== ERASURE) continue;
    const ids = erasureTargets(entry, position, byId, entries);
    if (ids === null) problems[position]!.push('erasure');
    else for (const id of ids) if (!erasedAt.has(id)) erasedAt.set(id, position);
  }
  let boundary = problems.findIndex((one) => one.length > 0);
  if (boundary === -1) boundary = entries.length;
  for (let position = entries.length - 1; position >= 0; position -= 1) {
    const entry = entries[position];
    if (entry?.content !== null) continue;
    const erasure = erasedAt.get(entry.id);
    if (erasure === undefined || erasure >= boundary) {
      problems[position]!.push(erasure === undefined ? 'missing-content' : 'unverified-erasure');
      boundary = Math.min(boundary, position);
    }
  }
  const rows = entries.map((entry, position): HistoryInspectionRow => {
    const consistent = position < boundary;
    const erased = entry !== null && (erasedAt.get(entry.id) ?? entries.length) < boundary;
    return {
      position,
      status: entry === null ? 'unreadable' : consistent ? 'consistent' : 'unverified',
      contentStatus: !consistent ? 'withheld' : erased ? 'erased' : 'available',
      entry: entry === null ? null : !consistent || erased ? { ...entry, content: null } : entry,
      problems: problems[position]!,
    };
  });
  return freezeInspection({
    readOnly: true,
    integrity: boundary === entries.length ? 'intact' : 'broken',
    consistentPrefixLength: boundary,
    rows,
  });
}
