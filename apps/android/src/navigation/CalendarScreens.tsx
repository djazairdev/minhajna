// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { editableCalendarEntry, isLunarHoliday, isWeekReset } from '@minhajna/core';
import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';
import { Text } from 'react-native';
import { Calendar } from '../calendar/Calendar';
import { CalendarEntry } from '../calendar/Entry';
import { CalendarForm } from '../calendar/Form';
import { AbReset } from '../calendar/AbReset';
import { Lunar, lunarText } from '../calendar/Lunar';
import { Groups } from '../calendar/Groups';
import { Receive } from '../calendar/Receive';
import { ImportUpdate } from '../calendar/ImportUpdate';
import { UpdateChanges } from '../calendar/UpdateChanges';
import { AddSessions } from '../extra/AddSessions';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { schoolEntries } from '../calendar/view';
import type { RootStackParamList } from './routes';

function CalendarScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Calendar'>) {
  return (
    <Calendar
      onEntry={(id, origin, schoolId) => navigation.navigate('CalendarEntry', { id, origin, schoolId })}
      onAdd={(schoolId) => navigation.navigate('CalendarEdit', { schoolId })}
      onReset={(schoolId) => navigation.navigate('CalendarAb', { schoolId })}
      onGroups={(schoolId) => navigation.navigate('CalendarGroups', { schoolId })}
      onReceive={(schoolId) => navigation.navigate('CalendarReceive', { schoolId })}
      onImport={() => navigation.navigate('ImportUpdate')}
      onUpdate={(release) => navigation.navigate('CalendarUpdate', { release })}
    />
  );
}

function CalendarEntryScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CalendarEntry'>) {
  return (
    <CalendarEntry
      {...route.params}
      onEdit={() => navigation.navigate('CalendarEdit', { id: route.params.id, schoolId: route.params.schoolId })}
      onCancelled={() => navigation.goBack()}
      onLunar={() => navigation.navigate('CalendarLunar', { id: route.params.id, schoolId: route.params.schoolId })}
    />
  );
}

function CalendarEditScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CalendarEdit'>) {
  const data = useAppData();
  const t = useText();
  const { id, schoolId } = route.params;
  const row = schoolEntries(data, schoolId).find((one) => one.origin === 'local' && one.entry.id === id);
  const old = id === undefined ? undefined : editableCalendarEntry(coreContext(data), id);
  if (!data.state.schools.has(schoolId) || (id !== undefined && (old == null || row === undefined)))
    return <Text>{t('calendarView.edit.readOnly')}</Text>;
  const done = (entry: import('@minhajna/core').CalendarEntry) => {
    if (id !== undefined) navigation.goBack();
    else navigation.replace('CalendarEntry', { id: entry.id, origin: 'local', schoolId: entry.schoolId ?? schoolId });
  };
  if (old?.effect === 'adds-sessions') return <AddSessions entryId={id} schoolId={schoolId} onDone={done} />;
  if (old?.effect === 'rotating-groups') return <Groups schoolId={schoolId} old={old} onSaved={done} />;
  if (old !== undefined && old !== null && isWeekReset(old))
    return <AbReset schoolId={schoolId} old={old} onSaved={done} />;
  if (old?.confirmedFrom !== undefined)
    return <Lunar base={data.calendar.find((one) => one.id === old.id)!} onSaved={done} />;
  return (
    <CalendarForm
      key={id ?? 'new'}
      schoolId={schoolId}
      old={old ?? undefined}
      onSaved={done}
      onAddDay={(next) => navigation.replace('AddSessions', { schoolId: next, calendar: true })}
      onAddReset={(next) => navigation.replace('CalendarAb', { schoolId: next })}
    />
  );
}

function CalendarAbScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CalendarAb'>) {
  const data = useAppData();
  const t = useText();
  const { schoolId } = route.params;
  if (!data.state.schools.has(schoolId)) return <Text>{t('calendarView.edit.readOnly')}</Text>;
  return (
    <AbReset
      schoolId={schoolId}
      onSaved={(entry) => navigation.replace('CalendarEntry', { id: entry.id, origin: 'local', schoolId })}
    />
  );
}

function CalendarGroupsScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CalendarGroups'>) {
  const data = useAppData();
  const t = useText();
  const { schoolId } = route.params;
  if (!data.state.schools.has(schoolId)) return <Text>{t('calendarView.edit.readOnly')}</Text>;
  return (
    <Groups
      schoolId={schoolId}
      onSaved={(entry) => navigation.replace('CalendarEntry', { id: entry.id, origin: 'local', schoolId })}
    />
  );
}

function CalendarLunarScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CalendarLunar'>) {
  const data = useAppData();
  const t = useText();
  const { id, schoolId } = route.params;
  const base = data.calendar.find((entry) => entry.id === id);
  const inScope = schoolEntries(data, schoolId).some((one) => one.entry.id === id);
  const title = base === undefined ? null : t(lunarText(base, 'open'));
  useLayoutEffect(() => {
    if (title !== null) navigation.setOptions({ title });
  }, [navigation, title]);
  if (!inScope || base === undefined || !isLunarHoliday(base)) return <Text>{t('calendarView.edit.readOnly')}</Text>;
  return <Lunar base={base} onSaved={() => navigation.popTo('CalendarEntry', { id, origin: 'local', schoolId })} />;
}

function CalendarReceiveScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CalendarReceive'>) {
  const data = useAppData();
  const t = useText();
  const { schoolId } = route.params;
  if (!data.state.schools.has(schoolId)) return <Text>{t('calendarView.edit.readOnly')}</Text>;
  return (
    <Receive
      schoolId={schoolId}
      onIgnore={() => navigation.goBack()}
      onSaved={(entry, selectedSchool) =>
        navigation.replace('CalendarEntry', { id: entry.id, origin: 'local', schoolId: selectedSchool })
      }
    />
  );
}

function ImportUpdateScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ImportUpdate'>) {
  return (
    <ImportUpdate
      onApplied={(release) => navigation.replace('CalendarUpdate', { release })}
      onReport={() => navigation.navigate('Help')}
      onPlan={(courseId) => navigation.navigate('ClassPlan', { courseId })}
    />
  );
}

function CalendarUpdateScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CalendarUpdate'>) {
  return (
    <UpdateChanges
      release={route.params.release}
      onCalendar={() => navigation.popTo('Calendar')}
      onPlan={(courseId) => navigation.navigate('ClassPlan', { courseId })}
    />
  );
}

/** Register actual Screen elements so the root navigator stays within its file-size limit. */
export function calendarRoutes(
  Stack: ReturnType<typeof createNativeStackNavigator<RootStackParamList>>,
  t: ReturnType<typeof useText>,
) {
  return (
    <>
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: t('calendarView.title'), statusBarStyle: 'dark' }}
      />
      <Stack.Screen
        name="CalendarEntry"
        component={CalendarEntryScreen}
        options={{ title: t('calendarView.details'), statusBarStyle: 'dark' }}
      />
      <Stack.Screen
        name="CalendarEdit"
        component={CalendarEditScreen}
        options={({ route }) => ({
          title: t(route.params.id === undefined ? 'calendarView.edit.add' : 'calendarView.edit.edit'),
          statusBarStyle: 'dark',
        })}
      />
      <Stack.Screen
        name="CalendarAb"
        component={CalendarAbScreen}
        options={{ title: t('calendarView.abEdit.open'), statusBarStyle: 'dark' }}
      />
      <Stack.Screen
        name="CalendarLunar"
        component={CalendarLunarScreen}
        options={{ title: t('calendarView.lunarEdit.open'), statusBarStyle: 'dark' }}
      />
      <Stack.Screen
        name="CalendarGroups"
        component={CalendarGroupsScreen}
        options={{ title: t('calendarView.groups.open'), statusBarStyle: 'dark' }}
      />
      <Stack.Screen
        name="CalendarReceive"
        component={CalendarReceiveScreen}
        options={{ title: t('calendarView.receive.open'), statusBarStyle: 'dark' }}
      />
      <Stack.Screen
        name="ImportUpdate"
        component={ImportUpdateScreen}
        options={{ title: t('calendarView.update.open'), statusBarStyle: 'dark' }}
      />
      <Stack.Screen
        name="CalendarUpdate"
        component={CalendarUpdateScreen}
        options={{ title: t('calendarView.update.changed.title'), statusBarStyle: 'dark' }}
      />
    </>
  );
}
