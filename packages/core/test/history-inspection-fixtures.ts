// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalJson, HistoryLog, MemoryStore, type Entry, type Layer } from '../src/index.ts';
import { d } from './fixtures.ts';
import { deps } from './support.ts';

/** Synthetic lesson and private entries; no pupil or real school data. */
export async function inspectionSample() {
  const store = new MemoryStore();
  const log = await HistoryLog.open(store, deps);
  await log.append(d('2026-10-20'), 'lesson-record', 'example', { value: 'first' });
  await log.append(d('2026-10-21'), 'private', 'example', { value: 'private synthetic note' });
  await log.append(d('2026-10-21'), 'lesson-record', 'example', { value: 'third' });
  return { store, log, entries: [...log.entries] };
}

/** A correctly hashed entry for testing semantic faults and the unsigned chain's limits. */
export async function inspectionEntry(
  entries: readonly Entry[],
  fields: { kind?: string; layer?: Layer; body?: unknown; id?: string } = {},
): Promise<Entry> {
  const body = Object.hasOwn(fields, 'body') ? fields.body : { value: 'synthetic' };
  const salt = '0'.repeat(32);
  const header = {
    id: fields.id ?? 'f'.repeat(32),
    seq: entries.length,
    day: d('2026-10-22'),
    layer: fields.layer ?? 'lesson-record',
    kind: fields.kind ?? 'example',
    digest: await deps.digest(`minhajna/content/1\n${salt}\n${canonicalJson(body)}`),
    previous: entries.at(-1)?.hash ?? '',
  };
  return {
    ...header,
    hash: await deps.digest(`minhajna/entry/1\n${canonicalJson(header)}`),
    content: { salt, body },
  };
}
