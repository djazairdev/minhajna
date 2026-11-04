// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The committees' state on the workspace's PC (#604, #605, answers 638 and
// 639): as the rooms of a grade open, when the world's date moves and when
// asked again, their votes are read together (committee-session.ts), what was
// last read of those rooms kept on view meanwhile, and nothing is read with no
// room or no world's keys held; a problem is said in the catalogue's words, as
// an alert on the page. A vote is signed once, a second press while one runs
// doing nothing, said when made, and the rooms read again, a refusal a problem
// in the committee's words until the next vote or reading asked for. What was
// said, and a refusal, hold for the rooms and the world's date they were said
// on. Any new reading, and leaving the page, drops a slower answer.

import type { Day } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { Send, WorldKit } from '../demo/world-session';
import { problemOf } from '../school/school-join-session';
import { castVote, putWords, readCommittees, type CommitteeRead, type CommitteeRoom } from './committee-session';

type Problem = ReturnType<typeof problemOf> | 'demo.committee.closed';

const CLOSED = 'demo.threshold.problem.closed';

/** The rooms' states as read, whether a reading or a vote runs, its problem, and what the page's live line says. */
export function useCommittee(
  date: Day,
  held: HeldWorld | null,
  rooms: readonly CommitteeRoom[],
  kit: WorldKit,
  send?: Send,
) {
  const [round, setRound] = useState(0);
  const named = JSON.stringify(rooms);
  const place = JSON.stringify([named, date]);
  const key = JSON.stringify([place, round]);
  const [got, setGot] = useState<{ key: string; named: string; reads: readonly CommitteeRead[] } | null>(null);
  const [failed, setFailed] = useState<{ key: string; problem: Problem } | null>(null);
  const [refused, setRefused] = useState<{ place: string; problem: Problem } | null>(null);
  const [voting, setVoting] = useState(false);
  const [said, setSaid] = useState<{ place: string; text: string } | null>(null);
  const working = useRef(false);
  const told = useRef(0);
  const mounted = useRef(true);
  const able = held !== null && rooms.length > 0;
  const reading = useEffectEvent(() =>
    held === null ? Promise.reject(new Error('No keys')) : readCommittees(held, rooms, kit, send),
  );
  useEffect(() => {
    if (!able) return;
    let live = true;
    reading().then(
      (reads) => live && setGot({ key, named, reads }),
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
  const sign = (put: () => Promise<void>, done: string) => {
    if (working.current) return;
    working.current = true;
    const at = place;
    const asked = told.current;
    setVoting(true);
    setSaid(null);
    setRefused(null);
    void put()
      .then(
        () => mounted.current && told.current === asked && setSaid({ place: at, text: done }),
        (error: unknown) => {
          if (!mounted.current || told.current !== asked) return;
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
  };
  return {
    reads: got?.named === named ? got.reads : null,
    reading: able && got?.key !== key && failed?.key !== key,
    voting,
    problem: failed?.key === key ? failed.problem : refused?.place === place ? refused.problem : null,
    said: said?.place === place ? said.text : '',
    forget: () => {
      told.current += 1;
      setSaid(null);
      setRefused(null);
    },
    again: () => {
      setSaid(null);
      setRefused(null);
      setRound((one) => one + 1);
    },
    vote: (room: CommitteeRoom, seat: number, item: string | null, done: string) => {
      if (held !== null) sign(() => castVote(held, room, seat, item, date, kit, send), done);
    },
    write: (room: CommitteeRoom, seat: number, words: string, done: string) => {
      if (held !== null) sign(() => putWords(held, room, seat, words, date, kit, send), done);
    },
  };
}
