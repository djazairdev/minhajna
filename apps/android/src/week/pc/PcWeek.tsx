// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الأسبوع» on a PC (#251, Web-week, answers 526 and 527): the week's days
// across, in the reading direction, and its slots down, each row timed by its
// first session; every session in its cell, its class on its subject colour and
// its lesson, in ink once recorded, in pencil, dashed, while proposed, and
// muted when the calendar takes it, so its state never rests on colour alone.
// Above, the week's dates, how many sessions it holds and how many are
// confirmed, the weeks before and after, within the school year, and, on the
// current week, the week's print set, which holds what is new since its last
// print. Today's column says so. The sessions are one group of choices; the one
// chosen shows in the side pane, where it is confirmed or corrected as on
// Today, with Today's sheet for another outcome and «تراجع» after, and the week
// opens on the first one still to confirm, else on the next one held, as it
// does again when the one chosen is gone. The phone keeps Today.

import {
  addDays,
  slotKey,
  startOfWeek,
  weekCell,
  weekView,
  type TodaySession,
  type TodayView,
  type WeekView,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Button } from '../../components/Button';
import { Snackbar } from '../../components/Snackbar';
import { IconButton } from '../../components/IconButton';
import { controlIcon } from '../../design/Icon';
import { fontFamilyForWeight } from '../../design/fonts';
import { colors, fontFamilies, radius, spacing, typography } from '../../design/tokens';
import { coreContext } from '../../storage/core-context';
import { useAppData } from '../../storage/AppData';
import { useDeviceText } from '../../text/device-text';
import { currentLanguage } from '../../text/i18n';
import { useTodayActions } from '../../today/today-actions';
import { dayHead, rowLabel, sessionText, weekTitle, type WeekWords } from './week-labels';
import { isolate } from '../grid-labels';
import { WeekOutcome } from './WeekOutcome';
import { WeekPane } from './WeekPane';

/** The session the week opens on: the first still to confirm up to today, else the next held, else the first. */
function openingKey(week: WeekView, today: string): string | null {
  const sessions = week.days.flatMap((view) => view.sessions);
  const held = sessions.filter((item) => item.status !== 'calendar');
  const open = held.find((item) => item.status === 'awaiting' && item.session.day <= today);
  return (open ?? held.find((item) => item.session.day >= today) ?? held[0] ?? sessions[0])?.session.key ?? null;
}

export type PcWeekProps = {
  readonly onPrint: () => void;
  /** Opens a course's texts book on a session's page. */
  readonly onBook: (courseId: string, sessionKey: string) => void;
  readonly onNote: (session: TodaySession['session']) => void;
};

