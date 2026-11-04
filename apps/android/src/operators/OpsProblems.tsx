// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' problem reports page in a national demo world (#619, §6.7,
// R-6.7-03, answer 656): the reports sent from inside this world, what each
// holds and never who sent it; that each is kept until it is marked fixed or
// its sender deletes it, at most 200 and 12 months, and erased with the world;
// and the reports under their heading, newest first, each its part of the app
// as a heading, the day it came, the app's version and the start of its ID, and
// its note, each line isolated, which can be selected. Marking one fixed asks
// first, since it erases the report, then says politely it was erased and
// logged, or that the world no longer held it, takes it off the page and moves
// focus to the next report's button, or to what it said when none is left; a
// problem marking it, a world erased among them, is said as an alert with the
// report kept. One report is marked at a time, and nothing is set once the page
// has closed.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Text, View, type ViewInstance } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { markFixed, readProblems, type OpsProblem } from './ops-problems';
import { OpsReading } from './OpsReading';
import { opsStyles as styles } from './ops-styles';
import { useOpsRead } from './use-ops-read';

export type OpsProblemsProps = {
  readonly world: Pick<OpenWorld, 'world'>;
  readonly send?: Send;
  /** A day written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

type Done = { readonly key: 'fixed' | 'gone'; readonly id: string };

/** The world's problem reports, each with a way to mark it fixed. */
export function OpsProblems({ world, send = worldRequest, dayText }: OpsProblemsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const page = useOpsRead(() => readProblems(world.world, send));
  const [asking, setAsking] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [gone, setGone] = useState<readonly string[]>([]);
  const [done, setDone] = useState<Done | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [next, setNext] = useState<{ readonly id: string | null } | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const buttons = useRef(new Map<string, ViewInstance>());
  const said = useRef<ViewInstance>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (next !== null) (next.id === null ? said.current : buttons.current.get(next.id))?.focus();
  }, [next]);
  const reports = page.value?.filter((one) => !gone.includes(one.id)) ?? null;
  const shownId = (id: string) => isolate(id.slice(0, 8));
  const mark = (id: string) => {
    if (busy.current || reports === null) return;
    busy.current = true;
    const at = reports.findIndex((one) => one.id === id);
    const after = reports[at + 1] ?? reports[at - 1];
    setMarking(true);
    setDone(null);
    setProblem(null);
    markFixed(world.world, id, send).then(
      (result) => {
        busy.current = false;
        if (!mounted.current) return;
        setGone((before) => [...before, id]);
        setDone({ key: result, id });
        setAsking(null);
        setMarking(false);
        setNext({ id: after?.id ?? null });
      },
      (error: unknown) => {
        busy.current = false;
        if (!mounted.current) return;
        setProblem(problemOf(error));
        setMarking(false);
      },
    );
  };
  const keep = () => {
    setAsking(null);
    setProblem(null);
  };
  const card = (one: OpsProblem) => (
    <View key={one.id} testID={`ops-problem-${one.id}`} style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t(`report.parts.${one.part}`)}
      </Text>
      <Text style={[styles.small, align]}>
        {t('demo.ops.problems.facts', {
          day: dayText(one.received),
          version: isolate(one.version),
          id: shownId(one.id),
        })}
      </Text>
      <Text selectable style={[styles.body, align]}>
        {one.note.split('\n').map(isolate).join('\n')}
      </Text>
      {asking === one.id ? (
        <>
          <Text style={[styles.body, align]}>{t('demo.ops.problems.ask')}</Text>
          <Button
            testID={`ops-problem-${one.id}-yes`}
            variant="danger"
            label={t('demo.ops.problems.yes')}
            disabled={marking}
            onPress={() => mark(one.id)}
          />
          <Button
            testID={`ops-problem-${one.id}-keep`}
            variant="line"
            label={t('demo.ops.problems.keep')}
            disabled={marking}
            onPress={keep}
          />
        </>
      ) : (
        <Button
          ref={(button) => {
            if (button === null) buttons.current.delete(one.id);
            else buttons.current.set(one.id, button);
          }}
          testID={`ops-problem-${one.id}-fix`}
          variant="line"
          label={t('demo.ops.problems.fix')}
          disabled={marking}
          onPress={() => setAsking(one.id)}
        />
      )}
    </View>
  );
  return (
    <View testID="ops-problems" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.ops.problems.lead')}</Text>
      <Text style={[styles.small, align]}>{t('demo.ops.problems.kept')}</Text>
      <OpsReading reading={page.reading} problem={page.problem} onAgain={page.reload} testID="ops-problems" />
      <View ref={said} testID="ops-problems-said" tabIndex={-1}>
        <Text testID="ops-problems-done" accessibilityLiveRegion="polite" style={[styles.small, align]}>
          {done === null ? '' : t(`demo.ops.problems.${done.key}`, { id: shownId(done.id) })}
        </Text>
      </View>
      {problem !== null && (
        <Text testID="ops-problems-problem" accessibilityRole="alert" style={[styles.problem, align]}>
          {t(problem)}
        </Text>
      )}
      {reports !== null && (
        <View testID="ops-problems-list" style={styles.page}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.ops.problems.reports')}
          </Text>
          {reports.length === 0 && <Text style={[styles.value, align]}>{t('demo.ops.problems.none')}</Text>}
          {reports.map(card)}
        </View>
      )}
    </View>
  );
}
