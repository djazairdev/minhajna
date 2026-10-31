// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a demo world's own store keeps of the world (#560, answers 572 and
// 573): its kind and its code, so whoever shows the demo can read the code
// again, and on the device that started it the starter token, which moves the
// world's date. They are device-layer events in the world's store alone, so
// nothing exports them; they go with the store, which the app erases when the
// server no longer knows the code entered, and erasing the device erases with
// the rest. The latest event that reads counts; one that does not is ignored.

import type { WorldKept } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { readWorldCode } from './world-code.ts';
import { WORLD_KINDS, type WorldKind } from './world-keys.ts';

export type { WorldKept } from './device-events.ts';

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/u;

/** A kept world's facts, as the store may hold them, or null when they do not read. */
export function readWorldKept(value: unknown): WorldKept | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, code, starter } = value as Record<string, unknown>;
  if (!WORLD_KINDS.includes(kind as WorldKind) || typeof code !== 'string') return null;
  const read = readWorldCode(code);
  if ('problem' in read || read.code !== code) return null;
  if (starter !== null && (typeof starter !== 'string' || !TOKEN.test(starter))) return null;
  return { kind: kind as WorldKind, code, starter };
}

/** The world a store belongs to, from its latest `world.kept` event that reads, or null. */
export function keptWorld(entries: readonly Entry[]): WorldKept | null {
  let kept: WorldKept | null = null;
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind !== 'world.kept') continue;
    kept = readWorldKept(event.kept) ?? kept;
  }
  return kept;
}
