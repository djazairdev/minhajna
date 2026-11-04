// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The opt-in insights for the teacher of a demo world (#624, answer 695): their
// state, read from the world's kind, its date, the joins its store keeps and
// the world's calendars, the bundled one and the one it published, from which
// its totals are formed, each time the page draws, since the store's entries
// grow in place; the row the teacher's world home carries in place of Settings'
// own, which real mode does not show in 0.7.0; and the insights page it opens,
// until it is closed or the world is left; in a teachers' world, the page opens
// with the switch to take part and each class's exact sending, and while it is
// on the sendings due go out (use-insights-sending.ts, #622). The classes a
// national world stops are worked out once for each set of joins, and a working
// out that fails leaves a row for each join.

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
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import { worldRequest } from '../network/world-network';
import { WorldOptin } from './InsightsOptin';
import { InsightsPage } from './InsightsPage';
import { InsightsRow } from './InsightsRow';
import { joinRows, stoppedClasses, type StoppedClass } from './stopped-classes';
import { useInsightsSending } from './use-insights-sending';

export type WorldInsightsInput = {
  readonly open: Pick<OpenWorld, 'world' | 'kind' | 'date' | 'book'> | null;
  /** The world's calendars: the bundled one, and the one it published laid over it. */
  readonly calendars: readonly SchoolCalendar[];
  readonly school: DemoSchool | null;
  readonly kit: Pick<WorldKit, 'mac' | 'random'>;
  /** The bundled reference data, from which a teachers' world's sendings are worked out; none without it. */
  readonly reference?: TermReference;
  readonly storage: Pick<StorageSpec, 'digest'>;
  /** How the world's requests go, a teachers' world's insights among them; the world's client by default. */
  readonly send?: Send;
  /** The world's date, written out for the band. */
  readonly date: string;
  readonly dayText: (day: Day) => string;
};

/** The insights' row and, while it is open, their page, with a way to close it. */
export function useWorldInsights(input: WorldInsightsInput): {
  readonly row: ReactNode;
  readonly page: ReactNode;
  readonly close: () => void;
} {
  const { open, calendars, school, kit, reference, storage, send = worldRequest, date, dayText } = input;
  const [shown, setShown] = useState(false);
  const digest = useMemo(
    () => (text: string) => storage.digest([text]).then(([hash]) => hash ?? Promise.reject(new Error('No digest'))),
    [storage],
  );
  const [stopped, setStopped] = useState<{ joins: unknown; rows: readonly StoppedClass[] } | null>(null);
  const state = open === null ? null : insightsState(open.kind, open.date, keptJoins(open.book.entries), calendars);
  const key = JSON.stringify(state?.kind === 'school' ? state.joins : null);
  const teaching = state?.kind === 'teacher' ? open : null;
  const taking = useInsightsSending({ open: teaching, reference, kit, digest, send });
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
    row: <InsightsRow state={state} on={taking.choice.on} onPress={() => setShown(true)} />,
    page: shown ? (
      <InsightsPage
        state={state}
        stopped={stopped !== null && stopped.joins === joins ? stopped.rows : null}
        date={date}
        dayText={dayText}
        optin={
          open !== null && reference !== undefined ? (
            <WorldOptin
              world={open.world}
              date={open.date}
              book={open.book}
              reference={reference}
              kit={kit}
              digest={digest}
              choice={taking.choice}
              status={taking.status}
              onChoose={taking.choose}
              onRetry={taking.retry}
              unkept={taking.unkept}
            />
          ) : undefined
        }
        onClose={close}
      />
    ) : null,
    close,
  };
}
