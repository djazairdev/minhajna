// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today (#32, Main and Today-done): the day's sessions in order. The next
// session awaiting confirmation is the focus card, with the plan's proposal in
// pencil and the one tap that records it; the others show their lesson, and a
// recorded session shows what it wrote. Nothing is recorded until the teacher
// taps (PRD §2.3), and the tap can be undone at once: the history keeps both
// changes (PRD §4.7). «نتيجة أخرى» records any other outcome in a second tap
// (#33); today-actions.ts records the taps and their undo. The session's
// details come with their own screen. Earlier sessions still awaiting
// confirmation come first, a week at a time, to confirm at once but for the
// ones left out (#35). A holiday, a closure or an exam week shows its name, the
// sessions it took, counted apart, and the next session (#36). Every session
// card carries its roll call, whatever its kind (#184), and the backlog a past
// one's from the paper sheet (#38). A joint class's years share one card for
// each slot, each on its own plan (#43, P-Multi). A seminar, a duty or a school
// event makes a special day, with a line and a card, and so does Ramadan, with
// its cards (#224). Support sessions due show too (#228). A half-group's
// session shows each half's turn at its item, and a TD session the TD queue's
// next items (#231). The 30-day backup reminder follows the banners (#247).

import {
  addDays,
  backlogOf,
  carryTo,
  courseSetup,
  formatDayWithMonth,
  nextSession,
  todayView,
  weekday,
  type Choice,
  type Day,
  type Details,
  type HomeworkItem,
  type Session,
  type TodaySession,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TodayHeadingActions } from './TodayHeadingActions';
import { PageHeading } from '../components/PageHeading';
import { TodayJoint } from './TodayJoint';
import { SessionCard } from '../components/SessionCard';
import { Snackbar } from '../components/Snackbar';
import { TodayExams, type TodayExamsOpen } from '../exams/TodayExams';
import { TodayUpdate } from './TodayUpdate';
import { TodayDeviceCards } from './TodayBackup';
import { SupportToday } from './SupportToday';
import { RamadanNotice, RamadanRule, withRamadan, type RamadanOpen } from './RamadanCards';
import { controlIcon } from '../design/Icon';
import { colors, spacing } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { Backlog } from './Backlog';
import { DayBanner, DayNote, NextSession, dayMarks, markLine, pausedNote, takenBy } from './DayMark';
import { FreeEntry, focusable, freeEntry, proposed } from './FreeEntry';
import { SpecialCards, specialEntries, specialLine, specialLost } from './SpecialDay';
import { carryWords, nextItem, previousOf } from './outcome-rules';
import { OutcomeSheet, type Sheet } from './OutcomeSheet';
import { PaperRolls } from './PaperRolls';
import { dueStrips } from '../homework/homework-strip';
import { dayFacts, lessonOf, proposalOf, withOffDay, writtenOf } from './today-labels';
import { todayEntries, type TodayEntry } from './joint-today';
import { bandRoll, DayBands, DayEnd, isBandedDay, isPrimaryDay, taughtSchools } from './DayBands';
import { ListCard, listDetails, listOfSession, listWritten } from './ListCard';
import { useTodayActions } from './today-actions';
import { nextLine, sessionMeta } from './today-meta';
import { useCardExtras } from './card-extras';

/**
 * The Today tab; `onHelp` opens Help, `onExtra` a session outside the timetable, `onDetails` a session's details,
 * `onRoll` its roll call, `onHomework` the homework that comes back, `onCalendarUpdate` what an update changed,
 * `onBackupSheet` the recovery sheet for a first backup, and `onJournal` a primary day's journal.
 */
