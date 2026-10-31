// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teachers' proposals on the director's timetable page (#578,
// D-TT-proposal, R-7.4-14, R-7.14-04, answer 606). Looking reads the proposals
// waiting (proposal-session.ts) and counts them, or says none waits, or that no
// version is published yet; several are picked one at a time, each by its
// number, its teacher and the slot proposed, and the proposal shown, with its
// checks and the decision, is ProposalDetail.tsx. A note written goes with the
// proposal it was written for, and picking another clears it. Accepting
// publishes the next version, or records an acceptance still to record, and
// declining changes nothing; either way the teacher is told. What was decided
// is said, with how many teachers were sent the version and whose part did not
// reach the server, and that a timetable read before it still has the old slot;
// then the proposals are read again, after a problem too, keeping the proposal
// shown, and its note, while it still waits. What is said goes, on a PC, to the
// page's hidden live region, and elsewhere it is announced; a problem is said
// in the catalogue's words.

import type { BellTimes, Day, DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { spanText } from './grid-text';
import { ProposalDetail } from './ProposalDetail';
import { decideProposal, readProposals, type Proposals } from './proposal-session';
import type { SentParts } from './version-session';
import { startDays } from './version-text';

export type TimetableProposalsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: Pick<DemoSchool, 'name' | 'teachers'>;
  readonly bells: BellTimes;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
};

type Outcome = { readonly words: string; readonly accepted: boolean; readonly sent: SentParts | null };

/** The proposals waiting, one at a time, with its checks and the decision. */
export function TimetableProposals({ world, school, bells, kit, send, dayText }: TimetableProposalsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [step, setStep] = useState<'looking' | 'deciding' | null>(null);
  const [read, setRead] = useState<Proposals | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Day | null>(null);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [said, setSaid] = useState({ words: '', count: 0 });
  const mounted = useRef(true);
  const working = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const one = read?.waiting.find((waiting) => waiting.id === chosen) ?? null;
  const days = startDays(world.date, read?.standing?.from ?? null);
  const from = picked !== null && days.includes(picked) ? picked : days[0];
  const say = (words: string) => {
    if (onPc()) setSaid((before) => ({ words, count: before.count + 1 }));
    else AccessibilityInfo.announceForAccessibility(words);
  };
  const run = async (doing: 'looking' | 'deciding', work: () => Promise<string | null>) => {
    if (working.current) return;
    working.current = true;
    setStep(doing);
    setProblem(null);
    try {
      const words = await work();
      if (mounted.current && words !== null) say(words);
    } catch (error) {
      if (!mounted.current) return;
      const key = problemOf(error);
      setProblem(key);
      say(t(key));
    } finally {
      working.current = false;
      if (mounted.current) setStep(null);
    }
  };
  const again = async (keep: string | null) => {
    const found = await readProposals(world, school, kit, send);
    if (!mounted.current) return found;
    const still = found.waiting.some((waiting) => waiting.id === keep);
    setRead(found);
    setChosen(still ? keep : (found.waiting[0]?.id ?? null));
    if (!still) setNote('');
    return found;
  };
  const look = () =>
    run('looking', async () => {
      setOutcome(null);
      const found = await again(chosen);
      if (found.standing === null && found.waiting.length === 0) return t('ttProposal.noVersion');
      if (found.waiting.length === 0) return t('ttProposal.none');
      return t('ttProposal.waiting', { proposals: found.waiting.length });
    });
  const decide = (accepted: boolean) =>
    run('deciding', async () => {
      if (one === null || from === undefined) return null;
      const decided = await decideProposal(world, school, one.id, { accepted, note, from }, bells, kit, send).catch(
        async (error: unknown) => {
          await again(one.id).catch(() => undefined);
          throw error;
        },
      );
      const teacher = isolate(one.teacher);
      const words = accepted
        ? t('ttProposal.accepted', { version: decided.version ?? 0, teacher })
        : t('ttProposal.declined', { teacher });
      if (mounted.current) setOutcome({ words, accepted, sent: decided.sent });
      await again(null).catch(() => undefined);
      return words;
    });
  const choices = (read?.waiting ?? []).map((waiting, at) => {
    const { day, start, end } = waiting.proposal;
    const slot = `${t(`week.days.${day}`)} ${spanText(start, end)}`;
    return {
      value: waiting.id,
      label: t('ttProposal.pickLabel', { number: at + 1, teacher: isolate(waiting.teacher), slot }),
    };
  });
  const pick = (id: string) => {
    setChosen(id);
    setNote('');
  };
  const sent = outcome?.sent ?? null;
  return (
    <View testID="tt-proposals" style={styles.card}>
      {onPc() && (
        <View accessibilityLiveRegion="polite" style={styles.hidden}>
          <Text key={said.count} testID="tt-proposals-said">
            {said.words}
          </Text>
        </View>
      )}
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('ttProposal.title')}
      </Text>
      <Text style={[styles.small, align]}>{t('ttProposal.line')}</Text>
      <Button
        testID="tt-proposals-look"
        label={t('ttProposal.look')}
        variant="line"
        disabled={step !== null}
        onPress={() => void look()}
      />
      {read !== null && read.waiting.length === 0 && (
        <Text style={[styles.body, align]}>
          {t(read.standing === null ? 'ttProposal.noVersion' : 'ttProposal.none')}
        </Text>
      )}
      {read !== null && read.waiting.length > 0 && (
        <Text style={[styles.body, align]}>{t('ttProposal.waiting', { proposals: read.waiting.length })}</Text>
      )}
      {choices.length > 1 && one !== null && (
        <ChipGroup
          testID="tt-proposal-pick"
          label={t('ttProposal.pick')}
          choices={choices}
          selected={one.id}
          onSelect={pick}
        />
      )}
      {one !== null && read !== null && (
        <ProposalDetail
          one={one}
          standing={read.standing?.version ?? 0}
          version={read.version}
          days={days}
          from={from}
          onPick={setPicked}
          note={note}
          onNote={setNote}
          busy={step !== null}
          onDecide={(accepted) => void decide(accepted)}
          dayText={dayText}
        />
      )}
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {step === null ? '' : t(step === 'looking' ? 'ttProposal.looking' : 'ttProposal.deciding')}
      </Text>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
        {problem === null ? '' : t(problem)}
      </Text>
      {outcome !== null && (
        <View testID="tt-proposal-done" style={styles.group}>
          <Text style={[styles.body, align]}>{outcome.words}</Text>
          {sent !== null && (
            <Text style={[styles.small, align]}>{t('ttSend.sent', { teachers: sent.sent.length })}</Text>
          )}
          {sent !== null && sent.failed.length > 0 && (
            <Text style={[styles.label, align]}>
              {`${t('ttSend.failed')} ${sent.failed.map(isolate).join(t('ttSend.and'))}`}
            </Text>
          )}
          {outcome.accepted && <Text style={[styles.small, align]}>{t('ttProposal.readAgain')}</Text>}
        </View>
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
