// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Marks routes (#238, #239): «التقويم والنقاط» for a class and subject,
// whose term chips stay in the route; its continuous-assessment setup for a
// term, which asks before a draft is lost and goes back to the hub once saved;
// capture during today's session; the term's component marks, whose month chips
// stay in the route, and its justification; the grade book, whose rows open a
// pupil's justification (#240); the descriptive observations of a term whose
// marks they replace, whose subject chips stay in the route; and the entry of a
// test's, the exam's or a component's marks, each recorded as it is typed or
// tapped, so leaving loses nothing.

import { usePreventRemove } from '@react-navigation/native';
import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Marks } from '../marks/Marks';
import { Capture } from '../marks/Capture';
import { MarksBook } from '../marks/MarksBook';
import { MarksComponents } from '../marks/MarksComponents';
import { MarksEntry } from '../marks/MarksEntry';
import { MarksJustify } from '../marks/MarksJustify';
import { MarksObservations } from '../marks/MarksObservations';
import { MarksSetup } from '../marks/MarksSetup';
import { useText } from '../text/i18n';
import type { RootStackParamList } from './AppNavigator';

export function MarksScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Marks'>) {
  const { courseId, term } = route.params;
  return (
    <Marks
      courseId={courseId}
      {...(term !== undefined && { term })}
      onTerm={(chosen) => navigation.setParams({ term: chosen })}
      onSetup={(chosen) => navigation.navigate('MarksSetup', { courseId, term: chosen })}
      onTests={() => navigation.navigate('TestSchedule', { courseId })}
      onCapture={() => navigation.navigate('MarksCapture', { courseId })}
      onComponents={(chosen) => navigation.navigate('MarksComponents', { courseId, term: chosen })}
      onBook={(chosen) => navigation.navigate('MarksBook', { courseId, term: chosen })}
      onObservations={(chosen) => navigation.navigate('MarksObservations', { courseId, term: chosen })}
      onEntry={(chosen, testId) =>
        navigation.navigate('MarksEntry', { courseId, term: chosen, ...(testId !== undefined && { testId }) })
      }
      onPart={(chosen, part) => navigation.navigate('MarksEntry', { courseId, term: chosen, part })}
    />
  );
}

export function MarksSetupScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'MarksSetup'>) {
  const t = useText();
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  usePreventRemove(dirty && !saved, ({ data }) =>
    Alert.alert(t('marks.leave'), t('planFree.leaveBody'), [
      { text: t('planFree.stay'), style: 'cancel' },
      { text: t('planFree.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]),
  );
  useEffect(() => {
    if (saved) navigation.goBack();
  }, [saved, navigation]);
  const { courseId, term } = route.params;
  return <MarksSetup courseId={courseId} term={term} onDirty={setDirty} onSaved={() => setSaved(true)} />;
}

export function MarksEntryScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'MarksEntry'>) {
  const { courseId, term, testId, part, componentId, month } = route.params;
  return (
    <MarksEntry
      courseId={courseId}
      term={term}
      {...(testId !== undefined && { testId })}
      {...(part !== undefined && { part })}
      {...(componentId !== undefined && { componentId })}
      {...(month !== undefined && { month })}
      onDone={() => navigation.goBack()}
    />
  );
}

export function MarksComponentsScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'MarksComponents'>) {
  const { courseId, term, month } = route.params;
  return (
    <MarksComponents
      courseId={courseId}
      term={term}
      {...(month !== undefined && { month })}
      onMonth={(chosen) => navigation.setParams({ month: chosen })}
      onJustify={(chosen) =>
        navigation.navigate('MarksJustify', { courseId, term, ...(chosen !== undefined && { month: chosen }) })
      }
      onEntry={(componentId, chosen) =>
        navigation.navigate('MarksEntry', {
          courseId,
          term,
          componentId,
          ...(chosen !== undefined && { month: chosen }),
        })
      }
    />
  );
}

export function MarksBookScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'MarksBook'>) {
  const { courseId, term } = route.params;
  return (
    <MarksBook
      courseId={courseId}
      term={term}
      onJustify={(pupilId) => navigation.navigate('MarksJustify', { courseId, term, pupilId })}
      onSignature={() => navigation.navigate('SettingsSignature')}
    />
  );
}

export function MarksObservationsScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'MarksObservations'>) {
  const { courseId, term } = route.params;
  return (
    <MarksObservations
      courseId={courseId}
      term={term}
      onCourse={(chosen) => navigation.setParams({ courseId: chosen })}
    />
  );
}

export function MarksJustifyScreen({ route }: NativeStackScreenProps<RootStackParamList, 'MarksJustify'>) {
  return <MarksJustify {...route.params} />;
}

export function MarksCaptureScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'MarksCapture'>) {
  return <Capture courseId={route.params.courseId} onDone={() => navigation.goBack()} />;
}

/** The Marks routes, for the app's navigator. */
export function marksRoutes(
  Stack: ReturnType<typeof createNativeStackNavigator<RootStackParamList>>,
  t: ReturnType<typeof useText>,
) {
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <>
      <Stack.Screen name="Marks" component={MarksScreen} options={dark(t('classPage.marks'))} />
      <Stack.Screen name="MarksSetup" component={MarksSetupScreen} options={dark(t('marks.setupTitle'))} />
      <Stack.Screen name="MarksEntry" component={MarksEntryScreen} options={dark(t('marks.entry.title'))} />
      <Stack.Screen name="MarksCapture" component={MarksCaptureScreen} options={dark(t('marks.during.title'))} />
      <Stack.Screen name="MarksBook" component={MarksBookScreen} options={dark(t('marks.book.title'))} />
      <Stack.Screen name="MarksJustify" component={MarksJustifyScreen} options={dark(t('marks.justify.title'))} />
      <Stack.Screen
        name="MarksObservations"
        component={MarksObservationsScreen}
        options={dark(t('marks.observations.title'))}
      />
      <Stack.Screen
        name="MarksComponents"
        component={MarksComponentsScreen}
        options={dark(t('marks.componentMarks.title'))}
      />
    </>
  );
}