export function Today(props: {
  onHelp: () => void;
  onSettings?: () => void;
  onExtra?: () => void;
  onDetails: (session: Session) => void;
  onRoll: (session: Session) => void;
  onHomework?: (item: HomeworkItem) => void;
  onExams?: TodayExamsOpen;
  onCalendarUpdate?: (release: string) => void;
  onBackupSheet?: () => void;
  onRamadan?: RamadanOpen;
  onJournal?: (day: Day) => void;
}) {
  const { onHelp, onDetails, onRoll, onExtra, onHomework = () => undefined } = props;
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, calendarRelease, packs, bells, today, record, recordAll } = useAppData();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const other = useRef<ViewInstance>(null);
  const backlogOther = useRef<ViewInstance>(null);
  const day = today();
  const language = currentLanguage();
  const comma = language === 'ar' ? '، ' : ', ';
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const view = useMemo(() => todayView(context, day), [context, day]);
  const extrasOf = useCardExtras(context, view.sessions, day);
  const backlog = useMemo(() => backlogOf(context, day), [context, day]);
  const { mark, partial, paused } = dayMarks(view, state);
  const specials = specialEntries(view);
  const shown = mark === null ? view.sessions : view.sessions.filter((item) => item.status !== 'calendar');
  const taken = mark === null ? specialLost(view, [...specials, ...partial]) : view.sessions.length - shown.length;
  const lost = taken - specialLost(view, paused);
  const noneLeft = (mark !== null || taken > 0) && (mark === null ? view.sessions.length - taken : shown.length) === 0;
  const next = useMemo(() => (noneLeft ? nextSession(context, day) : null), [context, day, noneLeft]);
  const ready = shown.filter(proposed);
  const [focus] = shown.filter((item) => focusable(context, item));
  const banded = isBandedDay(state, shown);
  const { done, confirm, confirmAll, keepReason, undo } = useTodayActions(context, t, record, recordAll);
  const metaOf = (item: TodaySession, withSubject: boolean) =>
    sessionMeta({ state, profile, bells, calendar }, t, direction, item, withSubject);

  const card = (item: TodaySession) => {
    const key = item.session.key;
    const testID = `today-${key}`;
    const pack = courseSetup(context, item.course.id).pack;
    const due = dueStrips(t, context, [item.session], onRoll, onHomework, !banded || !bandRoll(context, item.session));
    const { td, half, extra } = extrasOf(item, testID, metaOf(item, false).className);
    if (item.status === 'recorded' && item.record !== null) {
      return (
        <SessionCard
          key={key}
          testID={testID}
          kind="done"
          meta={metaOf(item, true)}
          written={listWritten(t, state, item.record) ?? writtenOf(t, context, item.record, comma)}
          where={t('today.recorded')}
          show={{ id: 'fix', label: t('fix.open'), onPress: () => onDetails(item.session) }}
          due={due}
        />
      );
    }
    if (item.status === 'calendar') {
      return (
        <SessionCard key={key} testID={testID} kind="mini" meta={metaOf(item, false)} lesson={takenBy(t, view, item)} />
      );
    }
    const list = listOfSession(item);
    if (list !== null) {
      const onRecord = (choice?: Choice, details?: Details) => confirm(item, choice, details);
      const show = { meta: metaOf(item, true), focus: item === focus, onDetails: () => onDetails(item.session) };
      return <ListCard key={key} testID={testID} {...{ item, context, due, extra, onRecord, ...show }} kind={list} />;
    }
    const why = item === focus ? freeEntry(context, item) : null;
    if (why !== null) {
      const onRecord = (details: Details) => confirm(item, { outcome: 'changed' }, details);
      const free = { item, why, due, extra, onRecord, onDetails: () => onDetails(item.session) };
      return <FreeEntry key={key} testID={testID} meta={metaOf(item, true)} {...free} />;
    }
    if (item === focus && item.proposal !== null) {
      return (
        <SessionCard
          key={key}
          testID={testID}
          kind="focus"
          meta={metaOf(item, true)}
          {...(!td && { proposal: proposalOf(t, pack, item.proposal) })}
          {...{ due, extra }}
          confirm={half === undefined ? t('today.confirm') : t('today.confirmHalf', { n: half })}
          onConfirm={() => confirm(item)}
          more={[
            { id: 'other', label: t('outcome.other'), onPress: () => setSheet({ item, open: true }), ref: other },
            { id: 'details', label: t('entry.open'), onPress: () => onDetails(item.session) },
          ]}
        />
      );
    }
    const lesson = lessonOf(t, item, pack);
    const mini = { ...(!td && lesson), due, extra };
    return <SessionCard key={key} testID={testID} kind="mini" meta={metaOf(item, false)} {...mini} />;
  };

  const entry = (one: TodayEntry) =>
    one.kind === 'one' ? (
      card(one.item)
    ) : (
      <TodayJoint
        key={one.key}
        slotKey={one.key}
        items={one.items}
        roll={!banded || !one.items.some((item) => bandRoll(context, item.session))}
        {...{ focus, context, metaOf, confirm, confirmAll, onDetails, onRoll, onHomework }}
      />
    );

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
          fact={{
            text: dayFacts(t, view, mark !== null || taken > 0, taughtSchools(state, shown)),
            icon: controlIcon('check'),
          }}
          special={withOffDay(t, profile, view, day, withRamadan(t, view, specialLine(t, specials)))}
          actions={<TodayHeadingActions onExtra={onExtra} onSettings={props.onSettings} onHelp={onHelp} />}
        />
        <View style={styles.list}>
          {mark !== null && <DayBanner entry={mark} line={markLine(t, mark, day, language, profile)} />}
          {props.onCalendarUpdate && <TodayUpdate day={day} open={props.onCalendarUpdate} />}
          {props.onBackupSheet && <TodayDeviceCards day={day} onSheet={props.onBackupSheet} />}
          <RamadanNotice view={view} />
          {props.onExams && <TodayExams context={context} day={day} open={props.onExams} />}
          {backlog.days.length > 0 && (
            <Backlog
              days={backlog.days.map((one) => ({
                title: `${t(`week.days.${weekday(one.day)}`)} ${formatDayWithMonth(one.day, language, profile)}`,
                rows: one.sessions.map((item) => {
                  const meta = metaOf(item, false);
                  const lesson = lessonOf(t, item, courseSetup(context, item.course.id).pack).lesson;
                  return { item, label: [meta.slot, meta.className, lesson].join(' · ') };
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
          {banded ? (
            <DayBands entries={todayEntries(state, shown)} render={entry} context={context} onRoll={onRoll} />
          ) : (
            todayEntries(state, shown).map(entry)
          )}
          <DayEnd
            {...(ready.length > 1 && { onConfirmDay: () => confirmAll(ready, 'day', listDetails(context)) })}
            {...(isPrimaryDay(state, shown) && props.onJournal && { onJournal: () => props.onJournal?.(day) })}
          />
          {props.onExams?.support && <SupportToday day={day} onLog={props.onExams.support} />}
          {mark?.effect !== 'exam' && lost > 0 && (
            <DayNote testID="day-lost" title={t('daymark.lost', { count: lost })} note={t('daymark.lostNote')} />
          )}
          {(mark?.effect === 'exam' || paused.length > 0) && (
            <DayNote testID="day-paused" {...pausedNote(t, state, view, paused)} />
          )}
          <SpecialCards entries={specials} state={state} day={day} />
          {props.onRamadan && <RamadanRule view={view} open={props.onRamadan} />}
          {next !== null && (
            <NextSession line={nextLine({ state, profile, bells, calendar }, t, direction, language, next)} />
          )}
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
          previous={previousOf(context, sheet.item.session)}
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
