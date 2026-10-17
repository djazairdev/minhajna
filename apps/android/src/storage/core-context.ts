// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The bundled reference data and the teacher's records, as the core reads
// them, for the screens that ask it for sessions, proposals or pacing.

import { makeContext, packKey, type Context } from '@minhajna/core';
import type { AppData } from './AppData';

export function coreContext(data: Pick<AppData, 'profile' | 'year' | 'calendar' | 'packs' | 'state'>): Context {
  const packs = new Map(data.packs.map((pack) => [packKey(pack.id, pack.release), pack]));
  return makeContext({ country: data.profile, year: data.year, calendar: data.calendar, packs }, data.state);
}
