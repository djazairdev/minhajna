// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every device of a world learns that its date moved (#630, choice D3 of the
// 0.7.0 demo, answer 724): only the device that started a world moves it, and
// the server serves the date to the others. Each minute while a world is open
// the device reads it, under the relay's limit (answer 723), so a staffroom's
// devices together stay well within what one address may ask. A date later than
// the one shown is only offered, by WorldDateFrame.tsx: no page has its date
// changed while someone is working on it, since the pages take the date as
// fixed while they are open. Nothing is said of a reading that fails, as when
// offline, and the next reading tries again, and a world left or changed drops
// an answer still on its way.

import { isDay, type Day } from '@minhajna/core';
import { useEffect, useEffectEvent, useState } from 'react';
import { worldRequest } from '../network/world-network';
import type { Send } from './world-session';

/** How often an open world's date is read, in milliseconds. */
export const DATE_READ_MS = 60_000;

/** The world's date as the server answers it, or null for any other answer. */
export async function readWorldDate(world: string, send: Send = worldRequest): Promise<Day | null> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/date` });
  const date = (answer.body as { date?: unknown } | null)?.date;
  return answer.status === 200 && typeof date === 'string' && isDay(date) ? date : null;
}

/** Reads the open world's date each minute while it is open, and answers each date read. */
export function useWorldDateRead(world: string | null, onDate: (world: string, date: Day) => void, send?: Send): void {
  const said = useEffectEvent(onDate);
  useEffect(() => {
    if (world === null) return;
    let open = true;
    const read = () => {
      void readWorldDate(world, send).then(
        (date) => {
          if (open && date !== null) said(world, date);
        },
        () => undefined,
      );
    };
    const timer = setInterval(read, DATE_READ_MS);
    return () => {
      open = false;
      clearInterval(timer);
    };
  }, [world, send]);
}

/** The later date the open world's server has read, or null while the date shown is the latest. */
export function useMovedDate(shown: { readonly world: string; readonly date: Day } | null, send?: Send): Day | null {
  const [read, setRead] = useState<{ world: string; date: Day } | null>(null);
  useWorldDateRead(
    shown?.world ?? null,
    (world, date) => setRead((before) => (before?.world === world && before.date === date ? before : { world, date })),
    send,
  );
  return read !== null && read.world === shown?.world && read.date > shown.date ? read.date : null;
}
