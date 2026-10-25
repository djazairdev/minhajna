// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The screens that record the day's work, as navigation routes: Today, a
// session's details, its roll call with a print icon for its class's blank
// sheet (R-3.4-16, answer 262), or, once a per-session roll call is taken,
// for its absence slip (R-3.4-31, answer 264), a pupil's correction in it,
// a pupil who joins or leaves the class, the seating plan with a print icon
// once it is arranged (answer 265), and the Classes tab with each class's
// plan and texts book. In a pilot build, a session's first confirmation on
// its own screen and a roll call's first taking are timed (#220).

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseDay } from '@minhajna/core';
import { useLayoutEffect, useMemo } from 'react';
import { TextsBook } from '../book/TextsBook';
import { ClassesTab } from '../classes/ClassesTab';
import { Entry } from '../entry/Entry';
import { usePilotTiming } from '../pilot/pilot-timing';
import { DutyEntry } from '../exams/DutyEntry';
import { ExamWindow } from '../exams/ExamWindow';
import { TestSchedule } from '../exams/TestSchedule';
import { PupilMove } from '../moves/PupilMove';
import { Correct } from '../roll/Correct';
import { Roll } from '../roll/Roll';
import { SeatsSetup } from '../seats/SeatsSetup';
import { HomeworkBook } from '../homework/HomeworkBook';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { useAppData } from '../storage/AppData';
import { coreContext } from '../storage/core-context';
import { takenSlip } from '../documents/roll-slip';
import { useText } from '../text/i18n';
import { Today } from '../today/Today';
import { CrashSheet } from '../help/CrashSheet';
import { schoolEntries } from '../calendar/view';
import type { HomeTabParamList, RootStackParamList } from './AppNavigator';

/** The day's sessions, with a crash report kept before the last stop; the help button opens Help. */
export function TodayTab({
  navigation,
}: CompositeScreenProps<BottomTabScreenProps<HomeTabParamList, 'Today'>, NativeStackScreenProps<RootStackParamList>>) {
  const data = useAppData();
  return (
    <>
      <CrashSheet />
      <Today
        onHelp={() => navigation.navigate('Help')}
        onSettings={() => navigation.navigate('Settings')}
        onDetails={(session) => navigation.navigate('Entry', { key: session.key, day: session.day })}
        onRoll={(session) =>
          navigation.navigate('Roll', { key: session.key, day: session.day, courseId: session.courseId })
        }
        onExtra={() => navigation.navigate('Extra')}
        onJournal={(day) => navigation.navigate('DocOutput', { id: 'primary-journal', day })}
        onCalendarUpdate={(release) => navigation.navigate('CalendarUpdate', { release })}
        onBackupSheet={() => {
          navigation.navigate('SettingsDevices');
          navigation.navigate('SettingsRecovery', { first: true });
        }}
        onRamadan={{
          calendar: (id, schoolId) =>
            navigation.navigate('CalendarEntry', {
              id,
              origin: schoolEntries(data, schoolId).some((row) => row.origin === 'local' && row.entry.id === id)
                ? 'local'
                : 'bundled',
              schoolId,
            }),
          book: () => navigation.navigate('Documents'),
        }}
        onHomework={(item) =>
          navigation.navigate('Homework', { courseId: item.session.courseId, sessionKey: item.session.key })
        }
        onExams={{
          warning: (courseId) => navigation.navigate('ExamWindow', { courseId }),
          duty: (day) => navigation.navigate('Duty', { day }),
          support: (catchUp) => navigation.navigate('Extra', { courseId: catchUp.courseId, scheduled: catchUp.id }),
        }}
      />
    </>
  );
}

/** A session's details, back to Today once confirmed. */
export function EntryScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Entry'>) {
  const pilot = usePilotTiming();
  const done = (first: boolean) => {
    const tenths = pilot.lap();
    if (first) pilot.keep(pilot.timings('session', 1, tenths, false));
    navigation.goBack();
  };
  return (
    <Entry
      sessionKey={route.params.key}
      day={parseDay(route.params.day)}
      onDone={done}
      onNote={() => navigation.navigate('Note', route.params)}
    />
  );
}

