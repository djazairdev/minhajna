// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Class page as a route (#279): the class's name in the top bar, with the
// settings button that opens its settings, and each of its rows opening its own
// screen. Another class of the subject replaces it in place.

import { courseGrade, isJoint } from '@minhajna/core';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useRef, useState } from 'react';
import { View, type ViewInstance } from 'react-native';
import { ClassPage } from '../classes/ClassPage';
import { courseGroup } from '../classes/class-page-rules';
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
      onRoll={(session) => navigation.navigate('Roll', { key: session.key, day: session.day })}
      onBook={() => navigation.navigate('TextsBook', { courseId })}
      onPlan={() => navigation.navigate('ClassPlan', { courseId })}
      onHomework={() => navigation.navigate('Homework', { courseId })}
      onExtra={() => navigation.navigate('Extra', { courseId })}
      onSupervised={() => navigation.navigate('DocOutput', { id: 'supervised' })}
      onMove={() => navigation.navigate('PupilMove', { classId: schoolClass.id })}
      onSeats={() => navigation.navigate('SeatsSetup', { classId: schoolClass.id, groupId })}
      onRules={() => navigation.navigate('RollRules')}
      onMonth={() => navigation.navigate('RollMonth', { courseId })}
      onRollPrint={() => navigation.navigate('RollPrint', { courseId })}
      onPupil={(pupilId) => navigation.navigate('Pupil', { courseId, pupilId })}
    />
  );
}
