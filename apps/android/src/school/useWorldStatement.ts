// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the world's statement page reads and does (#630, answer 725): as it
// opens, the teacher's channel, as Week-sign reads it, again on asking after a
// problem reading it; the courses of the timetable in force and the chosen one,
// the first until another is; where the class has reached, which the teacher
// says, and which goes on choosing another course, the chip already chosen
// changing nothing; why there is nothing to show, if so; signing, once at a
// time, which says it did, with its code when it fits one, a change of what it
// says, or a reading again, dropping what was signed; and the file, shared on a
// phone and saved on a PC, said when saved. A problem is in the catalogue's
// words, the statement's own when signing fails and the file's when it does,
// said except on a PC, and goes when the teacher changes what it says; what is
// said goes, on a PC, to the page's hidden live region (useSaid.tsx).

import type { ProgressStatement, Subject, WorldStatementReach } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { canShareFiles } from '../components/device-abilities';
import { safeFileName } from '../marks/export-file-rules';
import files from '../native/NativeMinhajnaFiles';
import type { QrMatrix } from '../native/NativeMinhajnaSignature';
import { worldRequest } from '../network/world-network';
import { onPc, useDeviceText } from '../text/device-text';
import { useSaid } from '../week/useSaid';
import { courseKey, readSignChannel, type SignChannel } from '../week/week-sign-session';
import { problemOf } from './school-join-session';
import {
  courseStatement,
  partInForce,
  signedWorldStatement,
  statementCode,
  statementCourses,
} from './world-statement-session';
import type { WorldStatementProps } from './WorldStatement';

const NO_SUBJECTS: readonly Subject[] = [];
type Made = { readonly statement: ProgressStatement; readonly text: string; readonly qr: QrMatrix | null };
type Problem = {
  readonly words: ReturnType<typeof problemOf> | 'statement.failed' | 'demo.statement.fileFailed';
  readonly reading: boolean;
};

/** The page's reading, its course and what the teacher says, the statement signed, and the file. */
export function useWorldStatement(props: WorldStatementProps) {
  const { world, join, kit, send = worldRequest, said, subjects = NO_SUBJECTS } = props;
  const { mine, school = null, reference } = props;
  const t = useDeviceText();
  const [channel, setChannel] = useState<SignChannel | null>(null);
  const [step, setStep] = useState<'reading' | 'signing' | 'filing' | null>('reading');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [reached, setReached] = useState<WorldStatementReach>(null);
  const [made, setMade] = useState<Made | null>(null);
  const { say, region } = useSaid(said, 'world-statement-said');
  const working = useRef(true);
  const mounted = useRef(true);
  const stopped = (next: Problem) => {
    working.current = false;
    setProblem(next);
    setStep(null);
    if (!onPc()) say(t(next.words));
  };
  const refused = (error: unknown) => {
    if (mounted.current) stopped({ words: problemOf(error), reading: true });
  };
  const failed = (words: 'statement.failed' | 'demo.statement.fileFailed') => () => {
    if (mounted.current) stopped({ words, reading: false });
  };
  const load = () =>
    readSignChannel(world, join, kit, send).then((read) => {
      if (!mounted.current) return;
      working.current = false;
      setChannel(read);
      setStep(null);
    }, refused);
  const first = useEffectEvent(() => void load());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const reload = () => {
    if (working.current) return;
    working.current = true;
    setProblem(null);
    setMade(null);
    setStep('reading');
    void load();
  };
  const courses =
    channel === null || school === null || reference === undefined
      ? []
      : statementCourses(channel.parts, world.date, subjects, school, reference.packs);
  const course = courses.find((one) => courseKey(one) === chosen) ?? courses[0];
  const reason: 'demo.statement.noData' | 'demo.statement.noTimetable' | 'demo.statement.noPack' | null =
    channel === null
      ? null
      : school === null || reference === undefined || mine === undefined
        ? 'demo.statement.noData'
        : course === undefined
          ? 'demo.statement.noTimetable'
          : course.pack === null || course.room === null
            ? 'demo.statement.noPack'
            : null;
  const choose = (key: string) => {
    if (working.current || (course !== undefined && key === courseKey(course))) return;
    setChosen(key);
    setReached(null);
    setMade(null);
    setProblem(null);
  };
  const reach = (one: WorldStatementReach) => {
    if (working.current || (one?.item === reached?.item && one?.status === reached?.status)) return;
    setReached(one);
    setMade(null);
    setProblem(null);
  };
  const sign = () => {
    if (working.current || reason !== null || channel === null || course === undefined) return;
    if (school === null || mine === undefined) return;
    const bells = partInForce(channel.parts, world.date)?.bells ?? [];
    const weeks = channel.weeks.map((one) => one.week);
    const statement = courseStatement({ school, course, reached, weeks, mine, bells, day: world.date });
    if (statement === null) return stopped({ words: 'statement.failed', reading: false });
    working.current = true;
    setProblem(null);
    setStep('signing');
    void signedWorldStatement(statement, world.world, join, kit)
      .then(async (text) => ({ statement, text, qr: await statementCode(text) }))
      .then((signed) => {
        if (!mounted.current) return;
        working.current = false;
        setMade(signed);
        setStep(null);
        say(t('demo.statement.signed'));
      }, failed('statement.failed'));
  };
  const file = () => {
    if (working.current || made === null || course === undefined) return;
    working.current = true;
    setProblem(null);
    setStep('filing');
    const section = [...course.class].slice(0, 30).join('');
    const name = safeFileName(`${t('demo.statement.title')} ${section} ${course.subject} ${world.date}`, 'json');
    void files
      .makeText(made.text, name, '')
      .then(async (token) => {
        if (canShareFiles()) await files.shareFile(token, t('demo.statement.title'));
        else return files.saveFile(token);
        return false;
      })
      .then((saved) => {
        if (!mounted.current) return;
        working.current = false;
        setStep(null);
        if (saved) say(t('documents.output.saved'));
      }, failed('demo.statement.fileFailed'));
  };
  return { courses, course, reached, reason, step, problem, made, region, choose, reach, sign, file, reload };
}
