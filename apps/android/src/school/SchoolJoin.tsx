// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// School-join inside a demo world (#564, #565, answers 582 and 587), under the
// band, opened from the teacher's world home: the notice first, then the code's
// card (SchoolCodeCard.tsx), which during the trial term end makes joining the
// teacher's free choice, as School-join-trial draws it, with the trial named
// under the title and opening the notice. A code that reads, of this world,
// shows the school's ID shortened and asks for the teacher's yes; only that yes
// makes the key and sends anything (school-join-session.ts). The page then says
// the school's space is joined (SchoolJoined.tsx), on the world's date the
// certificate was given, and that is said aloud; the code's card stays below,
// for a code of another assignment. Every key the world's store keeps for a
// code is checked again as the page opens, newest first, and each that joined
// is shown; a code another device took first is said only when none joined, any
// other problem always, in the world's words. Going back, by the button or
// Android's back, returns to the world's home. The page's title is said as it
// opens, and that kept keys are being checked, when they are; so is each other
// page's title as it opens. The law, or the new phone's note, sits at the
// page's foot. Before any join, a link opens the way for a new phone
// (Rejoin.tsx, #566), and a joined card opens the timetable the school sent
// (TeacherTimetable.tsx, #579), the teacher's devices and copies
// (DevicesMoved.tsx), who reads what in the national system (NationalHelp.tsx,
// #568) and what stays and goes on leaving (Leave.tsx, #567), when the year's
// dates read; going back from any returns here, and Leave's way to the next
// school returns to the code's card (join-view.ts).

import {
  joiningIsVoluntary,
  keptJoins,
  leavingDates,
  readJoinCode,
  type Day,
  type SchoolJoined,
  type TrialTerm,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { errorCode } from '../lock/lock-rules';
import scanner from '../native/NativeMinhajnaCalendarInput';
import { onPc, useDeviceText } from '../text/device-text';
import { TeacherTimetable } from '../timetable/TeacherTimetable';
import { checkKeptJoins, joinSchool, problemOf } from './school-join-session';
import { DevicesMoved } from './DevicesMoved';
import { NationalHelp } from './NationalHelp';
import { Leave } from './Leave';
import { RejoinBinds, RejoinLead, RejoinRemoved } from './Rejoin';
import { SchoolCodeCard } from './SchoolCodeCard';
import { SchoolConfirm } from './SchoolConfirm';
import { SchoolJoinedCards, shortSchool } from './SchoolJoined';
import { SchoolLaw, SchoolNotice } from './SchoolNotice';
import { useJoinView } from './join-view';

type Phase =
  | { readonly kind: 'notice' }
  | { readonly kind: 'confirm'; readonly text: string; readonly school: string }
  | { readonly kind: 'joining' }
  | { readonly kind: 'checking' };

/** How long the hidden words stay, in milliseconds, so browsing the page does not read them twice. */
const SAID_FOR = 5000;

export type SchoolJoinProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  /** The world's date, written out for the band. */
  readonly date: string;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** The world's trial term end, inside which joining is voluntary (answer 587), or null. */
  readonly trial: TrialTerm | null;
  /** The world's school year, written as `2026-2027`. */
  readonly year: string;
  /** Back to the world's home. */
  readonly onClose: () => void;
};

