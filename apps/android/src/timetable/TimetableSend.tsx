// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Publishing a version of the school's timetable (#577, #578, D-TT-change,
// §7.4, §7.5, answers 605 and 606), on the director's timetable page under what
// was read or entered: one button checks what this timetable changes from the
// standing version, and the draft shows (VersionPreview.tsx); then the first
// day, next Sunday by default or one of the three Sundays after, never before
// the standing version's, or, for one day, a school day of the coming two
// weeks, offered once a standing version exists and allowed only when every
// teacher it changes holds a standing part, which the page says otherwise; then
// publishing, which sends each affected teacher their part, signed by this
// device. A second press waits for the first, with a line saying it is under
// way. After publishing, the page says how many teachers were sent their part
// and how many others were told nothing, and names apart those with no code or
// key issued yet, those not in the school's staff list, those whose name two of
// the staff list share, those whose part is too long to send, and those whose
// part did not reach the server, with the problem met; each name is isolated so
// a name in other letters keeps its place. On a PC what is said goes to the
// page's hidden live region, and elsewhere it is announced. Another timetable
// read or entered clears the draft and what was said. A problem keeps what was
// said before and is said in the catalogue's words.

import type { BellTimes, Day, DemoSchool, ImportedSession, Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Switch } from '../components/Switch';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import {
  affected,
  draftVersion,
  oneDayAllowed,
  publishVersion,
  teachersOn,
  type Draft,
  type SentParts,
} from './version-session';
import { oneDays, startDays } from './version-text';
import { VersionPreview } from './VersionPreview';

export type TimetableSendProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: Pick<DemoSchool, 'name' | 'teachers'>;
  /** The sessions read or entered. */
  readonly sessions: readonly ImportedSession[];
  readonly bells: BellTimes;
  /** The school's working days, which a version for one day may take. */
  readonly workingDays: readonly Weekday[];
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
};

type Problem = ReturnType<typeof problemOf>;

/** The timetable page's publishing: a version checked, then each affected teacher's part, signed by this device. */
export function TimetableSend(props: TimetableSendProps) {
  const { world, school, sessions, bells, workingDays, kit, send, dayText } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [busy, setBusy] = useState(false);
  const [drafted, setDrafted] = useState<{ readonly of: readonly ImportedSession[]; readonly draft: Draft }>();
  const draft = drafted?.of === sessions ? drafted.draft : null;
  type Said = {
    readonly of: readonly ImportedSession[];
    readonly found: SentParts | null;
    readonly problem: Problem | null;
  };
  const [kept, setKept] = useState<Said>();
  const sent = kept?.of === sessions ? kept.found : null;
  const problem = kept?.of === sessions ? kept.problem : null;
  const [once, setOnce] = useState(false);
  const [picked, setPicked] = useState<Day | null>(null);
  const choose = (one: Draft | null) => {
    const single = once && one !== null && oneDayAllowed(one);
    const offered = single ? oneDays(world.date, workingDays) : startDays(world.date, one?.standing?.from ?? null);
    return { oneDay: single, days: offered, from: picked !== null && offered.includes(picked) ? picked : offered[0] };
  };
  const { oneDay, days, from } = choose(draft);
  const [said, setSaid] = useState({ words: '', count: 0 });
  const mounted = useRef(true);
  const working = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const say = (words: string) => {
    if (onPc()) setSaid((before) => ({ words, count: before.count + 1 }));
    else AccessibilityInfo.announceForAccessibility(words);
  };
  const run = async (step: () => Promise<{ found: SentParts | null; words: string } | null>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setKept((before) => before && { ...before, problem: null });
    try {
      const done = await step();
      if (!mounted.current || done === null) return;
      const key = done.found !== null && done.found.failed.length > 0 ? problemOf(done.found.problem) : null;
      setKept((before) => ({
        of: sessions,
        found: done.found ?? (before?.of === sessions ? before.found : null),
        problem: key,
      }));
      say(key === null ? done.words : `${done.words} ${t(key)}`);
    } catch (error) {
      if (!mounted.current) return;
      const key = problemOf(error);
      setKept((before) => ({ of: sessions, found: before?.of === sessions ? before.found : null, problem: key }));
      say(t(key));
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const check = () =>
    run(async () => {
      const made = await draftVersion(world, school, sessions, bells, kit, send);
      if (mounted.current) setDrafted({ of: sessions, draft: made });
      const chosen = choose(made);
      const told = teachersOn(made, { from: chosen.from, once: chosen.oneDay }).filter(affected);
      return { found: null, words: t('ttVersion.told', { teachers: told.length }) };
    });
  const publish = () =>
    run(async () => {
      if (draft === null || from === undefined) return null;
      const found = await publishVersion(world, draft, { from, once: oneDay }, kit, send);
      if (mounted.current) setDrafted(undefined);
      return { found, words: t('ttSend.sent', { teachers: found.sent.length }) };
    });
  const named = (testID: string, head: string, names: readonly string[]) =>
    names.length > 0 && (
      <View testID={testID} style={styles.group}>
        <Text style={[styles.label, align]}>{head}</Text>
        <Text style={[styles.small, align]}>{names.map(isolate).join(t('ttSend.and'))}</Text>
      </View>
    );
  return (
    <View testID="tt-send" style={styles.card}>
      {onPc() && (
        <View accessibilityLiveRegion="polite" style={styles.hidden}>
          <Text key={said.count} testID="tt-send-said">
            {said.words}
          </Text>
        </View>
      )}
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('ttSend.title')}
      </Text>
      <Text style={[styles.small, align]}>{t('ttVersion.line')}</Text>
      <Button testID="tt-send-check" label={t('ttVersion.check')} disabled={busy} onPress={() => void check()} />
      {draft !== null && from !== undefined && (
        <>
          <VersionPreview
            draft={draft}
            teachers={teachersOn(draft, { from, once: oneDay })}
            day={dayText(from)}
            once={oneDay}
          />
          {draft.standing !== null && (
            <Switch testID="tt-send-once" label={t('ttVersion.once')} value={once} onValueChange={setOnce} />
          )}
          {once && !oneDay && <Text style={[styles.label, align]}>{t('ttVersion.onceFirst')}</Text>}
          <ChipGroup
            testID="tt-send-day"
            label={t(oneDay ? 'ttVersion.oneDay' : 'ttVersion.startDay')}
            choices={days.map((one) => ({ value: one, label: dayText(one) }))}
            selected={from}
            onSelect={setPicked}
          />
          <Button
            testID="tt-send-go"
            label={t('ttVersion.publish', { version: draft.version })}
            disabled={busy}
            onPress={() => void publish()}
          />
        </>
      )}
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {busy ? t('ttSend.sending') : ''}
      </Text>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
        {problem === null ? '' : t(problem)}
      </Text>
      {sent !== null && (
        <>
          <Text testID="tt-send-sent" style={[styles.body, align]}>
            {t('ttSend.sent', { teachers: sent.sent.length })}
          </Text>
          <Text style={[styles.small, align]}>{t('ttVersion.unchanged', { teachers: sent.unchanged.length })}</Text>
          {named('tt-send-no-code', t('ttSend.noCode'), sent.noCode)}
          {named('tt-send-not-staff', t('ttSend.notStaff'), sent.notStaff)}
          {named('tt-send-two-names', t('ttSend.twoNames'), sent.twoNames)}
          {named('tt-send-too-long', t('ttSend.tooLong'), sent.tooLong)}
          {named('tt-send-failed', t('ttSend.failed'), sent.failed)}
          <Text style={[styles.small, align]}>{t('ttSend.again')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  group: { gap: spacing['space-2'] },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