export function PcWeek({ onPrint, onBook, onNote }: PcWeekProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const data = useAppData();
  const { profile, year, calendar, calendarRelease, packs, state, bells } = data;
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const today = data.today();
  const { done, confirm, keepReason, undo } = useTodayActions(context, t, data.record, data.recordAll);
  const [sheet, setSheet] = useState<{ view: TodayView; item: TodaySession; open: boolean } | null>(null);
  const other = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState(today);
  const week = useMemo(() => weekView(context, anchor), [context, anchor]);
  const [chosen, setChosen] = useState<{ week: string; key: string | null } | null>(null);
  const keys = new Set(week.days.flatMap((view) => view.sessions.map((item) => item.session.key)));
  const selected =
    chosen?.week === week.start && chosen.key !== null && keys.has(chosen.key) ? chosen.key : openingKey(week, today);
  const thisWeek = week.start === startOfWeek(today, profile.weekStartsOn);
  const words: WeekWords = {
    data: { state, profile, bells, calendar },
    context,
    t,
    direction,
    language: currentLanguage(),
    today,
  };
  const found = week.days
    .flatMap((view) => view.sessions.map((item) => ({ view, item })))
    .find((one) => one.item.session.key === selected);
  const move = (days: number) => setAnchor(addDays(week.start, days));
  const card = (view: (typeof week.days)[number], item: TodaySession) => {
    const text = sessionText(words, view, item);
    const on = item.session.key === selected;
    return (
      <Pressable
        key={item.session.key}
        testID={`week-cell-${item.session.key}`}
        accessibilityRole="radio"
        accessibilityLabel={t('pcWeek.cellName', {
          day: dayHead(t, view.day, today),
          time: text.time,
          class: isolate(text.className),
          lesson: isolate(text.lesson),
          state: text.state,
        })}
        aria-checked={on}
        onPress={() => setChosen({ week: week.start, key: item.session.key })}
        style={[styles.session, styles[text.kind], on && styles.on]}
      >
        <Text style={styles.chip}>{text.className}</Text>
        <Text numberOfLines={3} style={[styles.lesson, text.kind !== 'recorded' && styles.pencilText, align]}>
          {text.lesson}
        </Text>
      </Pressable>
    );
  };
  return (
    <View testID="pc-week" style={[styles.screen, { direction }]}>
      <View style={styles.frame}>
        <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
          <View style={styles.head}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={[styles.title, align]}>
                {weekTitle(words, week)}
              </Text>
              <Text style={[styles.summary, align]}>
                {week.held === 0
                  ? t('pcWeek.none')
                  : t('pcWeek.summary', {
                      sessions: t('count.sessions', { count: week.held }),
                      recorded: week.recorded,
                    })}
              </Text>
            </View>
            <View style={styles.flip}>
              <IconButton
                testID="week-before"
                icon={controlIcon('chevron')}
                accessibilityLabel={t('pcWeek.before')}
                disabled={week.start <= year.from}
                onPress={() => move(-7)}
              />
            </View>
            <IconButton
              testID="week-after"
              icon={controlIcon('chevron')}
              accessibilityLabel={t('pcWeek.after')}
              disabled={addDays(week.start, 6) >= year.to}
              onPress={() => move(7)}
            />
            {thisWeek && <Button testID="week-print" variant="line" label={t('pcWeek.print')} onPress={onPrint} />}
          </View>
          <View style={styles.row} importantForAccessibility="no-hide-descendants">
            <View style={styles.slotColumn} />
            {week.days.map((view) => (
              <Text key={view.day} style={[styles.dayHead, view.day === today && styles.todayHead]}>
                {dayHead(t, view.day, today)}
              </Text>
            ))}
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={weekTitle(words, week)} style={styles.rows}>
            {week.slots.map((slot) => (
              <View key={slotKey(slot)} style={styles.row}>
                <Text importantForAccessibility="no" style={[styles.slotColumn, styles.slot]}>
                  {rowLabel(words, week, slot)}
                </Text>
                {week.days.map((view) => {
                  const items = weekCell(view, slot);
                  return (
                    <View key={view.day} style={[styles.cell, items.length === 0 && styles.empty]}>
                      {items.map((item) => card(view, item))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
        <WeekPane
          key={selected ?? 'none'}
          words={words}
          view={found?.view ?? null}
          item={found?.item ?? null}
          actions={{
            onConfirm: (item) => confirm(item),
            onOther: (item) => found !== undefined && setSheet({ view: found.view, item, open: true }),
            onBook: (item) => onBook(item.course.id, item.session.key),
            onNote: (item) => onNote(item.session),
            onOpen: (item) => setChosen({ week: week.start, key: item.session.key }),
          }}
          otherRef={other}
        />
      </View>
      {sheet !== null && (
        <WeekOutcome
          words={words}
          view={sheet.view}
          item={sheet.item}
          visible={sheet.open}
          returnFocusRef={other}
          onClose={() => setSheet({ ...sheet, open: false })}
          onChoose={(choice) => confirm(sheet.item, choice)}
          onReason={(reason, text) => keepReason(sheet.item, reason, text)}
        />
      )}
      {done !== null && (
        <Snackbar
          testID="week-snack"
          message={done.message}
          undoLabel={t('today.undo')}
          bottomOffset={0}
          onUndo={undo}
        />
      )}
    </View>
  );
}

const bold = fontFamilyForWeight(fontFamilies.arabic, '700');

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  frame: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },
  mainContent: { gap: spacing['space-6'], padding: spacing['space-20'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], marginBottom: spacing['space-6'] },
  heading: { flex: 1 },
  title: { ...typography['web-heading'], color: colors.ink },
  summary: { ...typography.caption, color: colors.ink2 },
  flip: { transform: [{ scaleX: -1 }] },
  rows: { gap: spacing['space-6'] },
  row: { flexDirection: 'row', gap: spacing['space-6'] },
  slotColumn: { width: 88 },
  dayHead: {
    ...typography.caption,
    flex: 1,
    textAlign: 'center',
    color: colors.ink2,
    fontFamily: bold,
    fontWeight: '700',
  },
  todayHead: { color: colors.ink },
  slot: { ...typography['grid-head'], alignSelf: 'center', textAlign: 'center', color: colors.ink2 },
  cell: { flex: 1, minHeight: 88, gap: spacing['space-4'] },
  empty: { borderRadius: radius['radius-card'], borderWidth: 1, borderColor: colors.line },
  session: {
    flexGrow: 1,
    alignItems: 'flex-start',
    gap: spacing['space-3'],
    padding: spacing['space-6'],
    borderRadius: radius['radius-card'],
    borderWidth: 1.5,
  },
  recorded: { backgroundColor: colors.sheet, borderColor: colors.rule },
  pencil: { borderStyle: 'dashed', borderColor: colors['pencil-edge'] },
  calendar: { backgroundColor: colors.soft, borderColor: colors.soft },
  on: { borderColor: colors.board, borderWidth: 2.5, borderStyle: 'solid' },
  chip: {
    ...typography['class-chip'],
    fontSize: 12.5,
    color: colors['on-subject'],
    backgroundColor: colors.subject,
    borderRadius: 6,
    paddingHorizontal: spacing['space-6'],
    paddingVertical: spacing['space-3'],
  },
  lesson: { ...typography.badge, fontSize: 12.5, color: colors.ink },
  pencilText: { color: colors.pencil },
});
