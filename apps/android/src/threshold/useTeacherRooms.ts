// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rooms a threshold page shows (#601, answer 633), read as it opens
// (teacher-rooms.ts), with, when asked, the weeks the phone signed on its
// channel, with a way to read them again and to sign a cut, which reads them
// again once signed or refused, the problem kept; a second press while one runs
// does nothing. A problem is said in the catalogue's words, as is a cut signed
// (useSaid.tsx), and the page may say more in the same region.

import type { SchoolJoined, WeekRecord } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { problemOf } from '../school/school-join-session';
import { useDeviceText } from '../text/device-text';
import { useSaid } from '../week/useSaid';
import { readTeacherExams, type TeacherRoom } from './teacher-rooms';

/** The rooms as read, whether a reading or a signing runs, its problem, and the page's hidden live region. */
export function useTeacherRooms(
  world: Pick<OpenWorld, 'world' | 'date'>,
  join: SchoolJoined,
  kit: WorldKit,
  send: Send | undefined,
  said: string,
  testID: string,
  own = false,
) {
  const t = useDeviceText();
  const [rooms, setRooms] = useState<readonly TeacherRoom[] | null>(null);
  const [weeks, setWeeks] = useState<readonly WeekRecord[] | null>(null);
  const [reading, setReading] = useState(true);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const { say, region } = useSaid(said, `${testID}-said`);
  const working = useRef(false);
  const mounted = useRef(true);
  const failed = (error: unknown) => {
    if (!mounted.current) return;
    working.current = false;
    setProblem(problemOf(error));
    setReading(false);
    say(t(problemOf(error)));
  };
  const load = () =>
    readTeacherExams(world, join, kit, send, own).then((read) => {
      if (!mounted.current) return;
      working.current = false;
      setRooms(read.rooms);
      setWeeks(read.weeks);
      setReading(false);
    }, failed);
  const first = useEffectEvent(() => {
    working.current = true;
    void load();
  });
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = (step: () => Promise<unknown>) => {
    if (working.current) return;
    working.current = true;
    setProblem(null);
    setReading(true);
    void step().then(load, (error: unknown) => {
      failed(error);
      if (!mounted.current) return;
      working.current = true;
      setReading(true);
      void load();
    });
  };
  return {
    rooms,
    weeks,
    reading,
    problem,
    region,
    say,
    again: () => run(() => Promise.resolve()),
    sign: (step: () => Promise<unknown>, done: string) =>
      run(() =>
        step().then(() => {
          if (mounted.current) say(done);
        }),
      ),
  };
}
