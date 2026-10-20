// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../setup/Card';
import { Classes } from '../setup/Classes';
import { Teaching } from '../setup/Teaching';
import { Week } from '../setup/Week';
import { Language } from '../settings/Language';
import { Lengths } from '../settings/Lengths';
import { Plans } from '../settings/Plans';
import { Settings, type SettingTarget } from '../settings/Settings';
import { Times } from '../times/Times';
import type { RootStackParamList } from './routes';

/** Settings use their own routes, so leaving an editor returns here rather than continuing setup. */
export function SettingsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Settings'>) {
  const open = (target: SettingTarget, schoolId?: string) => {
    switch (target) {
      case 'card':
        navigation.navigate('SettingsCard');
        break;
      case 'schools':
        navigation.navigate('SettingsSchools');
        break;
      case 'classes':
        navigation.navigate('SettingsClasses');
        break;
      case 'week':
        navigation.navigate('SettingsWeek');
        break;
      case 'times':
        navigation.navigate('Times', { schoolId });
        break;
      case 'plans':
        navigation.navigate('SettingsPlans', { schoolId });
        break;
      case 'lengths':
        navigation.navigate('SettingsLengths');
        break;
      case 'language':
        navigation.navigate('Language');
        break;
      case 'rules':
        navigation.navigate('RollRules');
        break;
      case 'print':
        navigation.navigate('PrintWeek');
        break;
      case 'security':
        navigation.navigate('Security');
        break;
      case 'help':
        navigation.navigate('Help');
        break;
      case 'privacy':
        navigation.navigate('PrivacyNotice');
        break;
    }
  };
  return <Settings onOpen={open} />;
}

/** The teacher card, saved as it is edited, without resetting setup or the navigation stack. */
export function SettingsCardScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SettingsCard'>) {
  return <Card editing onNext={() => navigation.goBack()} />;
}

/** Schools can be added or corrected; a school that owns records is not erased here. */
export function SettingsSchoolsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SettingsSchools'>) {
  return <Teaching editing onNext={() => navigation.goBack()} />;
}

/** Class lists and additions remain the existing editors, not a new copy of their storage logic. */
export function SettingsClassesScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SettingsClasses'>) {
  return (
    <Classes
      editing
      onType={(schoolClass) => navigation.navigate('TypeList', { classId: schoolClass.id, name: schoolClass.name })}
      onNext={() => navigation.goBack()}
    />
  );
}

/** A new timetable version starts from its own effective day; recorded sessions are not rebuilt. */
export function SettingsWeekScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SettingsWeek'>) {
  return (
    <Week
      editing
      onDraw={() => navigation.navigate('WeekDraw')}
      onResolve={(slot) => navigation.navigate('WeekDraw', { slot })}
      onTimes={() => navigation.navigate('Times')}
      onNext={() => navigation.goBack()}
    />
  );
}

/** School-specific pack choices keep the other school's pins out of the chooser. */
export function SettingsPlansScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'SettingsPlans'>) {
  return (
    <Plans
      schoolId={route.params?.schoolId}
      onChoose={(grade, subject, schoolId) => navigation.navigate('Packs', { grade, subject, schoolId })}
    />
  );
}

/** Session-length references link to the school's editable bell times. */
export function SettingsLengthsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SettingsLengths'>) {
  return <Lengths onTimes={() => navigation.navigate('Times')} />;
}

/** Language changes need no lesson record; changing direction restarts the interface. */
export function LanguageScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Language'>) {
  return <Language onDone={() => navigation.goBack()} />;
}

/** Bell times may open already scoped to a school. */
export function TimesScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Times'>) {
  return <Times schoolId={route.params?.schoolId} />;
}
