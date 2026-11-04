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
// on the sendings due go out (use-insights-sending.ts, #622), with the log of
// what was sent and what the app connects to, each over the page, which stays
// mounted under it, keeping its place, its chosen class and its sendings. The
// classes a national world stops are worked out once for each set of joins, and
// a working out that fails leaves a row for each join.

import {
  insightsLog,
  insightsState,
  keptJoins,
  type Day,
  type DemoSchool,
  type SchoolCalendar,
  type SpaceJoin,
} from '@minhajna/core';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import { worldRequest } from '../network/world-network';
import { WorldOptin } from './InsightsOptin';
import { InsightsHelp } from './InsightsHelp';
import { InsightsLog } from './InsightsLog';
import { InsightsPage } from './InsightsPage';
import { InsightsRow } from './InsightsRow';
import { insightsStyles } from './insights-styles';
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
  const [shown, setShown] = useState<'page' | 'log' | 'help' | null>(null);
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
  const close = () => setShown(null);
  const back = () => setShown('page');
  if (state === null) return { row: null, page: null, close };
  const over =
    shown === 'log' && teaching !== null && reference !== undefined ? (
      <InsightsLog
        lines={insightsLog(teaching.book.entries)}
        className={(id) => taking.mine?.school.classes.find((one) => one.id === id)?.name ?? id}
        reference={reference}
        date={date}
        dayText={dayText}
        failed={taking.status.kind === 'failed'}
        onClose={back}
      />
    ) : shown === 'help' && teaching !== null ? (
      <InsightsHelp on={taking.choice.on} date={date} onClose={back} />
    ) : null;
  return {
    row: <InsightsRow state={state} on={taking.choice.on} onPress={() => setShown('page')} />,
    page:
      shown === null ? null : (
        <>
          <View style={over === null ? insightsStyles.full : insightsStyles.gone}>
            <InsightsPage
              state={state}
              stopped={stopped !== null && stopped.joins === joins ? stopped.rows : null}
              date={date}
              dayText={dayText}
              optin={
                teaching !== null && reference !== undefined ? (
                  <WorldOptin
                    world={teaching.world}
                    date={teaching.date}
                    book={teaching.book}
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
              {...(teaching !== null && reference !== undefined && { onLog: () => setShown('log') })}
              {...(teaching !== null && { onHelp: () => setShown('help') })}
              opened={shown === 'page' ? null : shown}
              onClose={close}
            />
          </View>
          {over}
        </>
      ),
    close,
  };
}
