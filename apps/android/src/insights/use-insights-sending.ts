// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking part in a teachers' world's insights, and sending them (#622,
// R-1.6-01, answer 697): the teacher's choice, read from the world's store each
// time the page draws, since its entries grow in place, and recorded there
// under the world's date; and, while it is on and the world is open, the
// sendings due go out (send-insights.ts) whenever the world's date or the
// choice changes, or the teacher tries again after a failure. What is said is
// the outcome of the try since the world's date or the choice last changed,
// that nothing is waiting, or that it is still going; and a choice the store
// did not keep is said too, in that world alone, the switch staying as it was.

import {
  insightsChoice,
  worldTeacher,
  type Day,
  type InsightsChoice,
  type RandomBytes,
  type RecordBook,
  type WorldMac,
  type WorldTeacher,
} from '@minhajna/core';
import { useEffect, useMemo, useState } from 'react';
import type { Send } from '../demo/world-session';
import { seededWorld } from '../director/director-world';
import type { TermReference } from '../director/seeded-fill';
import { sendDueInsights, waitingSendings } from './send-insights';

/**
 * How the sending stands: off, going, done with how many the server took, done but for a class with no sending to
 * make, or failed.
 */
export type SendingStatus =
  | { readonly kind: 'off' }
  | { readonly kind: 'working' }
  | { readonly kind: 'done'; readonly taken: number }
  | { readonly kind: 'partial' }
  | { readonly kind: 'failed' };

export type InsightsSendingInput = {
  /** The open teachers' world, or null outside one. */
  readonly open: { readonly world: string; readonly date: Day; readonly book: RecordBook } | null;
  readonly reference?: TermReference;
  readonly kit: { readonly mac: WorldMac; readonly random: RandomBytes };
  readonly digest: (text: string) => Promise<string>;
  readonly send: Send;
};

/** The teacher's choice, a way to change it, and how the sending stands, with a way to try again. */
export function useInsightsSending({ open, reference, kit, digest, send }: InsightsSendingInput): {
  readonly choice: InsightsChoice;
  readonly status: SendingStatus;
  readonly choose: (on: boolean) => void;
  readonly retry: () => void;
  /** Whether the last choice in this world could not be kept. */
  readonly unkept: boolean;
  /** The world's teacher, as every device rebuilds them, or null without one. */
  readonly mine: WorldTeacher | null;
} {
  const [chosen, setChosen] = useState<{ count: number; unkept: string | null }>({ count: 0, unkept: null });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; status: SendingStatus } | null>(null);
  const world = open?.world ?? null;
  const mine = useMemo(
    () => (world === null || reference === undefined ? null : worldTeacher(seededWorld(world, reference))),
    [world, reference],
  );
  const choice = open === null ? { on: false, since: null } : insightsChoice(open.book.entries);
  const key = JSON.stringify([world, open?.date ?? null, choice, chosen.count, attempt]);
  const book = open?.book ?? null;
  const date = open?.date ?? null;
  const going =
    choice.on && world !== null && mine !== null && reference !== undefined && book !== null && date !== null;
  useEffect(() => {
    if (!going) return;
    let live = true;
    const wanted = () => live;
    sendDueInsights({ world, mine, date, book, reference, kit, digest, send, wanted }).then(
      ({ taken, unsent }) =>
        live && setResult({ key, status: unsent > 0 ? { kind: 'partial' } : { kind: 'done', taken } }),
      () => live && setResult({ key, status: { kind: 'failed' } }),
    );
    return () => {
      live = false;
    };
  }, [going, key, world, mine, date, book, reference, kit, digest, send]);
  const choose = (on: boolean) => {
    if (open === null) return;
    const kept = (unkept: string | null) => () => setChosen((last) => ({ count: last.count + 1, unkept }));
    open.book.record(open.date, { kind: 'insights.choice', choice: { on } }).then(kept(null), kept(open.world));
  };
  const retry = () => setAttempt((count) => count + 1);
  const waiting = going && waitingSendings(mine, reference, date, book.entries).length > 0;
  const status: SendingStatus = !going
    ? { kind: 'off' }
    : result?.key === key
      ? result.status
      : waiting
        ? { kind: 'working' }
        : { kind: 'done', taken: 0 };
  return { choice, status, choose, retry, unkept: world !== null && chosen.unkept === world, mine };
}
