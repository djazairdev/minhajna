// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «درس آخر لهذه الحصة» (#34, Entry-lesson): a search over the class's plan,
// each queue around the class's position, and content from outside the
// plan. Choosing costs no more than confirming the proposal (PRD §2.3): one
// row, then «اختيار درس من القائمة». What is chosen is written in the book
// instead of the proposal, which stays first in its queue. Nothing is
// recorded here; the entry's «تأكيد الحصة» records it.

import type { Proposal } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState, type RefObject } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { OptionRow } from '../components/OptionRow';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import type { Lesson, LessonGroup, LessonRow } from './lesson-rules';

export interface LessonSheetProps {
  readonly visible: boolean;
  /** Such as «4م2 · 08:00 – 09:00 · المقترح: …». */
  readonly context: string;
  readonly className: string;
  readonly proposal: Proposal;
  readonly lesson: Lesson;
  readonly groups: (query: string) => readonly LessonGroup[];
  readonly dayName: (day: NonNullable<LessonRow['day']>) => string;
  /** Where the proposal goes, such as «الأحد 11/10», or null when no later session is known. */
  readonly nextDay: string | null;
  readonly onChoose: (lesson: Lesson) => void;
  readonly onClose: () => void;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
}

export function LessonSheet(props: LessonSheetProps) {
  const { proposal, dayName } = props;
  const { direction } = useLocale();
  const t = useText();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Lesson | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const close = () => {
    setQuery('');
    setChosen(null);
    props.onClose();
  };
  const current = chosen ?? props.lesson;
  const isChosen = (row: LessonRow) =>
    row.status === 'proposed'
      ? current.kind === 'proposed'
      : current.kind === 'item' && current.item.id === row.item.id;
  const sub = (row: LessonRow, first: boolean) => {
    if (row.status === 'proposed') return t('lesson.proposed');
    if (row.day === null) return undefined;
    if (row.status === 'taught') return t('lesson.taught', { day: dayName(row.day) });
    return first ? t('lesson.next', { day: dayName(row.day) }) : dayName(row.day);
  };
  const rows = (list: readonly LessonRow[]) => {
    const next = list.findIndex((row) => row.status === 'open');
    return list.map((row, index) => (
      <OptionRow
        key={row.item.id}
        testID={`lesson-${row.item.id}`}
        label={row.item.title}
        sub={sub(row, index === next)}
        selected={isChosen(row)}
        onPress={() =>
          setChosen(
            row.status === 'proposed'
              ? { kind: 'proposed' }
              : { kind: 'item', item: row.item, taught: row.status === 'taught' },
          )
        }
      />
    ));
  };
  const item = proposal.item.title;

  return (
    <BottomSheet
      testID="lesson-sheet"
      visible={props.visible}
      title={t('lesson.title')}
      context={props.context}
      reassurance={
        props.nextDay === null ? t('lesson.keptNext', { item }) : t('lesson.kept', { item, day: props.nextDay })
      }
      returnFocusRef={props.returnFocusRef}
      onClose={close}
    >
      <TextField
        testID="lesson-search"
        label={t('lesson.search', { name: props.className })}
        placeholder={t('lesson.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
      />
      {props.groups(query).map((group) => (
        <View key={group.queue} style={styles.group}>
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t(group.queue === 'td' ? 'lesson.td' : 'lesson.main')}
          </Text>
          {rows(group.taught)}
          {group.taught.length > 0 && group.ahead.length > 0 && (
            <Text style={[styles.position, align]}>{t('lesson.position')}</Text>
          )}
          {rows(group.ahead)}
        </View>
      ))}
      <OptionRow
        testID="lesson-unplanned"
        label={t('entry.unplanned')}
        sub={t('entry.unplannedPlaceholder')}
        selected={current.kind === 'unplanned'}
        onPress={() => setChosen({ kind: 'unplanned' })}
      />
      <Button
        testID="lesson-choose"
        label={t('lesson.choose')}
        disabled={chosen === null}
        onPress={() => {
          if (chosen !== null) props.onChoose(chosen);
          close();
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-4'] },
  label: { ...typography.label, color: colors.ink },
  position: {
    ...typography.caption,
    color: colors.ink2,
    paddingVertical: spacing['space-4'],
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.rule,
  },
});
