// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What School-mine and its term report read in a demo world (#584, answer 612):
// as the page opens, the teacher's channel (week-sign-session.ts), as Week-sign
// reads it, again on asking after a problem, which is said off a PC in the
// catalogue's words; the term that holds the world's date; the standing
// timetable in force on that date, its sessions and its classes in the grids'
// order; and each course's delivery over the term so far, from the signed weeks
// at their versions in force, against the joined school's calendar and the
// timetable's bells (school-mine-session.ts). Without the school's calendar, or
// between terms, no course is delivered.

import { courseDeliveries, timetableNames, type SchoolJoined } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { deliveryReading, standingOn, termOn, type MineCalendar } from './school-mine-session';
import { readSignChannel, type SignChannel } from './week-sign-session';

/** The teacher's channel read as School-mine and its report read it: the term so far, course by course. */
export function useMineTerm(
  props: {
    readonly world: Pick<OpenWorld, 'world' | 'date'>;
    readonly join: SchoolJoined;
    readonly kit: WorldKit;
    readonly send?: Send;
    readonly mine?: MineCalendar;
  },
  say: (text: string) => void,
) {
  const { world, join, kit, send, mine } = props;
  const t = useDeviceText();
  const [channel, setChannel] = useState<SignChannel | null>(null);
  const [reading, setReading] = useState(true);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const mounted = useRef(true);
  const read = () =>
    readSignChannel(world, join, kit, send).then(
      (got) => {
        if (!mounted.current) return;
        setChannel(got);
        setReading(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        setProblem(problemOf(error));
        setReading(false);
        if (!onPc()) say(t(problemOf(error)));
      },
    );
  const load = () => {
    setReading(true);
    setProblem(null);
    void read();
  };
  const first = useEffectEvent(() => void read());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const term = mine === undefined ? null : termOn(mine.calendar.year, world.date);
  const standing = channel === null ? null : (standingOn(channel.parts, world.date)?.part ?? null);
  const sessions = standing?.sessions ?? [];
  const classes = timetableNames(
    sessions.map((one) => ({ ...one, row: 0, teacher: '' })),
    'class',
  );
  const deliveries =
    channel === null || term === null || mine === undefined
      ? []
      : courseDeliveries(
          channel.weeks.map((one) => one.week),
          term.from,
          world.date,
          deliveryReading(mine, classes, standing?.bells ?? []),
        );
  return { channel, reading, problem, load, term, sessions, classes, deliveries };
}