/** The teacher's page for joining the school's space in a world. */
export function SchoolJoin({ world, date, dayText, kit, send, trial, year, onClose }: SchoolJoinProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [phase, setPhase] = useState<Phase>(() =>
    keptJoins(world.book.entries).length > 0 ? { kind: 'checking' } : { kind: 'notice' },
  );
  const [problem, setProblem] = useState<string | null>(null);
  const busy = useRef(false);
  const [joins, setJoins] = useState<readonly SchoolJoined[]>([]);
  const [said, setSaid] = useState('');
  const { view, setView, page, leave, open, toCode, scroller, onCodeLayout } = useJoinView(onClose, () =>
    setProblem(null),
  );
  const rejoin = view === 'rejoin';
  const title = t(rejoin ? 'demo.school.rejoin.title' : 'demo.school.title');
  const dates = leavingDates(year);
  const voluntary = joiningIsVoluntary(trial, world.date) ? trial : null;
  const say = (words: string) => (onPc() ? setSaid(words) : AccessibilityInfo.announceForAccessibility(words));

  const join = (text: string) => {
    if (busy.current) return;
    busy.current = true;
    setProblem(null);
    setPhase({ kind: 'joining' });
    joinSchool(world, text, kit, send)
      .then((one) => {
        setJoins((all) => [one, ...all.filter((other) => other.code !== one.code)]);
        setView('join');
        say(t('demo.school.joined'));
      })
      .catch((error: unknown) => setProblem(t(problemOf(error))))
      .finally(() => {
        busy.current = false;
        setPhase({ kind: 'notice' });
      });
  };
  const read = (text: string) => {
    const code = readJoinCode(text);
    setProblem(null);
    if (code === null) setProblem(t('demo.school.problem.code'));
    else if (code.world !== world.world) setProblem(t('demo.school.problem.world'));
    else setPhase({ kind: 'confirm', text, school: shortSchool(code.school) });
  };
  const scan = () => {
    setProblem(null);
    scanner
      .scanQr(t('demo.school.scan'), t('demo.school.scanHint'), t('demo.school.cancel'), direction === 'rtl')
      .then((text) => text !== null && read(text))
      .catch((error: unknown) => {
        const camera = errorCode(error) === 'E_CALENDAR_CAMERA';
        setProblem(t(camera ? 'demo.school.problem.camera' : 'demo.school.problem.scan'));
      });
  };

  const resume = useEffectEvent(() => {
    if (keptJoins(world.book.entries).length === 0) return;
    void checkKeptJoins(world, kit, send).then(({ joins: held, problems }) => {
      setJoins(held);
      if (problems.length > 0) setProblem(t(problemOf(problems[0])));
      setPhase({ kind: 'notice' });
    });
  });
  useEffect(() => resume(), []);
  const announce = useEffectEvent(() => {
    if (page !== 'join' && page !== 'rejoin') say(t(`demo.${page}.title`));
    else say(phase.kind === 'checking' ? `${title}. ${t('demo.school.checking')}` : title);
  });
  useEffect(() => {
    const timer = setTimeout(announce, 0);
    return () => clearTimeout(timer);
  }, [page]);
  useEffect(() => {
    if (said === '') return;
    const timer = setTimeout(() => setSaid(''), SAID_FOR);
    return () => clearTimeout(timer);
  }, [said]);

  const card = (() => {
    if (phase.kind === 'checking')
      return (
        <View testID="school-checking" style={styles.card}>
          <Text style={[styles.small, align]}>{t('demo.school.checking')}</Text>
        </View>
      );
    if (phase.kind === 'confirm' || phase.kind === 'joining')
      return (
        <SchoolConfirm
          school={phase.kind === 'confirm' ? phase.school : null}
          onAgree={() => phase.kind === 'confirm' && join(phase.text)}
          onCancel={() => setPhase({ kind: 'notice' })}
        />
      );
    return (
      <SchoolCodeCard
        trial={joins.length === 0 && !rejoin ? voluntary : null}
        dayText={dayText}
        onRead={read}
        onScan={scan}
        onNotNow={onClose}
        rejoin={rejoin}
        onRejoin={joins.length === 0 && !rejoin ? () => setView('rejoin') : undefined}
      />
    );
  })();

  if (typeof view === 'object') {
    const shown = { date, join: view.join, dayText, onClose: leave, said };
    if (view.page === 'devices') return <DevicesMoved {...shown} />;
    if (view.page === 'help') return <NationalHelp {...shown} />;
    if (view.page === 'timetable') return <TeacherTimetable {...shown} world={world} kit={kit} send={send} />;
    if (dates !== null) return <Leave {...shown} year={year} dates={dates} onJoin={toCode} />;
  }
  return (
    <View testID="school-join" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID="school-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="school-back" variant="plain" label={t('demo.entry.back')} onPress={leave} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {title}
          </Text>
          {voluntary !== null && !rejoin && (
            <Text style={[styles.small, align]}>{t('demo.school.trial.badge', { year: voluntary.year })}</Text>
          )}
        </View>
      </View>
      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}
      >
        <View style={styles.column}>
          {rejoin ? (
            <RejoinLead />
          ) : (
            <SchoolNotice
              lead={
                voluntary === null
                  ? undefined
                  : t('demo.school.trial.lead', { date: dayText(world.date), term: voluntary.term })
              }
            />
          )}
          <SchoolJoinedCards
            joins={joins}
            dayText={dayText}
            onDevices={open('devices')}
            onHelp={open('help')}
            onTimetable={open('timetable')}
            onLeave={dates === null ? undefined : open('leave')}
          />
          <View onLayout={onCodeLayout} style={styles.code}>
            {card}
          </View>
          {rejoin && <RejoinRemoved />}
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
            {problem ?? ''}
          </Text>
          <View style={styles.foot}>{rejoin ? <RejoinBinds /> : <SchoolLaw />}</View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], paddingVertical: spacing['space-8'] },
  titles: { flexShrink: 1 },
  title: { ...typography['bar-title'], color: colors.ink },
  content: {
    flexGrow: 1,
    paddingTop: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    alignItems: 'center',
  },
  column: { flexGrow: 1, width: '100%', maxWidth: 640, gap: spacing['space-16'] },
  foot: { marginTop: 'auto' },
  code: { gap: spacing['space-16'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
