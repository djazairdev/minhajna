// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The two counts for homework that came back (#214, P67, R-3.8-20 to 23):
// pupils who did not do it and pupils who relied on someone else, one stepper
// each, with the share of the class list under each, rounded to a whole number.
// A pupil is counted once at most, so the two together never pass the list.
// «الجميع أنجزه بنفسه» records none of either at once. Class counts only, never
// names. With no class list there is nothing to count against, and the panel
// says so. Counts kept from a longer list start at what the list now allows.
// Before any count is saved, the homework taps of the session it came back in
// fill the steppers, said as theirs, as they stood when the panel opened;
// they are written only when the teacher confirms (#239, R-3.8-24).

import { homeworkPercent, type HomeworkItem } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Stepper } from '../components/Stepper';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

export interface HomeworkCounterProps {
  readonly item: HomeworkItem;
  /** The two column names, in the page's words. */
  readonly names: { readonly notDone: string; readonly reliedOn: string };
  readonly onCount: (notDone: number, reliedOn: number) => void;
  /** The counts the session's homework taps propose, used only while none is saved. */
  readonly proposed?: { readonly notDone: number; readonly reliedOn: number } | null;
}

export function HomeworkCounter({ item, names, onCount, proposed = null }: HomeworkCounterProps) {
  const t = useText();
  const { direction } = useLocale();
  const [seed] = useState(() => {
    const start = item.count ?? proposed;
    const notDone = Math.min(start?.notDone ?? 0, item.listed);
    const reliedOn = Math.min(start?.reliedOn ?? 0, item.listed - notDone);
    return { notDone, reliedOn, fromTaps: item.count === null && proposed !== null };
  });
  const [notDone, setNotDone] = useState(seed.notDone);
  const [reliedOn, setReliedOn] = useState(seed.reliedOn);
  const key = item.session.key;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (item.listed === 0) {
    return (
      <View testID={`homework-counter-${key}`} style={styles.panel}>
        <Text style={[styles.note, align]}>{t('homework.noList')}</Text>
      </View>
    );
  }
  const unit = t('homework.of', { count: item.listed });
  const one = (id: 'notDone' | 'reliedOn', value: number, other: number, set: (value: number) => void) => (
    <View style={styles.one}>
      <Text style={styles.name} importantForAccessibility="no">
        {names[id]}
      </Text>
      <Stepper
        testID={`homework-${id}`}
        label={names[id]}
        unit={unit}
        value={value}
        min={0}
        max={item.listed - other}
        onValueChange={set}
        decreaseLabel={t('homework.less', { name: names[id] })}
        increaseLabel={t('homework.more', { name: names[id] })}
      />
      <Text testID={`homework-${id}-share`} style={styles.share}>
        {t('homework.share', { percent: homeworkPercent(value, item.listed) })}
      </Text>
    </View>
  );
  const unchanged = item.count !== null && item.count.notDone === notDone && item.count.reliedOn === reliedOn;
  return (
    <View testID={`homework-counter-${key}`} style={styles.panel}>
      <Text style={[styles.title, align]}>{t('homework.counting', { text: isolate(item.text) })}</Text>
      {item.count === null && seed.fromTaps && (
        <Text testID="homework-proposed" style={[styles.note, align]}>
          {t('homework.proposed', { notDone: seed.notDone, reliedOn: seed.reliedOn })}
        </Text>
      )}
      <View style={styles.steppers}>
        {one('notDone', notDone, reliedOn, setNotDone)}
        {one('reliedOn', reliedOn, notDone, setReliedOn)}
      </View>
      <View style={styles.buttons}>
        <View style={styles.half}>
          <Button
            testID="homework-none"
            variant="line"
            label={t('homework.allDid')}
            onPress={() => {
              setNotDone(0);
              setReliedOn(0);
              onCount(0, 0);
            }}
          />
        </View>
        <View style={styles.half}>
          <Button
            testID="homework-confirm"
            label={t('homework.confirm')}
            disabled={unchanged}
            onPress={() => onCount(notDone, reliedOn)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing['space-12'],
    padding: spacing['space-12'],
    margin: spacing['space-8'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.paper,
  },
  title: { ...typography.label, color: colors.pencil },
  note: { ...typography.body, color: colors.pencil },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-12'], justifyContent: 'center' },
  one: { alignItems: 'center', gap: spacing['space-4'], flexBasis: 140, flexGrow: 1 },
  name: { ...typography.label, color: colors.ink, textAlign: 'center' },
  share: { ...typography.body, color: colors.ink, textAlign: 'center' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  half: { flexGrow: 1, flexBasis: 140 },
});
