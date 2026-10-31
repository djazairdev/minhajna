// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's cover for the world's date in the director's workspace in a
// demo world (#586, D-Cover, §7.7, R-7.7-02 to R-7.7-07, answer 614), kept on
// this device alone and never seen by the teachers, with no reason and no
// absence: as it opens it reads the day (cover-session.ts), and a problem
// reading is shown in the catalogue's words, said on the PC in its live line
// and announced on a phone, with a way to read again; without a published
// version in force on the world's date it says so. Each of the day's sessions
// comes as a card (CoverCard.tsx); each change is kept, one at a time, said
// when a session is marked or unmarked, or said when not kept, and the day is
// read again, a problem reading it shown as on opening. The day's sheet lists
// each marked session's span, class, room, arrangement and who takes it, or
// that this is still to choose, as when whoever it names is no longer free, and
// never who was away or why; outside a world it is printed or sent to the
// supervisors, and in a world it stays on screen and says so. The term's log
// counts the cover each teacher gave, in the staff list's order, never by
// count, or says the date is between terms, and that the app suggests and the
// director decides; and make-ups, which a world has none of, and that pay is
// settled in the official channel.

import { TAKEN_ARRANGEMENTS, type CoverArrangement, type Day, type DemoSchool, type SchoolYear } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { spanText } from '../timetable/grid-text';
import { isolate } from '../week/grid-labels';
import { markCover, readCover, type CoverDay, type CoverSession } from './cover-session';
import { CoverCard } from './CoverCard';

export type SchoolCoverProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  /** The world's school year, whose term holding the world's date the log counts. */
  readonly year: SchoolYear;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
};

/** A term's key in the catalogue, by its number in the year. */
const termKey = (number: number) => (number === 1 ? '1' : number === 2 ? '2' : '3');

/** The director's cover for the world's date: the sessions to cover, the day's sheet and the term's log. */
export function SchoolCover(props: SchoolCoverProps) {
  const { world, school, year, kit, send, dayText } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [day, setDay] = useState<CoverDay | null>(null);
  const [reading, setReading] = useState(true);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const say = (text: string) => {
    if (onPc()) setSaid(text);
    else AccessibilityInfo.announceForAccessibility(text);
  };
  const read = () =>
    readCover(world, school, year, kit, send).then(
      (found) => {
        if (!mounted.current) return;
        setDay(found);
        setReading(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        setProblem(problemOf(error));
        setReading(false);
        say(t(problemOf(error)));
      },
    );
  const load = () => {
    setReading(true);
    setProblem(null);
    setSaid('');
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
  const sessionText = (one: CoverSession['session']) =>
    [spanText(one.start, one.end), isolate([one.class, one.group].filter(Boolean).join(' ')), isolate(one.subject)]
      .concat(one.room === '' ? [] : [isolate(one.room)])
      .join(' · ');
  const going = useRef(false);
  const cover = async (one: CoverSession, arrangement: CoverArrangement | null, by: string | null) => {
    if (day === null || going.current) return;
    going.current = true;
    setBusy(true);
    try {
      try {
        await markCover(world, day.space, one.id, arrangement, by);
      } catch {
        if (mounted.current) say(t('demo.cover.problem'));
        return;
      }
      if ((one.cover === null) !== (arrangement === null))
        say(
          t(arrangement === null ? 'demo.cover.unmarkedSaid' : 'demo.cover.markedSaid', {
            session: sessionText(one.session),
          }),
        );
      await readCover(world, school, year, kit, send).then(
        (found) => {
          if (!mounted.current) return;
          setDay(found);
          setProblem(null);
        },
        (error: unknown) => {
          if (!mounted.current) return;
          setProblem(problemOf(error));
          say(t(problemOf(error)));
        },
      );
    } finally {
      going.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const marked = (day?.sessions ?? []).flatMap(({ id, session, cover: kept, taken }) =>
    kept?.arrangement == null ? [] : [{ id, session, arrangement: kept.arrangement, by: kept.by, taken }],
  );
  const who = (one: (typeof marked)[number]) => {
    const name = one.by === null || one.taken !== null ? undefined : day?.log.find((each) => each.id === one.by)?.name;
    if (name !== undefined) return isolate(name);
    return t(TAKEN_ARRANGEMENTS.includes(one.arrangement) ? 'demo.cover.toChoose' : 'demo.cover.nobody');
  };
  return (
    <View testID="cover" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.cover.lead')}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {reading ? t('demo.weekSign.steps.reading') : said}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          <Button testID="cover-again" variant="line" label={t('demo.weekSign.again')} onPress={load} />
        </View>
      )}
      {day !== null && day.version === null && <Text style={[styles.body, align]}>{t('demo.cover.noVersion')}</Text>}
      {day?.version != null && (
        <>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.cover.day', { date: dayText(world.date) })}
          </Text>
          {day.sessions.length === 0 && <Text style={[styles.body, align]}>{t('demo.cover.noSessions')}</Text>}
          {day.sessions.map((one) => (
            <CoverCard
              key={one.id}
              one={one}
              text={sessionText(one.session)}
              busy={busy}
              counted={day.term !== null}
              onCover={(arrangement, by) => void cover(one, arrangement, by)}
            />
          ))}
          <View testID="cover-sheet" style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {t('demo.cover.sheet')}
            </Text>
            {marked.length === 0 && <Text style={[styles.body, align]}>{t('demo.cover.sheetNone')}</Text>}
            {marked.map((one) => (
              <Text key={one.id} testID="cover-sheet-line" style={[styles.body, align]}>
                {t('demo.cover.sheetLine', {
                  span: spanText(one.session.start, one.session.end),
                  class: isolate([one.session.class, one.session.group].filter(Boolean).join(' ')),
                  room: one.session.room === '' ? t('demo.cover.nobody') : isolate(one.session.room),
                  arrangement: t(`demo.cover.arrangements.${one.arrangement}`),
                  who: who(one),
                })}
              </Text>
            ))}
            <Text style={[styles.small, align]}>{t('demo.cover.sheetNever')}</Text>
            <Text style={[styles.small, align]}>{t('demo.cover.sheetWorld')}</Text>
          </View>
        </>
      )}
      {day !== null && (
        <View testID="cover-log" style={styles.card}>
          {day.term === null ? (
            <Text style={[styles.body, align]}>{t('demo.cover.noTerm')}</Text>
          ) : (
            <>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t('demo.cover.log', { term: t(`demo.cover.terms.${termKey(day.term.number)}`) })}
              </Text>
              {day.log.map((one) => (
                <Text key={one.id} testID="cover-log-line" style={[styles.body, align]}>
                  {t('demo.cover.logLine', { name: isolate(one.name), count: one.count })}
                </Text>
              ))}
            </>
          )}
          <Text style={[styles.small, align]}>{t('demo.cover.decides')}</Text>
        </View>
      )}
      <Text style={[styles.small, align]}>{t('demo.cover.makeups')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
