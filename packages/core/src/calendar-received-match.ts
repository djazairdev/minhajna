// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalJson } from './canonical.ts';
import type { CalendarEntry } from './reference.ts';

/** A reference replaces a received copy only under the same stable ID, layer, effect and scope. */
export function replacesReceived(reference: CalendarEntry, own: CalendarEntry): boolean {
  return (
    own.received !== undefined &&
    reference.id === own.id &&
    reference.layer === own.layer &&
    reference.effect === own.effect &&
    reference.schoolId === own.schoolId &&
    reference.zone === own.zone &&
    canonicalJson(reference.levels ?? []) === canonicalJson(own.levels ?? []) &&
    canonicalJson(reference.grades ?? []) === canonicalJson(own.grades ?? [])
  );
}

/** Whether a received copy gives way: to a reference that replaces it, or to an update that replaced or took out its ID. */
export function receivedSuperseded(
  own: CalendarEntry,
  reference: readonly CalendarEntry[],
  updatedIds: readonly string[] = [],
): boolean {
  return (
    own.received !== undefined && (updatedIds.includes(own.id) || reference.some((base) => replacesReceived(base, own)))
  );
}
