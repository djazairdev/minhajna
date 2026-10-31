// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How Week-sign names a session (#582, answer 610): its day, its span, its
// group when it has one and, for a session of week A or B, its week; and what
// is said once a session's state changes: the session and its state, in lower
// case after the colon, then, once it is confirmed, the next session awaiting
// confirmation, or that none is left and signing is; a session changed back to
// awaiting is said alone.

import type { SessionState, WeekSession } from '@minhajna/core';
import type { TFunction } from 'i18next';
import { spanText } from '../timetable/grid-text';
import { isolate } from './grid-labels';

/** A session's day, span, group and week, as the page shows and says it. */
export const slotText = (t: TFunction, one: Omit<WeekSession, 'state'>) =>
  [t(`week.days.${one.day}`), spanText(one.start, one.end), one.group === '' ? '' : isolate(one.group)]
    .concat(one.week === 'both' ? [] : [t(one.week === 'A' ? 'ttImport.weekA' : 'ttImport.weekB')])
    .filter((part) => part !== '')
    .join(' · ');

/** What is said as a session's state changes: it and its state, then, if confirmed, the next or that none is left. */
export function confirmedText(
  t: TFunction,
  one: Omit<WeekSession, 'state'>,
  state: SessionState,
  next: Omit<WeekSession, 'state'> | undefined,
): string {
  const done = t('demo.weekSign.confirmed', { session: slotText(t, one), state: t(`demo.weekSign.spoken.${state}`) });
  if (state === 'awaiting') return done;
  const after =
    next === undefined ? t('demo.weekSign.noneLeft') : t('demo.weekSign.next', { session: slotText(t, next) });
  return `${done} ${after}`;
}
