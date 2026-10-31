// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One teacher's proposal on the director's timetable page (#578, D-TT-proposal,
// answer 606): the teacher; the session now, in the standing version, and the
// slot proposed, in pencil (Proposal.tsx), or that the session is no longer
// there, or that the standing version already holds the move and the acceptance
// is still to record, with the version it is recorded with, or, when no part
// this device's key put there holds the move, that recording publishes it again
// to the teacher and declining leaves it published; the teacher's note; the
// checks against the whole standing version in plain words (proposal-text.ts),
// and that a move that clashes, changes the hours or splits a joint session can
// only be declined. A move that may be accepted offers its first day, next
// Sunday by default or one of the three Sundays after, never before the
// standing version's, and says who is sent the change and that sessions
// recorded before it are not rewritten. A note may go with the decision, then
// accept, or record the acceptance, and decline, which is not offered once the
// move can be recorded. Names are isolated so a name in other letters keeps its
// place.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Proposal } from '../components/Proposal';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { acceptable, type WaitingProposal } from './proposal-session';
import { checkLines, slotText } from './proposal-text';

export type ProposalDetailProps = {
  readonly one: WaitingProposal;
  /** The standing version's number, and the number the next version takes. */
  readonly standing: number;
  readonly version: number;
  /** The first days offered, and the one chosen. */
  readonly days: readonly Day[];
  readonly from: Day | undefined;
  readonly onPick: (day: Day) => void;
  readonly note: string;
  readonly onNote: (note: string) => void;
  readonly busy: boolean;
  readonly onDecide: (accepted: boolean) => void;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
};

/** A proposal with its checks, its first day, a note, and the decision. */
export function ProposalDetail(props: ProposalDetailProps) {
  const { one, standing, version, days, from, onPick, note, onNote, busy, onDecide, dayText } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const teacher = isolate(one.teacher);
  const may = acceptable(one) && from !== undefined;
  const lines = checkLines(t, one);
  return (
    <View testID="tt-proposal" style={styles.group}>
      <Text style={[styles.label, align]}>{teacher}</Text>
      {one.published && (
        <Text style={[styles.label, align]}>
          {one.recordable === null
            ? t('ttProposal.publishedLine')
            : t('ttProposal.recordLine', { version: one.recordable })}
        </Text>
      )}
      {!one.published && (one.now === null || one.moved === null) && (
        <Text style={[styles.label, align]}>{t('ttProposal.gone')}</Text>
      )}
      {one.now !== null && one.moved !== null && (
        <>
          <Text style={[styles.small, align]}>{t('ttProposal.now', { version: standing })}</Text>
          <Text testID="tt-proposal-now" style={[styles.body, align]}>
            {slotText(t, one.now)}
          </Text>
          <Proposal
            testID="tt-proposal-moved"
            tag={t('ttProposal.proposed')}
            lines={[{ text: slotText(t, one.moved) }]}
          />
        </>
      )}
      {one.proposal.note !== '' && (
        <Text style={[styles.small, align]}>{t('ttProposal.note', { teacher, note: isolate(one.proposal.note) })}</Text>
      )}
      {lines.length > 0 && <Text style={[styles.label, align]}>{t('ttProposal.checks')}</Text>}
      {lines.map((line, at) => (
        <Text key={`check-${at}`} testID="tt-proposal-check" style={[styles.small, align]}>
          {line}
        </Text>
      ))}
      {!acceptable(one) && one.now !== null && <Text style={[styles.label, align]}>{t('ttProposal.cannot')}</Text>}
      {may && !one.published && (
        <>
          <ChipGroup
            testID="tt-proposal-day"
            label={t('ttProposal.startDay')}
            choices={days.map((day) => ({ value: day, label: dayText(day) }))}
            selected={from}
            onSelect={onPick}
          />
          <Text style={[styles.small, align]}>{t('ttProposal.told', { teacher, day: dayText(from) })}</Text>
          <Text style={[styles.small, align]}>{t('ttVersion.recorded', { day: dayText(from) })}</Text>
        </>
      )}
      <TextField
        testID="tt-proposal-reply"
        label={t('ttProposal.reply')}
        placeholder={t('ttProposal.replyHint')}
        optionalLabel={t('ttProposal.optional')}
        value={note}
        onChangeText={(value) => onNote(value.slice(0, 280))}
        multiline
      />
      {may && (
        <Button
          testID="tt-proposal-accept"
          label={one.published ? t('ttProposal.record') : t('ttProposal.accept', { version, day: dayText(from) })}
          disabled={busy}
          onPress={() => onDecide(true)}
        />
      )}
      {(!one.published || one.recordable === null) && (
        <Button
          testID="tt-proposal-decline"
          label={t('ttProposal.decline')}
          variant="line"
          disabled={busy}
          onPress={() => onDecide(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-4'] },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