/** A session's roll call, back to where it was opened once saved; the print icon opens its blank sheet or its slip. */
export function RollScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Roll'>) {
  const t = useText();
  const { state, profile, year, calendar, calendarRelease, packs } = useAppData();
  const { key, day, courseId } = route.params;
  const pilot = usePilotTiming();
  const known = state.courses.has(courseId);
  const slip = useMemo(
    () => takenSlip(coreContext({ profile, year, calendar, calendarRelease, packs, state }), key, parseDay(day)),
    [profile, year, calendar, calendarRelease, packs, state, key, day],
  );
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          testID="roll-print-sheet"
          icon={controlIcon('print')}
          accessibilityLabel={t(slip === null ? 'rollPrint.day.open' : 'rollPrint.slip.open')}
          onPress={() =>
            navigation.navigate('RollPrint', {
              ...(known && { courseId }),
              day,
              ...(slip === null ? { choice: 'day' } : { choice: 'slip', unit: slip.key }),
            })
          }
        />
      ),
    });
  }, [navigation, t, known, courseId, day, slip]);
  return (
    <Roll
      sessionKey={route.params.key}
      day={parseDay(route.params.day)}
      onDone={(first) => {
        const tenths = pilot.lap();
        if (first) pilot.keep(pilot.timings('roll', 1, tenths, false));
        navigation.goBack();
      }}
      onCorrect={(unit, pupilId) => navigation.navigate('Correct', { unit: unit.key, day: unit.day, pupilId })}
      onRules={() => navigation.navigate('RollRules')}
      onMove={(classId) => navigation.navigate('PupilMove', { classId })}
      onSeats={(classId, groupId) => navigation.navigate('SeatsSetup', { classId, groupId })}
    />
  );
}

/** A pupil who joins or leaves the class, back to the roll call once recorded. */
export function PupilMoveScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'PupilMove'>) {
  return <PupilMove classId={route.params.classId} onDone={() => navigation.goBack()} />;
}

/** The seating plan of a class or one of its groups, each change recorded at once; the print icon prints it. */
export function SeatsSetupScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'SeatsSetup'>) {
  const t = useText();
  const { state } = useAppData();
  const { classId, groupId } = route.params;
  const arranged = state.seating.has(`${classId}/${groupId}`);
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: arranged
        ? () => (
            <IconButton
              testID="seats-print"
              icon={controlIcon('print')}
              accessibilityLabel={t('rollPrint.seats.open')}
              onPress={() => navigation.navigate('RollPrint', { classId, plan: groupId, choice: 'seats' })}
            />
          )
        : undefined,
    });
  }, [navigation, t, arranged, classId, groupId]);
  return <SeatsSetup classId={classId} groupId={groupId} />;
}

/** One pupil's correction in a roll call already taken, back to it once saved. */
export function CorrectScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Correct'>) {
  const { unit, day, pupilId } = route.params;
  return (
    <Correct
      unitKey={unit}
      day={parseDay(day)}
      pupilId={pupilId}
      onDone={() => navigation.goBack()}
      onRules={() => navigation.navigate('RollRules')}
    />
  );
}

/** The Classes tab: a class's page, its texts book, the merged week and «ملخص الأسبوع». */
export function ClassesTabScreen({
  navigation,
}: CompositeScreenProps<
  BottomTabScreenProps<HomeTabParamList, 'Classes'>,
  NativeStackScreenProps<RootStackParamList>
>) {
  return (
    <ClassesTab
      onClass={(courseId) => navigation.navigate('Class', { courseId })}
      onBook={(courseId) => navigation.navigate('TextsBook', { courseId })}
      onWeek={() => navigation.navigate('SettingsWeek')}
      onDigest={() => navigation.navigate('Digest')}
    />
  );
}

/** An invigilation or a class exam, on the day asked or the next exam day. */
export function DutyScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Duty'>) {
  return <DutyEntry {...(route.params?.day !== undefined && { day: parseDay(route.params.day) })} />;
}

/** The answers to a class's exam-window warning; a make-up day opens from it. */
export function ExamWindowScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ExamWindow'>) {
  return (
    <ExamWindow
      courseId={route.params.courseId}
      onMakeUp={() => navigation.navigate('AddSessions')}
      onLater={() => navigation.goBack()}
    />
  );
}

/** A class's tests, another class's from its chip. */
export function TestScheduleScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'TestSchedule'>) {
  return (
    <TestSchedule
      courseId={route.params.courseId}
      onCourse={(courseId) => navigation.setParams({ courseId })}
      onDuty={(day) => navigation.navigate('Duty', { day })}
    />
  );
}

/** A class's texts book; another subject replaces it, and the month on screen prints. */
export function TextsBookScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'TextsBook'>) {
  return (
    <TextsBook
      key={route.params.courseId}
      courseId={route.params.courseId}
      onCourse={(courseId) => navigation.setParams({ courseId })}
      onDetails={(session) => navigation.navigate('Entry', { key: session.key, day: session.day })}
      onPrint={(day) => navigation.navigate('DocOutput', { id: 'texts', day })}
      onHomework={(courseId) => navigation.navigate('Homework', { courseId })}
      onStrip={(day) => navigation.navigate('DocOutput', { id: 'strip', day })}
      onFixes={(month, classId) => navigation.navigate('BookFixes', { month, classId })}
    />
  );
}

/** A course's homework record, open on the homework Today's card opened, if any; it prints the year's pages. */
export function HomeworkScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Homework'>) {
  const { courseId, sessionKey } = route.params;
  return (
    <HomeworkBook
      key={`${courseId}/${sessionKey ?? ''}`}
      courseId={courseId}
      {...(sessionKey !== undefined && { sessionKey })}
      onPrint={() => navigation.navigate('DocOutput', { id: 'homework' })}
    />
  );
}
