// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What Today records on a tap, and how «تراجع» brings back what was there
// before (#32, #33, #35). A second choice for the same session keeps the
// first one's undo, so the undo brings back what was there before the sheet,
// note included. A reason for a skip or a session not held goes into the
// session's private note only.

import {
  confirmSessions,
  current,
  refOf,
  type Choice,
  type Context,
  type Reason,
  type RecordEvent,
  type TodaySession,
} from '@minhajna/core';
import { useState } from 'react';
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

  const confirm = (item: TodaySession, choice?: Choice) => {
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
    recordAll(confirmSessions(context, [{ session: item.session, ...(choice !== undefined && { choice }) }]));
    const kind = choice?.outcome;
    const message = t(
      kind === 'partial' ? 'outcome.snackPartial' : kind === 'not-held' ? 'outcome.snackNotHeld' : 'today.snack',
    );
    setDone({ key, undo, message });
  };

  const confirmAll = (items: readonly TodaySession[], key = 'backlog') => {
    recordAll(
      confirmSessions(
        context,
        items.map((item) => ({ session: item.session })),
      ),
    );
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
    recordAll(done.undo);
    setDone(null);
  };

  return { done, confirm, confirmAll, keepReason, undo };
}
