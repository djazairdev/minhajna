// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Threshold's state on the director's device (#603, answer 637): as the page
// opens, when the world's date moves and when asked again, the school key is
// held, never started here, and the rooms read (school-rooms.ts), the rooms
// last read kept on view meanwhile; after the year's last day no room is read
// and no key held; a problem is said in the catalogue's words, shown as an
// alert and announced on a phone, never in place of what was said. A decision
// is signed once, a second press while one runs doing nothing, said when made,
// and the rooms read again, a refusal a problem in the director's words until
// the next decision or reading asked for. What was said, and a refusal, hold
// for the world's date they were said on. Any new reading, and leaving the
// page, drops a slower answer.

import { compareDays, type DemoSchool } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { holdSchool } from '../director/issue-session';
import type { TermReference } from '../director/seeded-fill';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { decideCut, readSchoolRooms, type SchoolRoom } from './school-rooms';

type Problem = ReturnType<typeof problemOf> | 'demo.schoolThreshold.closed';

const CLOSED = 'demo.threshold.problem.closed';

/** The rooms as read, whether a reading or a decision runs, its problem, and what the page's live line says. */
export function useSchoolRooms(
  world: Pick<OpenWorld, 'world' | 'date' | 'book'>,
  school: DemoSchool,
  reference: Pick<TermReference, 'calendar'>,
  kit: WorldKit,
  send?: Send,
) {
  const t = useDeviceText();
  const [round, setRound] = useState(0);
  const place = JSON.stringify([world.world, world.date]);
  const key = JSON.stringify([place, round]);
  const [got, setGot] = useState<{ key: string; rooms: readonly SchoolRoom[] } | null>(null);
  const [failed, setFailed] = useState<{ key: string; problem: Problem } | null>(null);
  const [refused, setRefused] = useState<{ place: string; problem: Problem } | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [said, setSaid] = useState<{ place: string; text: string } | null>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  const say = (text: string, at = place) => {
    if (onPc()) setSaid({ place: at, text });
    else AccessibilityInfo.announceForAccessibility(text);
  };
  const desk = () => holdSchool(world, kit, send, false);
  const reading = useEffectEvent(async () =>
    compareDays(world.date, reference.calendar.year.to) > 0
      ? []
      : readSchoolRooms(world, await desk(), school, reference, kit, send),
  );
  const tell = (problem: Problem) => {
    if (!onPc()) AccessibilityInfo.announceForAccessibility(t(problem));
  };
  const told = useEffectEvent(tell);
  useEffect(() => {
    let live = true;
    reading().then(
      (rooms) => live && setGot({ key, rooms }),
      (error: unknown) => {
        if (!live) return;
        setFailed({ key, problem: problemOf(error) });
        told(problemOf(error));
      },
    );
    return () => {
      live = false;
    };
  }, [key]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return {
    rooms: got?.rooms ?? null,
    reading: got?.key !== key && failed?.key !== key,
    deciding,
    problem: failed?.key === key ? failed.problem : refused?.place === place ? refused.problem : null,
    said: said?.place === place ? said.text : '',
    say,
    again: () => {
      setSaid(null);
      setRefused(null);
      setRound((one) => one + 1);
    },
    decide: (room: SchoolRoom, item: string | null, done: string) => {
      if (working.current) return;
      working.current = true;
      const at = place;
      setDeciding(true);
      setSaid(null);
      setRefused(null);
      void desk()
        .then((held) => decideCut(world, held, room, item, kit, send))
        .then(
          () => mounted.current && say(done, at),
          (error: unknown) => {
            if (!mounted.current) return;
            const shown = problemOf(error);
            const problem = shown === CLOSED ? 'demo.schoolThreshold.closed' : shown;
            setRefused({ place: at, problem });
            tell(problem);
          },
        )
        .finally(() => {
          working.current = false;
          if (!mounted.current) return;
          setDeciding(false);
          setRound((one) => one + 1);
        });
    },
  };
}
