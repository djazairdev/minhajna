// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What Today records on a tap, and how «تراجع» brings back what was there
// before (#32, #33, #35). A second choice for the same session keeps the
// first one's undo, so the undo brings back what was there before the sheet,
// note included. A reason for a skip or a session not held goes into the
// session's private note only. In a pilot build, a first confirmation is
// timed (#220): in one tap from its card, or with the sheet's choice; a tap
// confirming several sessions splits its time among them. A timing is held
// while «تراجع» can still undo it, and kept once another tap replaces it,
// another screen covers Today, the app goes to the background or Today
// closes: an undo drops it, and a second choice for the same session adds
// its time and makes it no longer one tap.

import {
  confirmSessions,
  current,
  refOf,
  type Choice,
  type Context,
  type Details,
  type Reason,
  type RecordEvent,
  type TodaySession,
  type Timing,
} from '@minhajna/core';
import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePilotTiming } from '../pilot/pilot-timing';
import type { useText } from '../text/i18n';

/** The sessions just recorded, and the events that bring back what was there before. */
export type Done = { readonly key: string; readonly undo: readonly RecordEvent[]; readonly message: string };

/**
 * Today's taps: one session confirmed or given another outcome, awaiting
 * sessions confirmed at once (a week of the backlog, or a joint class's
 * years), a reason kept, and the undo of the last of them.
 */
export function useTodayActions(
  context: Context,
  t: ReturnType<typeof useText>,
  record: (event: RecordEvent) => void,
  recordAll: (events: readonly RecordEvent[]) => void,
) {
  const { state } = context;
  const [done, setDone] = useState<Done | null>(null);
  const pilot = usePilotTiming();
  const held = useRef<readonly Timing[]>([]);
  const keep = useRef(pilot.keep);
  useEffect(() => {
    keep.current = pilot.keep;
  }, [pilot]);
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    const flush = () => {
      keep.current(held.current);
      held.current = [];
    };
    const app = AppState.addEventListener('change', (status) => {
      if (status === 'background') flush();
    });
    const blur = navigation?.addListener('blur', flush);
    return () => {
      app.remove();
      blur?.();
      flush();
    };
  }, [navigation]);
  const hold = (timings: readonly Timing[]) => {
    pilot.keep(held.current);
    held.current = timings;
  };

  const confirm = (item: TodaySession, choice?: Choice, details?: Details) => {
    const key = item.session.key;
    const before = current(state.sessions.get(key));
    const undo: readonly RecordEvent[] =
      done?.key === key
        ? done.undo
        : [
            before === null
              ? { kind: 'session.withdrawn', session: refOf(item.session) }
              : { kind: 'session.recorded', record: before },
          ];
    const given = { ...(choice !== undefined && { choice }), ...(details !== undefined && { details }) };
    recordAll(confirmSessions(context, [{ session: item.session, ...given }]));
    const tenths = pilot.lap();
    if (done?.key === key) {
      held.current = held.current.map((one) => ({ ...one, tenths: one.tenths + tenths, oneTap: false }));
    } else {
      hold(before === null ? pilot.timings('session', 1, tenths, choice === undefined) : []);
    }
    const kind = choice?.outcome;
    const message = t(
      kind === 'partial' ? 'outcome.snackPartial' : kind === 'not-held' ? 'outcome.snackNotHeld' : 'today.snack',
    );
    setDone({ key, undo, message });
  };

  const confirmAll = (
    items: readonly TodaySession[],
    key = 'backlog',
    detailsOf: (item: TodaySession) => Details | undefined = () => undefined,
  ) => {
    recordAll(
      confirmSessions(
        context,
        items.map((item) => {
          const details = detailsOf(item);
          return { session: item.session, ...(details !== undefined && { details }) };
        }),
      ),
    );
    hold(pilot.timings('session', items.length, pilot.lap(), true));
    setDone({
      key,
      undo: items.map((item) => ({ kind: 'session.withdrawn', session: refOf(item.session) })),
      message: t('backlog.snack', { count: items.length }),
    });
  };

  const keepReason = (item: TodaySession, reason: Reason | undefined, text: string | undefined) => {
    const key = item.session.key;
    const earlier = state.notes.get(key);
    if (earlier?.reason === reason && earlier?.reasonText === text) return;
    record({
      kind: 'session.noted',
      note: {
        sessionKey: key,
        ...(earlier?.note !== undefined && { note: earlier.note }),
        ...(reason !== undefined && { reason }),
        ...(text !== undefined && { reasonText: text }),
      },
    });
    if (done?.key === key && !done.undo.some((event) => event.kind === 'session.noted')) {
      setDone({ ...done, undo: [...done.undo, { kind: 'session.noted', note: earlier ?? { sessionKey: key } }] });
    }
  };

  const undo = () => {
    if (done === null) return;
    held.current = [];
    recordAll(done.undo);
    setDone(null);
  };

  return { done, confirm, confirmAll, keepReason, undo };
}
