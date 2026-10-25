// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Class page as a route (#279): the class's name in the top bar, with the
// settings button that opens its settings, and each of its rows opening its own
// screen. Another class of the subject replaces it in place. A lycée class's
// settings open the reorientation, which goes back to the Classes tab once
// applied (#231). «بيان التقدّم» opens from its row (#438).

import { courseGrade, isJoint } from '@minhajna/core';
import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useRef, useState } from 'react';
import { View, type ViewInstance } from 'react-native';
import { ClassPage } from '../classes/ClassPage';
import { Digest } from '../digest/Digest';
import { courseGroup } from '../classes/class-page-rules';
import { Reorient } from '../reorient/Reorient';
import { StatementShare } from '../sharing/StatementShare';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import type { RootStackParamList } from './routes';

/** A class and subject, with its records and pupils. */
export function ClassScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Class'>) {
  const t = useText();
  const { state } = useAppData();
  const { courseId } = route.params;
  const course = state.courses.get(courseId);
  const schoolClass = course === undefined ? undefined : state.classes.get(course.classId);
  const [settings, setSettings] = useState(false);
  const gear = useRef<ViewInstance | null>(null);
  const title = schoolClass?.name ?? t('classPage.title');
  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerRight: () => (
        <View ref={gear} collapsable={false}>
          <IconButton
            testID="class-gear"
            icon={controlIcon('tune')}
            accessibilityLabel={t('classPage.settings')}
            onPress={() => setSettings(true)}
          />
        </View>
      ),
    });
  }, [navigation, title, t]);
  if (course === undefined || schoolClass === undefined) return null;
  const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
  const groupId = courseGroup({ schoolClass, ...(grade !== undefined && { grade }) });
  return (
    <ClassPage
      key={courseId}
      courseId={courseId}
      settings={settings}
      onSettings={setSettings}
      settingsOpener={gear}
      onCourse={(id) => navigation.setParams({ courseId: id })}
      onRoll={(session) =>
        navigation.navigate('Roll', { key: session.key, day: session.day, courseId: session.courseId })
      }
      onBook={() => navigation.navigate('TextsBook', { courseId })}
      onPlan={() => navigation.navigate('ClassPlan', { courseId })}
      onTests={() => navigation.navigate('TestSchedule', { courseId })}
      onMarks={() => navigation.navigate('Marks', { courseId })}
      onHomework={() => navigation.navigate('Homework', { courseId })}
      onExtra={() => navigation.navigate('Extra', { courseId })}
      onSupervised={() => navigation.navigate('DocOutput', { id: 'supervised' })}
      onMove={() => navigation.navigate('PupilMove', { classId: schoolClass.id })}
      onReorient={() => navigation.navigate('Reorient', { classId: schoolClass.id })}
      onSeats={() => navigation.navigate('SeatsSetup', { classId: schoolClass.id, groupId })}
      onRules={() => navigation.navigate('RollRules')}
      onMonth={() => navigation.navigate('RollMonth', { courseId })}
      onRollPrint={() => navigation.navigate('RollPrint', { courseId })}
      onStatement={() => navigation.navigate('Statement', { courseId })}
      onPupil={(pupilId) => navigation.navigate('Pupil', { courseId, pupilId })}
    />
  );
}

/** The reshaping of a lycée level's classes, from a class's settings. */
export function ReorientScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Reorient'>) {
  return <Reorient classId={route.params.classId} onDone={() => navigation.navigate('Home', { screen: 'Classes' })} />;
}

/** «بيان التقدّم»: another class's chip replaces it in place. */
export function StatementScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Statement'>) {
  return (
    <StatementShare courseId={route.params.courseId} onCourse={(courseId) => navigation.setParams({ courseId })} />
  );
}

/** The weekly digest: its rows open Today's list, a make-up, the catch-up options, a plan or «الإشعارات». */
export function DigestScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Digest'>) {
  return (
    <Digest
      onBacklog={() => navigation.navigate('Home', { screen: 'Today' })}
      onMakeUp={(courseId) => navigation.navigate('CatchUpAdd', { courseId })}
      onCatchUp={(courseId) => navigation.navigate('CatchUp', { courseId })}
      onPlan={(courseId) => navigation.navigate('ClassPlan', { courseId })}
      onNotify={() => navigation.navigate('SettingsNotify')}
    />
  );
}

/** The Class page, the weekly digest and the screens only they open, for the app's navigator. */
export function classRoutes(
  Stack: ReturnType<typeof createNativeStackNavigator<RootStackParamList>>,
  t: ReturnType<typeof useText>,
) {
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <>
      <Stack.Screen name="Class" component={ClassScreen} options={dark(t('classPage.title'))} />
      <Stack.Screen name="Statement" component={StatementScreen} options={dark(t('statement.title'))} />
      <Stack.Screen name="Reorient" component={ReorientScreen} options={dark(t('reorient.title'))} />
      <Stack.Screen name="Digest" component={DigestScreen} options={dark(t('digest.title'))} />
    </>
  );
}
