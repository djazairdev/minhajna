// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What D-Exchange reads and keeps (#592, answer 620): as the page opens, the
// world's stand-in receipts, again on asking after a problem, whose latest
// marks the map names; the school's space this device holds the key of, or
// none; and the absences choice under it, off until the director turns it on,
// kept as a device event in the world's store on the world's date, once at a
// time, a choice not kept said apart from the receipts.

import { absencesSent, latestHeld, type Day } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { termName } from '../exams/course-label';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { standInReceipts, type StandInReceipt } from '../school/state-standin';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { PUBLIC_KEY_BYTES } from './school-desk';

/** D-Exchange's receipts, the held school's space, and its absences choice. */
export function useExchangePage(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  dayText: (day: Day) => string,
  send: Send = worldRequest,
) {
  const t = useDeviceText();
  const [receipts, setReceipts] = useState<readonly StandInReceipt[] | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [failed, setFailed] = useState<ReturnType<typeof problemOf> | null>(null);
  const [, setTick] = useState(0);
  const mounted = useRef(true);
  const keeping = useRef(false);
  const load = () =>
    standInReceipts(world.world, send).then(
      (got) => {
        if (mounted.current) setReceipts(got);
      },
      (error: unknown) => {
        if (mounted.current) setProblem(problemOf(error));
      },
    );
  const first = useEffectEvent(() => void load());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const school = latestHeld(world.book.entries, PUBLIC_KEY_BYTES)?.school ?? null;
  const absences = school !== null && absencesSent(world.book.entries, school);
  const last = receipts?.find((one) => one.kind === 'marks');
  const received =
    last === undefined
      ? null
      : { term: termName(t, last.term), class: isolate(last.class), day: dayText(last.received) };
  const choose = (on: boolean) => {
    if (school === null || keeping.current || on === absences) return;
    keeping.current = true;
    setFailed(null);
    void world.book.record(world.date, { kind: 'school.absences', absences: { school, send: on } }).then(
      () => {
        keeping.current = false;
        if (!mounted.current) return;
        setTick((tick) => tick + 1);
      },
      (error: unknown) => {
        keeping.current = false;
        if (mounted.current) setFailed(problemOf(error));
      },
    );
  };
  const reload = () => {
    setProblem(null);
    setReceipts(null);
    void load();
  };
  return {
    reading: receipts === null && problem === null,
    problem,
    failed,
    received,
    school,
    absences,
    choose,
    reload,
  };
}
