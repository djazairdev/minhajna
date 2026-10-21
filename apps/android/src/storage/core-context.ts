// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The bundled reference data and the teacher's records, as the core reads
// them, for the screens that ask it for sessions, proposals or pacing. The
// calendar's release goes with it, so the signed updates the app was built
// with, or before, are not laid over it again (#223).

import { makeContext, packKey, type Context } from '@minhajna/core';
import type { AppData } from './AppData';

/** The context as it was before one applied update, from the bundled calendar and the other updates. */
export function contextWithout(
  data: Pick<AppData, 'profile' | 'year' | 'bundledCalendar' | 'calendarRelease' | 'packs' | 'state'>,
  release: string,
): Context {
  const calendarUpdates = data.state.calendarUpdates.filter((one) => one.update.release !== release);
  return coreContext({ ...data, calendar: data.bundledCalendar, state: { ...data.state, calendarUpdates } });
}

export function coreContext(
  data: Pick<AppData, 'profile' | 'year' | 'calendar' | 'calendarRelease' | 'packs' | 'state'>,
): Context {
  const packs = new Map(data.packs.map((pack) => [packKey(pack.id, pack.release), pack]));
  const { profile: country, year, calendar, calendarRelease } = data;
  return makeContext({ country, year, calendar, calendarRelease, packs }, data.state);
}
