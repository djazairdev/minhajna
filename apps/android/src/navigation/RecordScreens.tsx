// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The screens that record the day's work, as navigation routes: Today, a
// session's details, its roll call, a pupil's correction in it, a pupil who
// joins or leaves the class, and the Classes tab with each class's plan and
// texts book.

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseDay } from '@minhajna/core';
import { TextsBook } from '../book/TextsBook';
import { ClassPlan } from '../classes/ClassPlan';
import { ClassesTab } from '../classes/ClassesTab';
import { Entry } from '../entry/Entry';
import { AddSessions } from '../extra/AddSessions';
import { ExtraSession } from '../extra/ExtraSession';
import { PupilMove } from '../moves/PupilMove';
import { Correct } from '../roll/Correct';
import { Roll } from '../roll/Roll';
import { SeatsSetup } from '../seats/SeatsSetup';
import { HomeworkBook } from '../homework/HomeworkBook';
import { Today } from '../today/Today';
import type { HomeTabParamList, RootStackParamList } from './AppNavigator';

/** The day's sessions; the help button opens Help and the privacy notice. */
export function TodayTab({
  navigation,
}: CompositeScreenProps<BottomTabScreenProps<HomeTabParamList, 'Today'>, NativeStackScreenProps<RootStackParamList>>) {
  return (
    <Today
      onHelp={() => navigation.navigate('Help')}
      onDetails={(session) => navigation.navigate('Entry', { key: session.key, day: session.day })}
      onRoll={(session) => navigation.navigate('Roll', { key: session.key, day: session.day })}
      onExtra={() => navigation.navigate('Extra')}
      onHomework={(item) =>
        navigation.navigate('Homework', { courseId: item.session.courseId, sessionKey: item.session.key })
      }
    />
  );
}

/** A session's details, back to Today once confirmed. */
export function EntryScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Entry'>) {
  return <Entry sessionKey={route.params.key} day={parseDay(route.params.day)} onDone={() => navigation.goBack()} />;
}

/** A session's roll call, back to where it was opened once saved. */
export function RollScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Roll'>) {
  return (
    <Roll
      sessionKey={route.params.key}
      day={parseDay(route.params.day)}
      onDone={() => navigation.goBack()}
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

/** The seating plan of a class or one of its groups, each change recorded at once. */
export function SeatsSetupScreen({ route }: NativeStackScreenProps<RootStackParamList, 'SeatsSetup'>) {
  return <SeatsSetup classId={route.params.classId} groupId={route.params.groupId} />;
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

/** The Classes tab; a class's «المخطط» opens its plan. */
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
    />
  );
}

/** A class's plan. */
export function ClassPlanScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ClassPlan'>) {
  const { courseId } = route.params;
  return <ClassPlan courseId={courseId} onExtra={() => navigation.navigate('Extra', { courseId })} />;
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

/** A session outside the timetable, for the class it was opened from, if any. */
export function ExtraScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Extra'>) {
  return (
    <ExtraSession
      {...(route.params?.courseId !== undefined && { courseId: route.params.courseId })}
      onAddDay={() => navigation.navigate('AddSessions')}
    />
  );
}

export function AddSessionsScreen() {
  return <AddSessions />;
}
