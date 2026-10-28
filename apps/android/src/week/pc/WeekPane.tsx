// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC week's side pane (#251, Web-week, answer 526): the selected session,
// its class, day and time, its lesson, where a continued one goes on from, and
// its state; for a session still to confirm, what the plan proposes, in pencil
// as on Today; for a recorded one, that it can be corrected later with its
// first version kept. Before any session is chosen, it says to choose one.

import { courseSetup, type TodaySession, type TodayView } from '@minhajna/core';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Proposal } from '../../components/Proposal';
import { fontFamilyForWeight } from '../../design/fonts';
import { colors, fontFamilies, sizes, spacing, typography } from '../../design/tokens';
import { dayName } from '../../today/DayMark';
import { proposalOf } from '../../today/today-labels';
import { isolate } from '../grid-labels';
import { sessionText, type WeekWords } from './week-labels';

export type WeekPaneProps = {
  readonly words: WeekWords;
  readonly view: TodayView | null;
  readonly item: TodaySession | null;
};

export function WeekPane({ words, view, item }: WeekPaneProps) {
  const { t, direction, language, data, context } = words;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (view === null || item === null) {
    return (
      <View testID="week-pane" style={[styles.pane, { direction }]}>
        <Text style={[styles.note, align]}>{t('pcWeek.pick')}</Text>
      </View>
    );
  }
  const text = sessionText(words, view, item);
  const day = dayName(t, item.session.day, language, data.profile);
  const pack = courseSetup(context, item.course.id).pack;
  return (
    <ScrollView testID="week-pane" style={[styles.pane, { direction }]} contentContainerStyle={styles.content}>
      <Text style={[styles.meta, align]}>
        {t('pcWeek.meta', { class: isolate(text.className), day, time: text.time })}
      </Text>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {text.lesson}
      </Text>
      {text.note !== undefined && <Text style={[styles.note, align]}>{text.note}</Text>}
      <Text testID="week-pane-state" style={[styles.state, align]}>
        {text.state}
      </Text>
      {item.status === 'awaiting' && item.proposal !== null && (
        <Proposal testID="week-pane-proposal" {...proposalOf(t, pack, item.proposal)} />
      )}
      {item.status === 'recorded' && <Text style={[styles.note, align]}>{t('pcWeek.fixNote')}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pane: {
    width: sizes['web-detail'],
    flexGrow: 0,
    backgroundColor: colors.sheet,
    borderStartWidth: 1,
    borderColor: colors.line,
    padding: spacing['space-16'],
  },
  content: { gap: spacing['space-12'] },
  meta: { ...typography.caption, color: colors.ink2 },
  title: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 18 * 1.5,
    fontWeight: '700',
    fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'),
    color: colors.ink,
  },
  state: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
