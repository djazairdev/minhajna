// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Threshold's state on the director's device (#603, answer 637): as the page
// opens, when the world's date moves and when asked again, the school key is
// held, never started here, and the rooms read (school-rooms.ts), the rooms
// last read kept on view meanwhile; a problem is said in the catalogue's
// words, with a way to read again. A decision is signed once, a second press
// while one runs doing nothing, said when made, and the rooms read again, a
// refusal said as a problem. Any new reading, and leaving the page, drops a
// slower answer.

import type { DemoSchool } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { holdSchool } from '../director/issue-session';
import type { TermReference } from '../director/seeded-fill';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { decideCut, readSchoolRooms, type SchoolRoom } from './school-rooms';

type Problem = ReturnType<typeof problemOf>;

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
  const key = JSON.stringify([world.world, world.date, round]);
  const [got, setGot] = useState<{ key: string; rooms: readonly SchoolRoom[] } | null>(null);
  const [failed, setFailed] = useState<{ key: string; problem: Problem } | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [said, setSaid] = useState('');
  const working = useRef(false);
  const mounted = useRef(true);
  const say = (text: string) => {
    if (onPc()) setSaid(text);
    else AccessibilityInfo.announceForAccessibility(text);
  };
  const desk = () => holdSchool(world, kit, send, false);
  const reading = useEffectEvent(async () => readSchoolRooms(world, await desk(), school, reference, kit, send));
  const told = useEffectEvent((problem: Problem) => say(t(problem)));
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
  const again = () => {
    setSaid('');
    setRound((one) => one + 1);
  };
  return {
    rooms: got?.rooms ?? null,
    reading: deciding || (got?.key !== key && failed?.key !== key),
    problem: failed?.key === key ? failed.problem : null,
    said,
    again,
    decide: (room: SchoolRoom, item: string | null, done: string) => {
      if (working.current) return;
      working.current = true;
      setDeciding(true);
      void desk()
        .then((held) => decideCut(world, held, room, item, kit, send))
        .then(
          () => mounted.current && say(done),
          (error: unknown) => {
            if (!mounted.current) return;
            setFailed({ key: JSON.stringify([world.world, world.date, round + 1]), problem: problemOf(error) });
            say(t(problemOf(error)));
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
