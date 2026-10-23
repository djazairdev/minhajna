// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Marks routes (#238, #239): «التقويم والنقاط» for a class and subject,
// whose term chips stay in the route; its continuous-assessment setup for a
// term, which asks before a draft is lost and goes back to the hub once saved;
// capture during today's session; and the entry of a test's or the exam's
// marks, each recorded as it is typed or tapped, so leaving loses nothing.

import { usePreventRemove } from '@react-navigation/native';
import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Marks } from '../marks/Marks';
import { Capture } from '../marks/Capture';
import { MarksEntry } from '../marks/MarksEntry';
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
      onEntry={(chosen, testId) =>
        navigation.navigate('MarksEntry', { courseId, term: chosen, ...(testId !== undefined && { testId }) })
      }
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
  const { courseId, term, testId } = route.params;
  return (
    <MarksEntry
      courseId={courseId}
      term={term}
      {...(testId !== undefined && { testId })}
      onDone={() => navigation.goBack()}
    />
  );
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
    </>
  );
}
