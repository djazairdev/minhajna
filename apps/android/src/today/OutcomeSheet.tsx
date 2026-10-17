// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «نتيجة أخرى» on Today (#32, Sheet, Sheet-nostage, Sheet-reason): the last
// stage reached, or for an item without stages whether it goes on or is
// finished, merged with the next one; skipping the lesson, teaching an
// earlier one again, or a session not held. Skipping and «لم تُعقد الحصة»
// take an optional reason, which stays on the teacher's devices. Nothing is
// recorded until a choice is made, and closing chooses nothing.

import type { Choice, PackItem, Proposal, Reason } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState, type RefObject } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { OptionRow } from '../components/OptionRow';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { REASON_CHOICES, stageChoices, type ReasonChoice } from './outcome-rules';

/** What the sheet chose: the outcome, and a private reason for a skip or a session not held. */
export interface Outcome {
  readonly choice: Choice;
  readonly privateReason?: Reason;
  readonly reason?: string;
}

export interface OutcomeSheetProps {
  readonly visible: boolean;
  /** Such as «4م2 · 08:00 – 09:00 · الموضوع». */
  readonly context: string;
  readonly proposal: Proposal;
  readonly next: PackItem | undefined;
  readonly previous: PackItem | undefined;
  readonly onChoose: (outcome: Outcome) => void;
  readonly onClose: () => void;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
}

type Asking = 'skipped' | 'not-held' | null;

export function OutcomeSheet(props: OutcomeSheetProps) {
  const { proposal, next, previous, onChoose } = props;
  const { direction } = useLocale();
  const t = useText();
  const [asking, setAsking] = useState<Asking>(null);
  const [reason, setReason] = useState<ReasonChoice>('none');
  const [text, setText] = useState('');
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const item = proposal.item.title;
  const close = () => {
    setAsking(null);
    setReason('none');
    setText('');
    props.onClose();
  };
  const choose = (outcome: Outcome) => {
    setAsking(null);
    setReason('none');
    setText('');
    onChoose(outcome);
  };

  const options = (
    <>
      {proposal.stageNames.length > 0 ? (
        <ChipGroup
          testID="outcome-stage"
          label={t('outcome.reached')}
          hint={t('outcome.carry')}
          choices={stageChoices(proposal).map((stage) => ({ value: String(stage.reached), label: stage.name }))}
          selected={null}
          onSelect={(value) => choose({ choice: { outcome: 'partial', reached: Number(value) } })}
        />
      ) : (
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('outcome.noStages')}</Text>
          <OptionRow
            testID="outcome-goes-on"
            label={t('outcome.goesOn')}
            sub={t('outcome.goesOnSub')}
            onPress={() => choose({ choice: { outcome: 'partial', reached: 0 } })}
          />
          <OptionRow
            testID="outcome-finished"
            label={t('outcome.finished')}
            sub={next === undefined ? t('outcome.lastItem') : t('outcome.finishedSub', { next: next.title })}
            onPress={() => choose({ choice: { outcome: 'partial', reached: 1 } })}
          />
          {next !== undefined && (
            <OptionRow
              testID="outcome-merged"
              label={t('outcome.merged')}
              sub={next.title}
              onPress={() => choose({ choice: { outcome: 'merged', with: next.id } })}
            />
          )}
        </View>
      )}
      <OptionRow
        testID="outcome-skip"
        label={t('outcome.skip')}
        sub={t('outcome.reasonSub')}
        onPress={() => setAsking('skipped')}
      />
      {previous !== undefined && (
        <OptionRow
          testID="outcome-retaught"
          label={t('outcome.retaught')}
          sub={previous.title}
          onPress={() => choose({ choice: { outcome: 'retaught', item: previous.id } })}
        />
      )}
      <OptionRow
        testID="outcome-not-held"
        label={t('outcome.notHeld')}
        sub={t('outcome.reasonSub')}
        onPress={() => setAsking('not-held')}
      />
    </>
  );

  const kept =
    asking === 'not-held'
      ? t('outcome.keptNotHeld', { item })
      : next === undefined
        ? t('outcome.keptSkipLast', { item })
        : t('outcome.keptSkip', { item, next: next.title });
  const why = (
    <>
      <Text style={[styles.body, align]}>{kept}</Text>
      <ChipGroup
        testID="outcome-reason"
        label={t('outcome.reasonLabel')}
        choices={REASON_CHOICES.map((value) => ({ value, label: t(`outcome.reasons.${value}`) }))}
        selected={reason}
        onSelect={setReason}
      />
      {reason === 'other' && (
        <TextField
          testID="outcome-reason-text"
          label={t('outcome.reasonText')}
          placeholder={t('outcome.reasonPlaceholder')}
          value={text}
          onChangeText={setText}
          maxLength={60}
        />
      )}
      <Text style={[styles.note, align]}>{t('outcome.private')}</Text>
      {asking === 'not-held' && <Text style={[styles.note, align]}>{t('outcome.statement')}</Text>}
      <View style={styles.buttons}>
        <View style={styles.half}>
          <Button testID="outcome-back" variant="line" label={t('outcome.back')} onPress={() => setAsking(null)} />
        </View>
        <View style={styles.half}>
          <Button
            testID="outcome-done"
            label={t('outcome.done')}
            onPress={() =>
              choose({
                choice: asking === 'not-held' ? { outcome: 'not-held' } : { outcome: 'skipped', instead: false },
                ...(reason !== 'none' && { privateReason: reason }),
                ...(reason === 'other' && text.trim() !== '' && { reason: text.trim() }),
              })
            }
          />
        </View>
      </View>
    </>
  );

  return (
    <BottomSheet
      testID="outcome-sheet"
      visible={props.visible}
      title={asking === null ? t('outcome.title') : t(asking === 'not-held' ? 'outcome.notHeld' : 'outcome.skip')}
      context={props.context}
      reassurance={t('outcome.reassurance')}
      returnFocusRef={props.returnFocusRef}
      onClose={close}
    >
      {asking === null ? options : why}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  buttons: { flexDirection: 'row', gap: spacing['space-8'] },
  half: { flex: 1 },
});
