// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The setup steps as stack screens: each one says where its buttons lead.
// Setup is two steps, the school and the card, then Setup-7-Ready (answer
// 808): classes, the week and the plan arrive from the school.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ready } from '../ready/Ready';
import { Card } from '../setup/Card';
import { Teaching } from '../setup/Teaching';
import { CrashSheet } from '../help/CrashSheet';
import { useLockStorage } from '../lock/lock-storage';
import { Restore } from '../restore/Restore';
import { useReopen } from '../restore/reopen';
import { useAppData } from '../storage/AppData';
import { Welcome } from './Welcome';
import { PrivacyNotice } from '../help/PrivacyNotice';
import type { RootStackParamList } from './AppNavigator';

/** Setup's first step, which leads to the card. */
export function TeachingScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Teaching'>) {
  return <Teaching onNext={() => navigation.navigate('Card')} />;
}

/**
 * Setup's second and last step; it records that setup is finished, once, so the app opens on Today from then on
 * (#183), and leads to Setup-7-Ready.
 */
export function CardScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Card'>) {
  const data = useAppData();
  return (
    <Card
      onSignature={() => navigation.navigate('SettingsSignature')}
      onNext={() => {
        if (!data.state.setupFinished) data.record({ kind: 'setup.finished' });
        navigation.navigate('Ready');
      }}
    />
  );
}

/** The end of setup; «إلى صفحة اليوم» opens the tabs, with nothing to go back to. */
export function ReadyScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Ready'>) {
  return (
    <Ready
      onDone={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
      onCheck={(courseId) => navigation.navigate('SeptCheck', { courseId })}
    />
  );
}

/**
 * The welcome leads to the notice, for setup; Back from the notice returns
 * here. While the history is still empty, its settings page also leads to the
 * restore (#247, answer 800). It offers a crash report kept before setup was
 * finished or a first statement was kept (#460).
 */
export function WelcomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  const { entries } = useAppData();
  return (
    <>
      <CrashSheet />
      <Welcome
        lockSet
        onStart={() => navigation.navigate('Privacy')}
        onRestore={entries().length === 0 ? () => navigation.navigate('Restore') : undefined}
      />
    </>
  );
}

/** The restore; once everything is stored, the history opens again, on Today. */
export function RestoreScreen() {
  return <Restore storage={useLockStorage()} onRestored={useReopen()} />;
}

/** «استلام النسخة»: the working copy back from the other device (answers 514 and 515). */
export function TakeBackScreen() {
  return <Restore back storage={useLockStorage()} onRestored={useReopen()} />;
}

/**
 * The first-use notice leads to setup without recording that it was read, or
 * to reader mode's home, which then has no way back to the welcome.
 */
export function FirstNotice({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Privacy'>) {
  return (
    <PrivacyNotice
      onAccept={() =>
        route.params?.reader === true
          ? navigation.reset({ index: 0, routes: [{ name: 'ReaderHome' }] })
          : navigation.navigate('Teaching')
      }
      onConnections={() => navigation.navigate('Connections')}
    />
  );
}

/** The same notice, from Help or Settings. */
export function HelpNotice({ navigation }: NativeStackScreenProps<RootStackParamList, 'PrivacyNotice'>) {
  return <PrivacyNotice onConnections={() => navigation.navigate('Connections')} />;
}
