// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a demo world's own store keeps of the world (#560, answers 572 and
// 573): its kind and its code, so whoever shows the demo can read the code
// again, and on the device that started it the starter token, which moves the
// world's date. They are device-layer events in the world's store alone, so
// nothing exports them; they go with the store, which the app erases when the
// server no longer knows the code entered, and erasing the device erases with
// the rest. The latest event that reads counts; one that does not is ignored.

import { isDay } from './day.ts';
import { RELEASE } from './read.ts';
import type { KeptPackPin, WorldKept } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { readWorldCode } from './world-code.ts';
import { WORLD_KINDS, type WorldKind } from './world-keys.ts';

export type { KeptPackPin, WorldKept } from './device-events.ts';

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/u;
const COURSE_MOST = 300;

/** The pack-editor accounts' tokens that read, by role, or none. */
function readPackAccounts(value: unknown): WorldKept['packAccounts'] {
  if (typeof value !== 'object' || value === null) return undefined;
  const { curator, ministry } = value as Record<string, unknown>;
  const reads = (token: unknown): token is string => typeof token === 'string' && TOKEN.test(token);
  return { ...(reads(curator) ? { curator } : {}), ...(reads(ministry) ? { ministry } : {}) };
}

/** The pins that read, by course; those that don't are left out. */
function readPackPins(value: unknown): WorldKept['packPins'] {
  if (typeof value !== 'object' || value === null) return undefined;
  const reads = ([course, pin]: [string, unknown]) => {
    const { id, release, day } = (pin ?? {}) as Partial<KeptPackPin>;
    return (
      course.length <= COURSE_MOST &&
      typeof id === 'string' &&
      typeof release === 'string' &&
      RELEASE.test(release) &&
      typeof day === 'string' &&
      isDay(day)
    );
  };
  return Object.fromEntries(Object.entries(value).filter(reads));
}

/** A kept world's facts, as the store may hold them, or null when they do not read. */
export function readWorldKept(value: unknown): WorldKept | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, code, starter, packAccounts, packPins } = value as Record<string, unknown>;
  if (!WORLD_KINDS.includes(kind as WorldKind) || typeof code !== 'string') return null;
  const read = readWorldCode(code);
  if ('problem' in read || read.code !== code) return null;
  if (starter !== null && (typeof starter !== 'string' || !TOKEN.test(starter))) return null;
  const accounts = readPackAccounts(packAccounts);
  const pins = readPackPins(packPins);
  return {
    kind: kind as WorldKind,
    code,
    starter,
    ...(accounts === undefined ? {} : { packAccounts: accounts }),
    ...(pins === undefined ? {} : { packPins: pins }),
  };
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
