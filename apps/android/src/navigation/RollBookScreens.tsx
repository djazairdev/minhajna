// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's routes (#217): a class's month or yearly summary, one
// pupil's page, each titled with the class or the pupil, and Roll-print.
// Choosing another month replaces the screen's in place; a pupil's name in a
// table opens their page on the same month, and the print button opens
// Roll-print on the month or the yearly summary shown.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';
import { PupilPage } from '../rollbook/PupilPage';
import { RollMonth } from '../rollbook/RollMonth';
import { RollPrint } from '../rollbook/RollPrint';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import type { RootStackParamList } from './routes';

/** The roll-call book of a class's course: a month, or the yearly summary. */
export function RollMonthScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'RollMonth'>) {
  const t = useText();
  const { state } = useAppData();
  const { courseId, month } = route.params;
  const course = state.courses.get(courseId);
  const schoolClass = course === undefined ? undefined : state.classes.get(course.classId);
  const title = schoolClass === undefined ? t('classPage.roll') : t('rollBook.titleOf', { name: schoolClass.name });
  useLayoutEffect(() => navigation.setOptions({ title }), [navigation, title]);
  return (
    <RollMonth
      courseId={courseId}
      month={month ?? ''}
      onMonth={(one) => navigation.setParams({ month: one })}
      onRoll={(session) =>
        navigation.navigate('Roll', { key: session.key, day: session.day, courseId: session.courseId })
      }
      onRules={() => navigation.navigate('RollRules')}
      onPupil={(pupilId) =>
        navigation.navigate('Pupil', { courseId, pupilId, ...(month !== undefined && month !== '' && { month }) })
      }
      onPrint={() =>
        navigation.navigate('RollPrint', {
          courseId,
          ...(month === 'year' ? { choice: 'year' } : month !== undefined && month !== '' && { month }),
        })
      }
    />
  );
}

/** One pupil in the roll-call book: a month, or the school year. */
export function PupilScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Pupil'>) {
  const { state } = useAppData();
  const { courseId, pupilId, month } = route.params;
  const course = state.courses.get(courseId);
  const title = state.pupils.get(pupilId)?.name ?? '';
  useLayoutEffect(() => navigation.setOptions({ title }), [navigation, title]);
  return (
    <PupilPage
      courseId={courseId}
      pupilId={pupilId}
      month={month ?? ''}
      onMonth={(one) => navigation.setParams({ month: one })}
      onClassYear={() => navigation.navigate('RollMonth', { courseId, month: 'year' })}
      onCorrect={(unit) => navigation.navigate('Correct', { unit: unit.key, day: unit.day, pupilId })}
      onMove={() => course !== undefined && navigation.navigate('PupilMove', { classId: course.classId })}
    />
  );
}

/** Printing the roll-call book, on a class and a month or the yearly summary when given. */
export function RollPrintScreen({ route }: NativeStackScreenProps<RootStackParamList, 'RollPrint'>) {
  return <RollPrint {...route.params} />;
}
