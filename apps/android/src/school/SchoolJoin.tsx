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
// opens, and that kept keys are being checked, when they are.

import {
  joiningIsVoluntary,
  keptJoins,
  readJoinCode,
  type Day,
  type SchoolJoined,
  type TrialTerm,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { errorCode } from '../lock/lock-rules';
import scanner from '../native/NativeMinhajnaCalendarInput';
import { onPc, useDeviceText } from '../text/device-text';
import { checkKeptJoins, joinSchool } from './school-join-session';
import { SchoolCodeCard } from './SchoolCodeCard';
import { SchoolJoinedCards, shortSchool } from './SchoolJoined';
import { SchoolLaw, SchoolNotice } from './SchoolNotice';

type Phase =
  | { readonly kind: 'notice' }
  | { readonly kind: 'confirm'; readonly text: string; readonly school: string }
  | { readonly kind: 'joining' }
  | { readonly kind: 'checking' };

const PROBLEMS = {
  E_JOIN_CODE: 'demo.school.problem.code',
  E_JOIN_WORLD: 'demo.school.problem.world',
  E_JOIN_TAKEN: 'demo.school.problem.taken',
  E_CALENDAR_CAMERA: 'demo.school.problem.camera',
  E_WORLD_BUSY: 'demo.problem.busy',
  E_OFFLINE: 'demo.problem.offline',
  E_TIMEOUT: 'demo.problem.offline',
  E_WORLD_KIT: 'demo.problem.device',
  E_WORLD: 'demo.problem.store',
  E_KEY_LOST: 'demo.problem.store',
} as const;

/** The catalogue's words for an error's code. */
function problemOf(error: unknown): (typeof PROBLEMS)[keyof typeof PROBLEMS] | 'demo.problem.other' {
  const code = errorCode(error);
  return code !== undefined && Object.hasOwn(PROBLEMS, code)
    ? PROBLEMS[code as keyof typeof PROBLEMS]
    : 'demo.problem.other';
}

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
  /** Back to the world's home. */
  readonly onClose: () => void;
};

/** The teacher's page for joining the school's space in a world. */
export function SchoolJoin({ world, date, dayText, kit, send, trial, onClose }: SchoolJoinProps) {
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
  const title = t('demo.school.title');
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
  const back = useEffectEvent(onClose);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => handler.remove();
  }, []);
  const announce = useEffectEvent(() =>
    say(phase.kind === 'checking' ? `${title}. ${t('demo.school.checking')}` : title),
  );
  useEffect(() => {
    const timer = setTimeout(announce, 0);
    return () => clearTimeout(timer);
  }, []);
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
    if (phase.kind === 'confirm' || phase.kind === 'joining') {
      const joining = phase.kind === 'joining';
      return (
        <View testID="school-confirm" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.school.confirmTitle')}
          </Text>
          {phase.kind === 'confirm' && (
            <Text style={[styles.small, align]}>{t('demo.school.confirmLine', { school: phase.school })}</Text>
          )}
          <Button
            testID="school-agree"
            label={t(joining ? 'demo.school.joining' : 'demo.school.agree')}
            disabled={joining}
            onPress={() => phase.kind === 'confirm' && join(phase.text)}
          />
          {!joining && (
            <Button
              testID="school-cancel"
              variant="plain"
              label={t('demo.school.cancel')}
              onPress={() => setPhase({ kind: 'notice' })}
            />
          )}
        </View>
      );
    }
    return (
      <SchoolCodeCard
        trial={joins.length === 0 ? voluntary : null}
        dayText={dayText}
        onRead={read}
        onScan={scan}
        onNotNow={onClose}
      />
    );
  })();

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
        <Button testID="school-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {title}
          </Text>
          {voluntary !== null && (
            <Text style={[styles.small, align]}>{t('demo.school.trial.badge', { year: voluntary.year })}</Text>
          )}
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <SchoolNotice
            lead={
              voluntary === null
                ? undefined
                : t('demo.school.trial.lead', { date: dayText(world.date), term: voluntary.term })
            }
          />
          <SchoolJoinedCards joins={joins} dayText={dayText} />
          {card}
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
            {problem ?? ''}
          </Text>
          <SchoolLaw />
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
  column: { width: '100%', maxWidth: 640, gap: spacing['space-16'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
