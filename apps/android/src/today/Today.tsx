// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today (#32, Main and Today-done): the day's sessions in order. The next
// session awaiting confirmation is the focus card, with the plan's proposal
// in pencil and the one tap that records it; the others show their lesson,
// and a recorded session shows what it wrote. Nothing is recorded until the
// teacher taps (PRD §2.3), and the tap can be undone at once: the history
// keeps both changes (PRD §4.7). «نتيجة أخرى» records any other outcome in
// a second tap (#33); today-actions.ts records the taps and their undo. The
// session's details come with their own screen.
// Earlier sessions still awaiting confirmation come first, a week at a
// time, to confirm at once but for the ones left out (#35).
// A holiday, a closure or an exam week shows its name, the sessions it
// took, counted apart, and the next session (#36). Every session card
// carries its roll call, whatever its kind (#184), and the backlog a past
// one's from the paper sheet (#38). A joint class's years share one card for
// each slot, each on its own plan (#43, P-Multi).

import {
  addDays,
  backlogOf,
  carryTo,
  courseGrade,
  courseSetup,
  formatDayWithMonth,
  nextSession,
  todayView,
  weekday,
  type HomeworkItem,
  type Session,
  type TodaySession,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components/IconButton';
import { PageHeading } from '../components/PageHeading';
import { JointCard, type JointYear } from './JointCard';
import { SessionCard } from '../components/SessionCard';
import { Snackbar } from '../components/Snackbar';
import { controlIcon } from '../design/Icon';
import { colors, spacing } from '../design/tokens';
import { localized, yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { Backlog } from './Backlog';
import { DayBanner, DayNote, NextSession, dayMarkOf, dayName, markLine } from './DayMark';
import { carryWords, nextItem, previousItem } from './outcome-rules';
import { OutcomeSheet } from './OutcomeSheet';
import { PaperRolls } from './PaperRolls';
import { dueStrips } from '../homework/homework-strip';
import { dayFacts, lessonOf, proposalOf, writtenOf } from './today-labels';
import { todayEntries } from './joint-today';
import { useTodayActions } from './today-actions';
import { sessionMeta } from './today-meta';

/** The session «نتيجة أخرى» was opened for, kept while the sheet closes. */
type Sheet = { readonly item: TodaySession; readonly open: boolean; readonly backlog?: true };

const sessionsOf = (items: readonly TodaySession[]) => items.map((item) => item.session);

/** The Today tab; `onHelp` opens Help and the privacy notice, `onExtra` a session outside the timetable, `onDetails` a session's details, `onRoll` its roll call, `onHomework` the homework that comes back. */
export function Today(props: {
  onHelp: () => void;
  onExtra?: () => void;
  onDetails: (session: Session) => void;
  onRoll: (session: Session) => void;
  onHomework?: (item: HomeworkItem) => void;
}) {
  const { onHelp, onDetails, onRoll, onExtra, onHomework = () => undefined } = props;
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, packs, bells, today, record, recordAll } = useAppData();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const other = useRef<ViewInstance>(null);
  const backlogOther = useRef<ViewInstance>(null);
  const day = today();
  const language = currentLanguage();
  const comma = language === 'ar' ? '، ' : ', ';
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const view = useMemo(() => todayView(context, day), [context, day]);
  const backlog = useMemo(() => backlogOf(context, day), [context, day]);
  const mark = dayMarkOf(view);
  const shown = mark === null ? view.sessions : view.sessions.filter((item) => item.status !== 'calendar');
  const taken = view.sessions.length - shown.length;
  const next = useMemo(
    () => (mark === null || shown.length > 0 ? null : nextSession(context, day)),
    [context, day, mark, shown.length],
  );
  const focus = view.sessions.find((item) => item.status === 'awaiting' && item.proposal !== null);

  const { done, confirm, confirmAll, keepReason, undo } = useTodayActions(context, t, record, recordAll);

  const metaOf = (item: TodaySession, withSubject: boolean) =>
    sessionMeta({ state, profile, bells, calendar }, t, direction, item, withSubject);

  const nextLine = (session: Session) => {
    const course = state.courses.get(session.courseId);
    const meta =
      course &&
      metaOf({ session, course, status: 'awaiting', proposal: null, record: null, packMissing: false }, false);
    return [meta?.className, meta?.slot, dayName(t, session.day, language, profile)].filter(Boolean).join(' · ');
  };

  const card = (item: TodaySession) => {
    const key = item.session.key;
    const testID = `today-${key}`;
    const pack = courseSetup(context, item.course.id).pack;
    const due = dueStrips(t, context, [item.session], onRoll, onHomework);
    if (item.status === 'recorded' && item.record !== null) {
      return (
        <SessionCard
          key={key}
          testID={testID}
          kind="done"
          meta={metaOf(item, true)}
          written={writtenOf(t, pack, item.record, comma)}
          where={t('today.recorded')}
          show={{ id: 'fix', label: t('fix.open'), onPress: () => onDetails(item.session) }}
          due={due}
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
          due={due}
          confirm={t('today.confirm')}
          onConfirm={() => confirm(item)}
          more={[
            { id: 'other', label: t('outcome.other'), onPress: () => setSheet({ item, open: true }), ref: other },
            { id: 'details', label: t('entry.open'), onPress: () => onDetails(item.session) },
          ]}
        />
      );
    }
    const lesson = lessonOf(t, item);
    return <SessionCard key={key} testID={testID} kind="mini" meta={metaOf(item, false)} {...lesson} due={due} />;
  };

  const jointCard = (key: string, items: readonly TodaySession[]) => {
    const schoolClass = state.classes.get(items[0]?.course.classId ?? '');
    const first = items[0];
    if (schoolClass === undefined || first === undefined) return null;
    const ready = items.filter((item) => item.status === 'awaiting' && item.proposal !== null);
    const onFocus = focus !== undefined && items.includes(focus);
    const years = items.map((item): JointYear => {
      const grade = courseGrade(item.course, schoolClass);
      const pack = courseSetup(context, item.course.id).pack;
      const head = { id: grade, badge: grade.replace(/\D/g, ''), name: yearShort(t, grade) };
      if (item.status === 'recorded' && item.record !== null) {
        const show = { id: `fix-${grade}`, label: t('fix.open'), onPress: () => onDetails(item.session) };
        return { ...head, kind: 'done', written: writtenOf(t, pack, item.record, comma), show };
      }
      if (onFocus && item.proposal !== null && ready.includes(item)) {
        const proposal = proposalOf(t, pack, item.proposal);
        return { ...head, kind: 'proposal', proposal, onConfirm: () => confirm(item), hint: t('joint.alone') };
      }
      const show = { id: `details-${grade}`, label: t('entry.open'), onPress: () => onDetails(item.session) };
      return { ...head, kind: 'lesson', lesson: lessonOf(t, item).lesson, ...(onFocus && { show }) };
    });
    return (
      <JointCard
        key={key}
        testID={`today-${key}`}
        meta={{ ...metaOf(first, true), className: schoolClass.name }}
        years={years}
        due={dueStrips(t, context, sessionsOf(items), onRoll, onHomework)}
        {...(onFocus && {
          confirm: {
            label: t('joint.confirm', { count: ready.length }),
            note: t('joint.confirmNote'),
            onConfirm: () => confirmAll(ready, key),
          },
        })}
      />
    );
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
          fact={{ text: dayFacts(t, view, mark !== null), icon: controlIcon('check') }}
          actions={
            <>
              {onExtra !== undefined && (
                <IconButton
                  testID="today-extra"
                  icon={controlIcon('plus')}
                  accessibilityLabel={t('extra.open')}
                  onPress={onExtra}
                />
              )}
              <IconButton
                testID="today-help"
                icon={controlIcon('info')}
                accessibilityLabel={t('today.help')}
                onPress={onHelp}
              />
            </>
          }
        />
        <View style={styles.list}>
          {mark !== null && <DayBanner entry={mark} line={markLine(t, mark, day, language, profile)} />}
          {backlog.days.length > 0 && (
            <Backlog
              days={backlog.days.map((one) => ({
                title: `${t(`week.days.${weekday(one.day)}`)} ${formatDayWithMonth(one.day, language, profile)}`,
                rows: one.sessions.map((item) => {
                  const meta = metaOf(item, false);
                  return { item, label: [meta.slot, meta.className, lessonOf(t, item).lesson].join(' · ') };
                }),
              }))}
              later={backlog.awaiting > backlog.days.reduce((sum, one) => sum + one.sessions.length, 0)}
              sheetKey={sheet?.backlog === true ? sheet.item.session.key : null}
              sheetRef={backlogOther}
              onConfirm={confirmAll}
              onOther={(item) => setSheet({ item, open: true, backlog: true })}
              onDetails={onDetails}
              paper={<PaperRolls context={context} from={backlog.week ?? day} to={addDays(day, -1)} onRoll={onRoll} />}
            />
          )}
          {todayEntries(state, shown).map((entry) =>
            entry.kind === 'one' ? card(entry.item) : jointCard(entry.key, entry.items),
          )}
          {mark !== null && mark.effect !== 'exam' && taken > 0 && (
            <DayNote testID="day-lost" title={t('daymark.lost', { count: taken })} note={t('daymark.lostNote')} />
          )}
          {mark?.effect === 'exam' && (
            <DayNote testID="day-paused" title={t('daymark.paused')} note={t('daymark.pausedNote')} />
          )}
          {next !== null && <NextSession line={nextLine(next)} />}
        </View>
      </ScrollView>
      {sheet?.item.proposal != null && (
        <OutcomeSheet
          visible={sheet.open}
          context={[
            metaOf(sheet.item, false).className,
            metaOf(sheet.item, false).slot,
            sheet.item.proposal.item.title,
          ].join(' · ')}
          proposal={sheet.item.proposal}
          next={nextItem(courseSetup(context, sheet.item.course.id).pack, sheet.item.proposal.item)}
          previous={previousItem(state, courseSetup(context, sheet.item.course.id).pack, sheet.item.session)}
          carry={carryWords(t, profile, language, carryTo(context, sheet.item.session))}
          returnFocusRef={sheet.backlog === true ? backlogOther : other}
          onClose={() => setSheet({ ...sheet, open: false })}
          onChoose={(choice) => confirm(sheet.item, choice)}
          onReason={(reason, text) => keepReason(sheet.item, reason, text)}
        />
      )}
      {done !== null && (
        <Snackbar
          testID="today-snack"
          message={done.message}
          undoLabel={t('today.undo')}
          bottomOffset={0}
          onUndo={undo}
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
