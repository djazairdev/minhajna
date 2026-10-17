// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today (#32, Main and Today-done): the day's sessions in order. The next
// session awaiting confirmation is the focus card, with the plan's proposal
// in pencil and the one tap that records it; the others show their lesson,
// and a recorded session shows what it wrote. Nothing is recorded until the
// teacher taps (PRD §2.3), and the tap can be undone at once: the history
// keeps both changes (PRD §4.7). The other outcomes and the session's
// details come with their own screens.

import {
  confirmSessions,
  courseSetup,
  current,
  formatDayWithMonth,
  refOf,
  todayView,
  weekday,
  type RecordEvent,
  type TodaySession,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components/IconButton';
import { PageHeading } from '../components/PageHeading';
import { SessionCard, type SessionMeta } from '../components/SessionCard';
import { Snackbar } from '../components/Snackbar';
import { controlIcon } from '../design/Icon';
import { colors, spacing } from '../design/tokens';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { sessionTime } from '../times/times-rules';
import { slotSpoken } from '../week/grid-labels';
import { dayFacts, lessonOf, proposalOf, writtenOf } from './today-labels';

/** The tap just made, and the event that undoes it. */
type Done = { readonly key: string; readonly undo: RecordEvent };

/** The Today tab; `onHelp` opens Help and the privacy notice. */
export function Today({ onHelp }: { onHelp: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, packs, bells, today, record, recordAll } = useAppData();
  const [done, setDone] = useState<Done | null>(null);
  const day = today();
  const language = currentLanguage();
  const comma = language === 'ar' ? '، ' : ', ';
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const view = useMemo(() => todayView(context, day), [context, day]);
  const focus = view.sessions.find((item) => item.status === 'awaiting' && item.proposal !== null);

  const metaOf = (item: TodaySession, withSubject: boolean): SessionMeta => {
    const schoolClass = state.classes.get(item.course.classId);
    const group = schoolClass?.groups.find((candidate) => candidate.id === item.session.groupId);
    const className = [schoolClass?.name ?? '', group !== undefined && group.kind !== 'whole' ? group.name : null]
      .filter(Boolean)
      .join(' · ');
    const school = schoolClass && state.schools.get(schoolClass.schoolId);
    const time = sessionTime({ bells, calendar, state }, school, item.session.slot, item.session.day);
    const subject = profile.subjects.find((candidate) => candidate.code === item.course.subject);
    return {
      className,
      slot: time === null ? slotSpoken(t, item.session.slot) : span(time.from, time.to, direction),
      ...(withSubject && { subject: subject ? localized(subject.name) : item.course.subject }),
    };
  };

  const confirm = (item: TodaySession) => {
    const before = current(state.sessions.get(item.session.key));
    const undo: RecordEvent =
      before === null
        ? { kind: 'session.withdrawn', session: refOf(item.session) }
        : { kind: 'session.recorded', record: before };
    recordAll(confirmSessions(context, [{ session: item.session }]));
    setDone({ key: item.session.key, undo });
  };

  const card = (item: TodaySession) => {
    const key = item.session.key;
    const testID = `today-${key}`;
    const pack = courseSetup(context, item.course.id).pack;
    if (item.status === 'recorded' && item.record !== null) {
      return (
        <SessionCard
          key={key}
          testID={testID}
          kind="done"
          meta={metaOf(item, true)}
          written={writtenOf(t, pack, item.record, comma)}
          where={t('today.recorded')}
        />
      );
    }
    if (item.status === 'calendar') {
      const entry = view.marks.find((mark) => mark.id === item.session.calendarEntry);
      const lesson =
        entry !== undefined ? localized(entry.name) : t(`today.calendar.${item.session.calendar ?? 'holiday'}`);
      return <SessionCard key={key} testID={testID} kind="mini" meta={metaOf(item, false)} lesson={lesson} />;
    }
    if (item === focus && item.proposal !== null) {
      return (
        <SessionCard
          key={key}
          testID={testID}
          kind="focus"
          meta={metaOf(item, true)}
          proposal={proposalOf(t, pack, item.proposal)}
          confirm={t('today.confirm')}
          onConfirm={() => confirm(item)}
        />
      );
    }
    return <SessionCard key={key} testID={testID} kind="mini" meta={metaOf(item, false)} {...lessonOf(t, item)} />;
  };

  return (
    <View style={[styles.screen, { direction, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: done === null ? 0 : 96 },
        ]}
      >
        <PageHeading
          testID="today-heading"
          title={t(`week.days.${weekday(day)}`)}
          scope={formatDayWithMonth(day, language, profile)}
          fact={{ text: dayFacts(t, view), icon: controlIcon('check') }}
          actions={
            <IconButton
              testID="today-help"
              icon={controlIcon('info')}
              accessibilityLabel={t('today.help')}
              onPress={onHelp}
            />
          }
        />
        <View style={styles.list}>{view.sessions.map(card)}</View>
      </ScrollView>
      {done !== null && (
        <Snackbar
          testID="today-snack"
          message={t('today.snack')}
          undoLabel={t('today.undo')}
          bottomOffset={0}
          onUndo={() => {
            record(done.undo);
            setDone(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: spacing['space-16'] },
  list: { gap: spacing['space-10'], paddingHorizontal: spacing['space-16'], paddingBottom: spacing['space-16'] },
});
