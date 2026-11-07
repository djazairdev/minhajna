// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The joining codes the phone keeps (answer 808), one for each school it
// joined, in the device layer, so it never leaves the phone with the records:
// the update in Settings sends it again to fetch what the school changed. The
// last one kept for a school stands, and a dropped one leaves it out.

import { readJoiningCode } from './directory-book.ts';
import type { DirectoryJoined } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';

/** The event that keeps `code` for the phone's school `school`, or drops it with null; refuses a bad code. */
export function keepJoiningCode(
  school: string,
  code: string | null,
): { readonly kind: 'directory.joined'; readonly joined: DirectoryJoined } {
  const read = code === null ? null : readJoiningCode(code);
  if (code !== null && read === null) throw new RangeError('Not a joining code');
  return { kind: 'directory.joined', joined: { school, code: read } };
}

/** Each school's joining code, by the phone's school ID, the last one kept; any that does not read is left out. */
export function joiningCodes(entries: readonly Entry[]): ReadonlyMap<string, string> {
  const codes = new Map<string, string>();
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind !== 'directory.joined') continue;
    const school: unknown = event.joined?.school;
    if (typeof school !== 'string') continue;
    const code = typeof event.joined.code === 'string' ? readJoiningCode(event.joined.code) : null;
    if (code === null) codes.delete(school);
    else codes.set(school, code);
  }
  return codes;
}
