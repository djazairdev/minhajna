// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's state on the workspace's PC (#604, answer 638): as the room
// opens, when the world's date moves and when asked again, its votes are read
// (committee-session.ts), what was last read of that room kept on view
// meanwhile, and nothing is read with no room or no world's keys held; a
// problem is said in the catalogue's words, as an alert on the page. A vote is
// signed once, a second press while one runs doing nothing, said when made, and
// the room read again, a refusal a problem in the committee's words until the
// next vote or reading asked for. What was said, and a refusal, hold for the
// room and the world's date they were said on. Any new reading, and leaving the
// page, drops a slower answer.

import type { CommitteeState, Day } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { Send, WorldKit } from '../demo/world-session';
import { problemOf } from '../school/school-join-session';
import { castVote, readCommittee, type CommitteeRoom } from './committee-session';

type Problem = ReturnType<typeof problemOf> | 'demo.committee.closed';

const CLOSED = 'demo.threshold.problem.closed';

/** The room's state as read, whether a reading or a vote runs, its problem, and what the page's live line says. */
export function useCommittee(
  date: Day,
  held: HeldWorld | null,
  room: CommitteeRoom | null,
  kit: WorldKit,
  send?: Send,
) {
  const [round, setRound] = useState(0);
  const named = JSON.stringify(room);
  const place = JSON.stringify([named, date]);
  const key = JSON.stringify([place, round]);
  const [got, setGot] = useState<{ key: string; named: string; state: CommitteeState } | null>(null);
  const [failed, setFailed] = useState<{ key: string; problem: Problem } | null>(null);
  const [refused, setRefused] = useState<{ place: string; problem: Problem } | null>(null);
  const [voting, setVoting] = useState(false);
  const [said, setSaid] = useState<{ place: string; text: string } | null>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  const able = held !== null && room !== null;
  const reading = useEffectEvent(() =>
    held === null || room === null ? Promise.reject(new Error('No room')) : readCommittee(held, room, kit, send),
  );
  useEffect(() => {
    if (!able) return;
    let live = true;
    reading().then(
      (state) => live && setGot({ key, named, state }),
      (error: unknown) => live && setFailed({ key, problem: problemOf(error) }),
    );
    return () => {
      live = false;
    };
  }, [key, named, able]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return {
    state: got?.named === named ? got.state : null,
    reading: able && got?.key !== key && failed?.key !== key,
    voting,
    problem: failed?.key === key ? failed.problem : refused?.place === place ? refused.problem : null,
    said: said?.place === place ? said.text : '',
    again: () => {
      setSaid(null);
      setRefused(null);
      setRound((one) => one + 1);
    },
    vote: (seat: number, item: string | null, done: string) => {
      if (working.current || held === null || room === null) return;
      working.current = true;
      const at = place;
      setVoting(true);
      setSaid(null);
      setRefused(null);
      void castVote(held, room, seat, item, date, kit, send)
        .then(
          () => mounted.current && setSaid({ place: at, text: done }),
          (error: unknown) => {
            if (!mounted.current) return;
            const shown = problemOf(error);
            setRefused({ place: at, problem: shown === CLOSED ? 'demo.committee.closed' : shown });
          },
        )
        .finally(() => {
          working.current = false;
          if (!mounted.current) return;
          setVoting(false);
          setRound((one) => one + 1);
        });
    },
  };
}
