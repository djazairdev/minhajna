// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The opt-in insights for the teacher of a demo world (#624, answer 695): their
// state, read from the world's kind, its date, the joins its store keeps and
// the world's calendars, the bundled one and the one it published, from which
// its totals are formed, each time the page draws, since the store's entries
// grow in place; the row the teacher's world home carries in place of Settings'
// own, which real mode does not show in 0.7.0; and the insights page it opens,
// until it is closed or the world is left. The classes a national world stops
// are worked out once for each set of joins, and a working out that fails
// leaves a row for each join.

import {
  insightsState,
  keptJoins,
  type Day,
  type DemoSchool,
  type SchoolCalendar,
  type SpaceJoin,
} from '@minhajna/core';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { WorldKit } from '../demo/world-session';
import { InsightsPage } from './InsightsPage';
import { InsightsRow } from './InsightsRow';
import { joinRows, stoppedClasses, type StoppedClass } from './stopped-classes';

export type WorldInsightsInput = {
  readonly open: Pick<OpenWorld, 'kind' | 'date' | 'book'> | null;
  /** The world's calendars: the bundled one, and the one it published laid over it. */
  readonly calendars: readonly SchoolCalendar[];
  readonly school: DemoSchool | null;
  readonly kit: Pick<WorldKit, 'mac'>;
  /** The world's date, written out for the band. */
  readonly date: string;
  readonly dayText: (day: Day) => string;
};

/** The insights' row and, while it is open, their page, with a way to close it. */
export function useWorldInsights({ open, calendars, school, kit, date, dayText }: WorldInsightsInput): {
  readonly row: ReactNode;
  readonly page: ReactNode;
  readonly close: () => void;
} {
  const [shown, setShown] = useState(false);
  const [stopped, setStopped] = useState<{ joins: unknown; rows: readonly StoppedClass[] } | null>(null);
  const state = open === null ? null : insightsState(open.kind, open.date, keptJoins(open.book.entries), calendars);
  const key = JSON.stringify(state?.kind === 'school' ? state.joins : null);
  const joins = useMemo(() => JSON.parse(key) as readonly SpaceJoin[] | null, [key]);
  useEffect(() => {
    if (joins === null) return;
    let live = true;
    stoppedClasses(joins, school, kit.mac).then(
      (rows) => live && setStopped({ joins, rows }),
      () => live && setStopped({ joins, rows: joinRows(joins) }),
    );
    return () => {
      live = false;
    };
  }, [joins, school, kit]);
  const close = () => setShown(false);
  if (state === null) return { row: null, page: null, close };
  return {
    row: <InsightsRow state={state} onPress={() => setShown(true)} />,
    page: shown ? (
      <InsightsPage
        state={state}
        stopped={stopped !== null && stopped.joins === joins ? stopped.rows : null}
        date={date}
        dayText={dayText}
        onClose={close}
      />
    ) : null,
    close,
  };
}
