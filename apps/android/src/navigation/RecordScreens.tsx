// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The screens that record the day's work, as navigation routes: Today, a
// session's details, its roll call, a pupil's correction in it, and a
// pupil who joins or leaves the class.

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseDay } from '@minhajna/core';
import { Entry } from '../entry/Entry';
import { PupilMove } from '../moves/PupilMove';
import { Correct } from '../roll/Correct';
import { Roll } from '../roll/Roll';
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
    />
  );
}

/** A pupil who joins or leaves the class, back to the roll call once recorded. */
export function PupilMoveScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'PupilMove'>) {
  return <PupilMove classId={route.params.classId} onDone={() => navigation.goBack()} />;
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
