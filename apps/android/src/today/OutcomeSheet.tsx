// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «نتيجة أخرى» on Today (#32, #33, Sheet, Sheet-nostage, Sheet-reason): the
// last stage reached, or for an item without stages whether it goes on or is
// finished, merged with the next one; skipping the lesson, teaching an
// earlier one again, or a session not held. Each is recorded on the second
// tap. Skipping and «لم تُعقد الحصة» then offer an optional reason, which
// stays on the teacher's devices and is kept the moment it is chosen, and a
// session not held can be marked to be made up. The hints say which session
// what is left goes on in, and how many sessions an item without stages has
// taken. Closing before a choice records nothing.

import type { Choice, PackItem, Proposal, Reason } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState, type RefObject } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { ChipGroup } from '../components/Chip';
import { OptionRow } from '../components/OptionRow';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { REASON_CHOICES, stageChoices, type CarryWords, type ReasonChoice } from './outcome-rules';

export interface OutcomeSheetProps {
  readonly visible: boolean;
  /** Such as «4م2 · 08:00 – 09:00 · الموضوع». */
  readonly context: string;
  readonly proposal: Proposal;
  readonly next: PackItem | undefined;
  readonly previous: PackItem | undefined;
  /** Where what is left goes on, or null when no later session is known. */
  readonly carry: CarryWords | null;
  /** Records the outcome chosen. */
  readonly onChoose: (choice: Choice) => void;
  /** Keeps the reason given for a skip or a session not held, in the private note only. */
  readonly onReason: (reason: Reason | undefined, text: string | undefined) => void;
  readonly onClose: () => void;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
}

type Asking = 'skipped' | 'not-held' | null;

export function OutcomeSheet(props: OutcomeSheetProps) {
  const { proposal, next, previous } = props;
  const { direction } = useLocale();
  const t = useText();
  const [asking, setAsking] = useState<Asking>(null);
  const [reason, setReason] = useState<ReasonChoice>('none');
  const [text, setText] = useState('');
  const [makeUp, setMakeUp] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const item = proposal.item.title;
  const keep = (chosen: ReasonChoice, typed: string) =>
    props.onReason(
      chosen === 'none' ? undefined : chosen,
      chosen === 'other' && typed.trim() !== '' ? typed.trim() : undefined,
    );
  const close = () => {
    if (asking !== null) keep(reason, text);
    setAsking(null);
    setReason('none');
    setText('');
    setMakeUp(false);
    props.onClose();
  };
  const choose = (choice: Choice) => {
    props.onChoose(choice);
    close();
  };
  const ask = (choice: Choice & { outcome: 'skipped' | 'not-held' }) => {
    props.onChoose(choice);
    setMakeUp(false);
    setAsking(choice.outcome);
  };
  const carry = props.carry;
  const where = (key: 'outcome.carryAt' | 'outcome.goesOnAt', otherwise: string) =>
    carry === null ? otherwise : t(key, { at: carry.at, not: carry.not });
  const spent = proposal.session;

  const options = (
    <>
      {proposal.stageNames.length > 0 ? (
        <ChipGroup
          testID="outcome-stage"
          label={t('outcome.reached')}
          hint={where('outcome.carryAt', t('outcome.carry'))}
          choices={stageChoices(proposal).map((stage) => ({ value: String(stage.reached), label: stage.name }))}
          selected={null}
          onSelect={(value) => choose({ outcome: 'partial', reached: Number(value) })}
        />
      ) : (
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('outcome.noStages')}</Text>
          <OptionRow
            testID="outcome-goes-on"
            label={t('outcome.goesOn')}
            sub={`${t('outcome.spent', { count: spent })} ${where('outcome.goesOnAt', t('outcome.goesOnSub'))}`}
            onPress={() => choose({ outcome: 'partial', reached: 0 })}
          />
          <OptionRow
            testID="outcome-finished"
            label={t('outcome.finished')}
            sub={`${t('outcome.finishedIn', { count: spent })} ${
              next === undefined
                ? t('outcome.lastItem')
                : carry === null
                  ? t('outcome.finishedSub', { next: next.title })
                  : t('outcome.finishedSubOn', { next: next.title, day: carry.day })
            }`}
            onPress={() => choose({ outcome: 'partial', reached: 1 })}
          />
          {next !== undefined && (
            <OptionRow
              testID="outcome-merged"
              label={t('outcome.merged')}
              sub={next.title}
              onPress={() => choose({ outcome: 'merged', with: next.id })}
            />
          )}
        </View>
      )}
      <OptionRow
        testID="outcome-skip"
        label={t('outcome.skip')}
        sub={t('outcome.reasonSub')}
        onPress={() => ask({ outcome: 'skipped', instead: false })}
      />
      {previous !== undefined && (
        <OptionRow
          testID="outcome-retaught"
          label={t('outcome.retaught')}
          sub={previous.title}
          onPress={() => choose({ outcome: 'retaught', item: previous.id })}
        />
      )}
      <OptionRow
        testID="outcome-not-held"
        label={t('outcome.notHeld')}
        sub={t('outcome.reasonSub')}
        onPress={() => ask({ outcome: 'not-held' })}
      />
    </>
  );

  const kept =
    asking === 'not-held'
      ? carry === null
        ? t('outcome.keptNotHeld', { item })
        : t('outcome.keptNotHeldOn', { item, day: carry.day })
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
        onSelect={(value) => {
          setReason(value);
          keep(value, text);
        }}
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
      {asking === 'not-held' && (
        <>
          <Text style={[styles.note, align]}>{t('outcome.statement')}</Text>
          <CheckRow
            testID="outcome-make-up"
            label={t('outcome.makeUp')}
            checked={makeUp}
            onCheckedChange={(checked) => {
              setMakeUp(checked);
              props.onChoose({ outcome: 'not-held', ...(checked && { makeUp: true }) });
            }}
          />
          <Text style={[styles.note, align]}>{t('outcome.makeUpNote')}</Text>
        </>
      )}
      <View style={styles.buttons}>
        <View style={styles.half}>
          <Button testID="outcome-back" variant="line" label={t('outcome.back')} onPress={() => setAsking(null)} />
        </View>
        <View style={styles.half}>
          <Button testID="outcome-done" label={t('outcome.done')} onPress={close} />
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
