// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawnSignature } from '../drawn/DrawnSignature';
import { Card } from '../setup/Card';
import { Classes } from '../setup/Classes';
import { Teaching } from '../setup/Teaching';
import { Week } from '../setup/Week';
import { Log } from '../log/Log';
import { Language } from '../settings/Language';
import { Lengths } from '../settings/Lengths';
import { Notify } from '../settings/Notify';
import { Plans } from '../settings/Plans';
import { Devices } from '../settings/Devices';
import { EraseDevice } from '../settings/EraseDevice';
import { ExportAll } from '../settings/ExportAll';
import { useLockStorage } from '../lock/lock-storage';
import { RecoverySheet } from '../settings/RecoverySheet';
import { Transfer } from '../settings/Transfer';
import { Retention } from '../settings/Retention';
import { Settings, type SettingTarget } from '../settings/Settings';
import { Times } from '../times/Times';
import type { useText } from '../text/i18n';
import type { RootStackParamList } from './routes';

/** Settings use their own routes, so leaving an editor returns here rather than continuing setup. */
export function SettingsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Settings'>) {
  const open = (target: SettingTarget, id?: string) => {
    switch (target) {
      case 'calendar':
        navigation.navigate('Calendar');
        break;
      case 'updates':
        navigation.navigate('ImportUpdate');
        break;
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
        navigation.navigate('Times', { schoolId: id });
        break;
      case 'plans':
        navigation.navigate('SettingsPlans', { schoolId: id });
        break;
      case 'lengths':
        navigation.navigate('SettingsLengths');
        break;
      case 'language':
        navigation.navigate('Language');
        break;
      case 'notifications':
        navigation.navigate('SettingsNotify');
        break;
      case 'rules':
        navigation.navigate('RollRules');
        break;
      case 'print':
        navigation.navigate('PrintWeek');
        break;
      case 'signature':
        navigation.navigate('SettingsSignature');
        break;
      case 'security':
        navigation.navigate('Security');
        break;
      case 'log':
        navigation.navigate('Log');
        break;
      case 'export':
        navigation.navigate('SettingsExport');
        break;
      case 'retention':
        navigation.navigate('SettingsRetention');
        break;
      case 'erase':
        navigation.navigate('SettingsErase');
        break;
      case 'backup':
        navigation.navigate('SettingsDevices');
        break;
      case 'help':
        navigation.navigate('Help');
        break;
      case 'privacy':
        navigation.navigate('PrivacyNotice');
        break;
      case 'statement':
        if (id !== undefined) navigation.navigate('Statement', { courseId: id });
        break;
    }
  };
  return <Settings onOpen={open} />;
}

/** «الأجهزة والنسخ»: the first backup starts here once its sheet was confirmed (answer 478). */
export function SettingsDevicesScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'SettingsDevices'>) {
  return (
    <Devices
      onTransfer={() => navigation.navigate('SettingsTransfer')}
      onSheet={(first) => navigation.navigate('SettingsRecovery', { first })}
      backupNow={route.params?.backup === true}
      onBackupStarted={() => navigation.setParams({ backup: false })}
    />
  );
}

/** «نقل مباشر»: the transfer file and its one-time key, which live while this screen is open. */
export function SettingsTransferScreen() {
  return <Transfer storage={useLockStorage()} />;
}

/** «ورقة الاسترجاع»: once a first sheet is confirmed, back to the devices page, where its backup starts. */
export function SettingsRecoveryScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'SettingsRecovery'>) {
  const storage = useLockStorage();
  const { first } = route.params;
  return (
    <RecoverySheet
      storage={storage}
      first={first}
      onConfirmed={() => (first ? navigation.popTo('SettingsDevices', { backup: true }) : navigation.goBack())}
    />
  );
}

/** «مسح هذا الجهاز», with the storage module the app opened its history with (answer 477). */
export function SettingsEraseScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SettingsErase'>) {
  const storage = useLockStorage();
  return <EraseDevice storage={storage} onExport={() => navigation.navigate('SettingsExport')} />;
}

/** The teacher card, saved as it is edited, without resetting setup or the navigation stack. */
export function SettingsCardScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SettingsCard'>) {
  return (
    <Card editing onSignature={() => navigation.navigate('SettingsSignature')} onNext={() => navigation.goBack()} />
  );
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
      onChoose={(grade, subject, schoolId, classId) =>
        navigation.navigate('Packs', { grade, subject, schoolId, classId })
      }
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

/** The settings' own screens, for the app's navigator. */
export function settingsRoutes(
  Stack: ReturnType<typeof createNativeStackNavigator<RootStackParamList>>,
  t: ReturnType<typeof useText>,
) {
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <>
      <Stack.Screen name="SettingsCard" component={SettingsCardScreen} options={dark(t('settings.rows.card'))} />
      <Stack.Screen
        name="SettingsSchools"
        component={SettingsSchoolsScreen}
        options={dark(t('settings.rows.schools'))}
      />
      <Stack.Screen
        name="SettingsClasses"
        component={SettingsClassesScreen}
        options={dark(t('settings.rows.classes'))}
      />
      <Stack.Screen name="SettingsWeek" component={SettingsWeekScreen} options={dark(t('settings.rows.week'))} />
      <Stack.Screen name="SettingsPlans" component={SettingsPlansScreen} options={dark(t('settings.rows.plans'))} />
      <Stack.Screen
        name="SettingsLengths"
        component={SettingsLengthsScreen}
        options={dark(t('settings.rows.lengths'))}
      />
      <Stack.Screen name="Language" component={LanguageScreen} options={dark(t('settings.rows.language'))} />
      <Stack.Screen name="SettingsNotify" component={Notify} options={dark(t('settings.rows.notifications'))} />
      <Stack.Screen name="SettingsSignature" component={DrawnSignature} options={dark(t('settings.rows.signature'))} />
      <Stack.Screen name="Log" component={Log} options={dark(t('settings.rows.log'))} />
      <Stack.Screen name="SettingsExport" component={ExportAll} options={dark(t('settings.rows.export'))} />
      <Stack.Screen name="SettingsErase" component={SettingsEraseScreen} options={dark(t('settings.rows.erase'))} />
      <Stack.Screen
        name="SettingsDevices"
        component={SettingsDevicesScreen}
        options={dark(t('settings.rows.backup'))}
      />
      <Stack.Screen
        name="SettingsRecovery"
        component={SettingsRecoveryScreen}
        options={dark(t('settings.recovery.title'))}
      />
      <Stack.Screen
        name="SettingsTransfer"
        component={SettingsTransferScreen}
        options={dark(t('settings.transfer.title'))}
      />
      <Stack.Screen name="SettingsRetention" component={Retention} options={dark(t('settings.rows.retention'))} />
    </>
  );
}
