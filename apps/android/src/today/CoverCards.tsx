// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The day's covers on Today (#224, Today-special, answer 332): each with
// «تعويض», its times and the colleague's class, and «تمّت», which writes
// it in the daily journal, and «حذف التعويض», which removes one entered by
// mistake, done or not, once confirmed, kept in the history. Only a cover at
// a school that takes one shows, as the journal prints it. It has no plan
// and is never counted.

import { coversOn, setDuty, type Day, type ExamDuty, type RecordEvent, type State } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SaveProblem } from '../calendar/SaveProblem';
import { useCalendarSave } from '../calendar/useCalendarSave';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { bookSpan } from '../entry/book-lines';
import { coverSchools } from '../exams/cover-schools';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { specialStyles as styles } from './special-styles';

function CoverCard({ cover }: { cover: ExamDuty }) {
  const t = useText();
  const data = useAppData();
  const writer = useCalendarSave();
  const { direction } = useLocale();
  const [refused, setRefused] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const name = isolate(cover.className ?? '');
  const write = (event: () => RecordEvent) => {
    let made;
    try {
      made = event();
    } catch {
      setRefused(true);
      return;
    }
    setRefused(false);
    void writer.save(made, data.state);
  };
  return (
    <View testID={`cover-${cover.id}`} style={styles.card}>
      <View accessible style={styles.about}>
        <View style={[styles.meta, { direction }]}>
          <Badge label={t('special.kinds.cover')} />
          <Text style={[styles.sub, align]}>{[bookSpan(t, cover, direction), name].join(' · ')}</Text>
        </View>
        <Text style={[styles.body, align]}>{t('special.notes.cover', { class: name })}</Text>
      </View>
      {cover.done === true ? (
        <Text testID={`cover-written-${cover.id}`} style={[styles.sub, align]}>
          {t('special.written')}
        </Text>
      ) : (
        <Button
          testID={`cover-done-${cover.id}`}
          label={t('special.done')}
          variant="soft"
          disabled={writer.busy}
          onPress={() => write(() => setDuty(coreContext(data), { ...cover, done: true }))}
        />
      )}
      {confirming ? (
        <>
          <Button
            testID={`cover-confirm-${cover.id}`}
            label={t('special.confirmRemove')}
            variant="danger"
            disabled={writer.busy}
            onPress={() => write(() => ({ kind: 'duty.removed', id: cover.id }))}
          />
          <Button
            testID={`cover-keep-${cover.id}`}
            label={t('special.keep')}
            variant="plain"
            onPress={() => setConfirming(false)}
          />
        </>
      ) : (
        <Button
          testID={`cover-remove-${cover.id}`}
          label={t('special.remove')}
          variant="plain"
          disabled={writer.busy}
          onPress={() => setConfirming(true)}
        />
      )}
      <SaveProblem testID={`cover-failed-${cover.id}`} problem={refused ? 'failed' : writer.problem} />
    </View>
  );
}

/** The day's covers at the schools that take one, as the journal prints them. */
export function CoverCards({ state, day }: { state: State; day: Day }) {
  const schools = new Set(coverSchools(state).map((school) => school.id));
  return coversOn(state, day)
    .filter((cover) => schools.has(cover.schoolId ?? ''))
    .map((cover) => <CoverCard key={cover.id} cover={cover} />);
}
