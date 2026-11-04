// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a committee's cut shaped the exam, in its own words (#606, R-7.10-21,
// answer 640), on its room after the exam: the words that count, or that none
// are written yet, and for a seat that adopted the cut, chosen among them, a
// field for the words as they will be published, unchanged, trimmed and in NFC,
// with a way to sign them, held back while they do not read as words.

import { WORDS_LENGTH, wordsRead, type CommitteeWords } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { useDeviceText } from '../text/device-text';
import { thresholdStyles as styles } from './ThresholdFrame';

export type CommitteeWordsFormProps = {
  /** The seats that adopted the cut. */
  readonly seats: readonly number[];
  /** The words that count, if any. */
  readonly words: CommitteeWords | null;
  readonly busy: boolean;
  /** Signs a seat's words, saying `done` once signed. */
  readonly onWrite: (seat: number, words: string, done: string) => void;
};

/** The committee's words, and a field to sign them. */
export function CommitteeWordsForm({ seats, words, busy, onWrite }: CommitteeWordsFormProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [chosen, setChosen] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const seat = seats.find((one) => one === chosen) ?? seats[0];
  const post = t('demo.committee.seat', { n: seat + 1 });
  const text = typed.trim().normalize('NFC');
  const reads = wordsRead(text);
  return (
    <View testID="committee-words" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.committee.words.title')}
      </Text>
      <Text style={[styles.body, align]}>{words === null ? t('demo.committee.words.none') : words.words}</Text>
      <ChipGroup
        testID="committee-words-seats"
        label={t('demo.committee.seats')}
        choices={seats.map((one) => ({ value: String(one), label: t('demo.committee.seat', { n: one + 1 }) }))}
        selected={String(seat)}
        onSelect={(one) => setChosen(Number(one))}
      />
      <TextField
        testID="committee-words-field"
        multiline
        label={t('demo.committee.words.label')}
        placeholder={t('demo.committee.words.placeholder')}
        value={typed}
        onChangeText={setTyped}
        {...(text !== '' && !reads ? { error: t('demo.committee.words.bad', { most: WORDS_LENGTH }) } : {})}
      />
      <Button
        testID="committee-words-sign"
        label={t('demo.committee.words.sign')}
        name={`${t('demo.committee.words.sign')}${t('chart.colon')}${post}`}
        disabled={busy || !reads}
        onPress={() => {
          setTyped('');
          onWrite(seat, text, t('demo.committee.words.done', { seat: post }));
        }}
      />
      <Text style={[styles.small, align]}>{t('demo.committee.words.note')}</Text>
    </View>
  );
}
