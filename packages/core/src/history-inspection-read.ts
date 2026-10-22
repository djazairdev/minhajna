// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalJson } from './canonical.ts';
import { isDay } from './day.ts';
import type { Entry } from './history.ts';
import { LAYERS, type Layer } from './layers.ts';

const hex = (value: unknown, length: number): value is string =>
  typeof value === 'string' && value.length === length && /^[0-9a-f]+$/.test(value);
function plain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Inspection results cannot be changed after their integrity status was computed. */
export function freezeInspection<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeInspection(child);
    Object.freeze(value);
  }
  return value;
}

/** Validate and detach a JSON entry; unknown envelope fields and unreadable payloads never escape. */
export function inspectionEntry(value: unknown): Entry | null {
  try {
    if (!plain(value)) return null;
    const { id, seq, day, layer, kind, digest, previous, hash, content } = value;
    if (
      !hex(id, 32) ||
      typeof seq !== 'number' ||
      !Number.isSafeInteger(seq) ||
      seq < 0 ||
      typeof day !== 'string' ||
      !isDay(day) ||
      !LAYERS.includes(layer as Layer) ||
      typeof kind !== 'string' ||
      kind.trim() === '' ||
      !hex(digest, 64) ||
      (previous !== '' && !hex(previous, 64)) ||
      !hex(hash, 64) ||
      (content !== null && (!plain(content) || !hex(content.salt, 32) || !Object.hasOwn(content, 'body')))
    )
      return null;
    const kept = {
      id,
      seq,
      day,
      layer,
      kind,
      digest,
      previous,
      hash,
      content: content === null ? null : { salt: content.salt, body: content.body },
    };
    return freezeInspection(JSON.parse(canonicalJson(kept)) as Entry);
  } catch {
    return null;
  }
}

/** Detach every row before hashing; an unreadable container never leaks its exception or becomes an empty log. */
export function inspectionEntries(input: unknown): readonly (Entry | null)[] {
  if (!Array.isArray(input)) throw new TypeError('A history must be an array');
  try {
    return Array.from({ length: input.length }, (_, position) => inspectionEntry(input[position]));
  } catch {
    throw new Error('History inspection is unavailable');
  }
}
