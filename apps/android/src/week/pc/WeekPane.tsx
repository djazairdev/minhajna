// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC week's side pane (#251, Web-week, answer 526): the selected session,
// its class, day and time, its lesson, where a continued one goes on from, and
// its state. A session still to confirm shows what the plan proposes, in
// pencil as on Today, and, up to today, Today's choices: done as proposed,
// another outcome, and its details; a later one keeps its proposal only, as
// on Today. A recorded one says it can be corrected later with its first
// version kept, then «تصحيح الحصة» and «صفحة الدفتر». The details and the
// correction open the session's own screen in the pane, with a way back to
// the session, and keep that session chosen while they are open. Before any
// session is chosen, it says to choose one.

import { courseSetup, type TodaySession, type TodayView } from '@minhajna/core';
import { useState, type RefObject } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Button } from '../../components/Button';
import { Proposal } from '../../components/Proposal';
import { fontFamilyForWeight } from '../../design/fonts';
import { colors, fontFamilies, sizes, spacing, typography } from '../../design/tokens';
import { Entry } from '../../entry/Entry';
import { dayName } from '../../today/DayMark';
import { proposalOf } from '../../today/today-labels';
import { isolate } from '../grid-labels';
import { sessionText, type WeekWords } from './week-labels';

export type WeekPaneActions = {
  readonly onConfirm: (item: TodaySession) => void;
  readonly onOther: (item: TodaySession) => void;
  /** Opens the texts book on the session's page. */
  readonly onBook: (item: TodaySession) => void;
  readonly onNote: (item: TodaySession) => void;
  /** Keeps the session chosen while its screen is open in the pane. */
  readonly onOpen: (item: TodaySession) => void;
};

export type WeekPaneProps = {
  readonly words: WeekWords;
  readonly view: TodayView | null;
  readonly item: TodaySession | null;
  readonly actions: WeekPaneActions;
  /** Where the focus goes back once the outcome sheet closes. */
  readonly otherRef: RefObject<ViewInstance | null>;
};

export function WeekPane({ words, view, item, actions, otherRef }: WeekPaneProps) {
  const { t, direction, language, data, context } = words;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [open, setOpen] = useState(false);
  if (view !== null && item !== null && open) {
    return (
      <View testID="week-pane" style={[styles.pane, styles.entry, { direction }]}>
        <Button testID="week-pane-back" variant="plain" label={t('pcWeek.back')} onPress={() => setOpen(false)} />
        <Entry
          sessionKey={item.session.key}
          day={item.session.day}
          onDone={() => setOpen(false)}
          onNote={() => actions.onNote(item)}
        />
      </View>
    );
  }
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
  const due = item.status === 'awaiting' && item.session.day <= words.today;
  const openHere = () => {
    actions.onOpen(item);
    setOpen(true);
  };
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
      {due && item.proposal !== null && (
        <>
          <Button testID="week-pane-confirm" label={t('today.confirm')} onPress={() => actions.onConfirm(item)} />
          <View ref={otherRef} collapsable={false}>
            <Button
              testID="week-pane-other"
              variant="line"
              label={t('outcome.other')}
              onPress={() => actions.onOther(item)}
            />
          </View>
        </>
      )}
      {due && <Button testID="week-pane-details" variant="line" label={t('entry.open')} onPress={openHere} />}
      {item.status === 'recorded' && (
        <>
          <Text style={[styles.note, align]}>{t('pcWeek.fixNote')}</Text>
          <Button testID="week-pane-fix" variant="line" label={t('pcWeek.fix')} onPress={openHere} />
          <Button
            testID="week-pane-book"
            variant="line"
            label={t('pcWeek.bookPage')}
            onPress={() => actions.onBook(item)}
          />
        </>
      )}
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
  entry: { padding: 0, paddingTop: spacing['space-8'] },
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
