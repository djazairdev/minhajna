// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's proposals on their timetable from the school (#579, TT-propose,
// answer 607), newest first: each says the session as the part it was made on
// holds it, or nothing when that part is gone, then the time proposed, in
// pencil (Proposal.tsx), the teacher's note, and its state: waiting for the
// director's decision, accepted with the version that publishes it, or
// declined, with the school's note when it gave one. Names are isolated so a
// name in other letters keeps its place.

import type { ProposalOnChannel, SignedPart } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Proposal } from '../components/Proposal';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { slotText } from './proposal-text';

export type SentProposalsProps = {
  readonly proposals: readonly ProposalOnChannel[];
  /** The parts on the channel, where each proposal's session is found. */
  readonly parts: readonly SignedPart[];
};

/** The teacher's proposals with their state, newest first. */
export function SentProposals({ proposals, parts }: SentProposalsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (proposals.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.propose.yours')}
      </Text>
      {[...proposals].reverse().map(({ id, proposal: { value }, decision }) => {
        const part = parts.find((one) => one.part.version === value.version)?.part;
        const session = part?.sessions.find((one) => one.id === value.session);
        const blank = { class: '', group: '', subject: '', week: 'both' } as const;
        const moved = { ...(session ?? blank), day: value.day, start: value.start, end: value.end, room: value.room };
        const state =
          decision === null
            ? t('demo.propose.waiting')
            : decision.value.accepted
              ? t('demo.propose.accepted', { version: decision.value.version })
              : t('demo.propose.declined');
        return (
          <View key={id} testID="teacher-proposal" style={styles.one}>
            {session !== undefined && <Text style={[styles.body, align]}>{slotText(t, session)}</Text>}
            <Proposal tag={t('demo.propose.proposed')} lines={[{ text: slotText(t, moved) }]} />
            {value.note !== '' && (
              <Text style={[styles.small, align]}>{t('demo.propose.yourNote', { note: isolate(value.note) })}</Text>
            )}
            <Text testID="teacher-proposal-state" style={[styles.label, align]}>
              {state}
            </Text>
            {decision !== null && decision.value.note !== '' && (
              <Text style={[styles.small, align]}>
                {t('demo.propose.reply', { note: isolate(decision.value.note) })}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  one: { gap: spacing['space-4'], paddingVertical: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
