// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The routes «حصة» opens: a session outside the timetable, for the class it
// was opened from or filled in from a scheduled support session (#228,
// answer 362), the days that add sessions, and a cover for a colleague's
// class.

import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { AddSessions } from '../extra/AddSessions';
import { ExtraSession } from '../extra/ExtraSession';
import { CoverEntry } from '../exams/CoverEntry';
import { coverSchools } from '../exams/cover-schools';
import { scheduledLog } from '../plan/catch-up-add-rules';
import { useAppData } from '../storage/AppData';
import type { useText } from '../text/i18n';
import type { RootStackParamList } from './AppNavigator';

/** A session outside the timetable, for the class it was opened from, if any. */
export function ExtraScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Extra'>) {
  const data = useAppData();
  const scheduled = scheduledLog(data, route.params?.scheduled);
  return (
    <ExtraSession
      {...(route.params?.courseId !== undefined && { courseId: route.params.courseId })}
      {...(scheduled !== undefined && { scheduled })}
      onAddDay={() => navigation.navigate('AddSessions')}
      onQueue={(courseId) => navigation.navigate('SupportQueue', { courseId })}
      {...(coverSchools(data.state).length > 0 && { onCover: () => navigation.replace('Cover') })}
    />
  );
}

/** A cover the teacher gives a colleague's class, back to where «حصة» was opened from once saved. */
export function CoverScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Cover'>) {
  return <CoverEntry onDone={() => navigation.goBack()} />;
}

/** The routes «حصة» opens, for the app's navigator. */
export function extraRoutes(
  Stack: ReturnType<typeof createNativeStackNavigator<RootStackParamList>>,
  t: ReturnType<typeof useText>,
) {
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <>
      <Stack.Screen name="Extra" component={ExtraScreen} options={dark(t('extra.title'))} />
      <Stack.Screen name="AddSessions" component={AddSessionsScreen} options={dark(t('addSessions.title'))} />
      <Stack.Screen name="Cover" component={CoverScreen} options={dark(t('cover.title'))} />
    </>
  );
}

export function AddSessionsScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'AddSessions'>) {
  return (
    <AddSessions
      schoolId={route.params?.schoolId}
      onDone={
        route.params?.calendar
          ? (entry) =>
              navigation.replace('CalendarEntry', {
                id: entry.id,
                origin: 'local',
                schoolId: entry.schoolId!,
              })
          : undefined
      }
    />
  );
}
