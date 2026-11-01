// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What Term-send reads and does (#591, answer 619): as the page opens, the
// teacher's channel, as Week-sign reads it, and the stand-in's receipts for the
// world, again on asking after a problem; the term to send, the courses of the
// timetable in force and the chosen one, the first until another is; its
// made-up marks, its comparison, whether it may be signed and its latest
// receipt for the term from this key, or the one sending gave back for that
// course and term while the page is open, with whether it came before; why
// there is nothing to show, if so; and sending, once at a time, said when done.
// A problem is in the catalogue's words, a refusal and a mismatch their own,
// and said except on a PC; what is said goes, on a PC, to the page's hidden
// live region (useSaid.tsx).

import type { Subject } from '@minhajna/core';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { worldRequest } from '../network/world-network';
import { errorCode } from '../lock/lock-rules';
import { appreciationList } from '../marks/appreciation-rules';
import { assessmentData } from '../marks/marks-rules';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { useSaid } from '../week/useSaid';
import { courseKey, readSignChannel, type SignChannel } from '../week/week-sign-session';
import { problemOf } from './school-join-session';
import { standInReceipts, type StandInReceipt } from './state-standin';
import {
  courseReceipt,
  sendingTerm,
  sendTermMarks,
  termComplete,
  termCourses,
  termMatches,
  termSheet,
} from './term-send-session';
import type { TermSendProps } from './TermSend';

type Problem = ReturnType<typeof problemOf> | 'demo.termSend.refused' | 'demo.termSend.mismatch';
/** What a sent export gave back, by the course and term it was sent for. */
type Sent = Readonly<Record<string, { readonly receipt: StandInReceipt; readonly again: boolean }>>;
const NO_SUBJECTS: readonly Subject[] = [];

const problemFor = (error: unknown): Problem => {
  const code = errorCode(error);
  if (code === 'E_STATE_REFUSED') return 'demo.termSend.refused';
  return code === 'E_TERM_MISMATCH' ? 'demo.termSend.mismatch' : problemOf(error);
};

/** Term-send's reading, its course and marks, its receipt, and sending. */
export function useTermSend(props: TermSendProps) {
  const { world, join, kit, send = worldRequest, said, subjects = NO_SUBJECTS, mine, school = null } = props;
  const t = useDeviceText();
  const [read, setRead] = useState<{ channel: SignChannel; receipts: StandInReceipt[] } | null>(null);
  const [step, setStep] = useState<'reading' | 'sending' | null>('reading');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent>({});
  const { say, region } = useSaid(said, 'term-send-said');
  const working = useRef(true);
  const mounted = useRef(true);
  const refused = (error: unknown) => {
    if (!mounted.current) return;
    working.current = false;
    const words = problemFor(error);
    setProblem(words);
    setStep(null);
    if (!onPc()) say(t(words));
  };
  const load = () =>
    Promise.all([readSignChannel(world, join, kit, send), standInReceipts(world.world, send)]).then(
      ([channel, receipts]) => {
        if (!mounted.current) return;
        working.current = false;
        setRead({ channel, receipts });
        setStep(null);
      },
      refused,
    );
  const first = useEffectEvent(() => void load());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const assessment = mine === undefined ? null : assessmentData(mine.profile);
  const list = mine === undefined ? null : appreciationList(mine.profile);
  const term = mine === undefined ? null : sendingTerm(mine.calendar.year, world.date);
  const courses = useMemo(
    () => (read === null ? [] : termCourses(read.channel.parts, world.date, subjects)),
    [read, world.date, subjects],
  );
  const course = courses.find((one) => courseKey(one) === chosen) ?? courses[0];
  const sheet = useMemo(
    () =>
      course === undefined || term === null || school === null || assessment === null || list === null
        ? null
        : termSheet(world.world, school, course, term.number, world.date, { assessment, list }),
    [course, term, school, assessment, list, world.world, world.date],
  );
  const marks = sheet?.kind === 'marks' ? sheet : null;
  const matches = useMemo(() => (marks === null ? null : termMatches(marks.head, marks.marks)), [marks]);
  const key = course === undefined || term === null ? null : `${courseKey(course)}\n${term.number}`;
  const fresh = key === null ? undefined : sent[key];
  const receipt =
    fresh?.receipt ?? (marks === null || read === null ? null : courseReceipt(read.receipts, join, marks.head));
  const reason: 'demo.termSend.noData' | 'demo.termSend.noTerm' | 'demo.termSend.noTimetable' | null =
    read === null
      ? null
      : school === null || assessment === null || list === null || mine === undefined
        ? 'demo.termSend.noData'
        : term === null
          ? 'demo.termSend.noTerm'
          : courses.length === 0
            ? 'demo.termSend.noTimetable'
            : null;
  const sign = () => {
    if (working.current || marks === null || key === null || course === undefined) return;
    working.current = true;
    setStep('sending');
    setProblem(null);
    void sendTermMarks(world, join, marks.head, marks.marks, kit, send).then(({ receipt: got, again }) => {
      if (!mounted.current) return;
      working.current = false;
      setSent((before) => ({ ...before, [key]: { receipt: got, again } }));
      setStep(null);
      say(t(again ? 'demo.termSend.already' : 'demo.termSend.done', { class: isolate(course.class) }));
    }, refused);
  };
  const reload = () => {
    if (working.current) return;
    working.current = true;
    setProblem(null);
    setStep('reading');
    void load();
  };
  return {
    region,
    step,
    problem,
    courses,
    course,
    term,
    sheet,
    matches,
    ready:
      marks !== null &&
      matches !== null &&
      matches.matched === matches.total &&
      termComplete(marks.marks) === marks.marks.rows.length,
    receipt: receipt ?? null,
    again: fresh?.again === true,
    reason,
    choose: setChosen,
    sign,
    reload,
  };
}
