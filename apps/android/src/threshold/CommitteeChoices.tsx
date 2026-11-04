// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seat's choices on a committee's page (#604, answer 638), as a setter has
// them (answer 633), while the room is open: the page plays each seat, a
// made-up inspector's post and never a person's name, and offers the seat
// chosen to sign the cut proposed when it names another, to propose a cut,
// picked among the plan's items, or to sign no cut, saying the key it signs
// with. Choosing another seat puts a pick aside.

import type { CommitteeState } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { OptionRow } from '../components/OptionRow';
import { useDeviceText } from '../text/device-text';
import { thresholdStyles as styles } from './ThresholdFrame';

export type CommitteeChoicesProps = {
  /** How many seats the committee has. */
  readonly seats: number;
  readonly state: CommitteeState;
  readonly items: readonly string[];
  /** A plan item's name, quoted, or that there is none. */
  readonly item: (id: string | null) => string;
  readonly busy: boolean;
  /** Signs a seat's vote, an item or null for no cut, saying `done` once signed. */
  readonly onVote: (seat: number, item: string | null, done: string) => void;
};

/** The seat chooser and the seat's choices. */
export function CommitteeChoices(props: CommitteeChoicesProps) {
  const { seats, state, items, item, busy, onVote } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [seat, setSeat] = useState(0);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const post = t('demo.committee.seat', { n: seat + 1 });
  const named = (label: string) => ({ label, name: `${label}${t('chart.colon')}${post}` });
  const putAside = () => {
    setPicking(false);
    setChosen(null);
  };
  const vote = (cut: string | null) => {
    putAside();
    const done =
      cut === null
        ? t('demo.committee.noneDone', { seat: post })
        : t('demo.committee.done', { seat: post, item: item(cut) });
    onVote(seat, cut, done);
  };
  const note = <Text style={[styles.small, align]}>{t('demo.committee.signNote')}</Text>;
  const { proposed } = state;
  const awaiting = proposed !== null && state.votes.get(seat)?.item !== proposed.item;
  return (
    <View testID="committee-choices" style={styles.card}>
      <ChipGroup
        testID="committee-seats"
        label={t('demo.committee.seats')}
        choices={Array.from({ length: seats }, (_, at) => ({
          value: String(at),
          label: t('demo.committee.seat', { n: at + 1 }),
        }))}
        selected={String(seat)}
        onSelect={(one) => {
          putAside();
          setSeat(Number(one));
        }}
      />
      {picking ? (
        <>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.threshold.pick')}
          </Text>
          {items.map((each) => (
            <OptionRow
              key={each}
              testID="committee-item"
              label={item(each)}
              selected={chosen === each}
              disabled={busy}
              onPress={() => setChosen(each)}
            />
          ))}
          {note}
          <Button
            testID="committee-propose-sign"
            {...named(t('demo.threshold.proposeSign'))}
            disabled={busy || chosen === null}
            onPress={() => vote(chosen)}
          />
          <Button testID="committee-pick-back" variant="plain" label={t('demo.entry.back')} onPress={putAside} />
        </>
      ) : (
        <>
          {awaiting && (
            <Button
              testID="committee-sign"
              disabled={busy}
              {...named(t('demo.threshold.sign', { item: item(proposed.item) }))}
              onPress={() => vote(proposed.item)}
            />
          )}
          <Button
            testID="committee-propose"
            {...(awaiting ? { variant: 'line' as const } : {})}
            disabled={busy}
            {...named(t(proposed === null ? 'demo.threshold.propose' : 'demo.threshold.proposeOther'))}
            onPress={() => setPicking(true)}
          />
          <Button
            testID="committee-none"
            variant="plain"
            disabled={busy}
            {...named(t('demo.committee.noCut'))}
            onPress={() => vote(null)}
          />
          {note}
        </>
      )}
    </View>
  );
}
