// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The setup steps as stack screens: each one says where its buttons lead.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Packs } from '../plan/Packs';
import { Ready } from '../ready/Ready';
import { Card } from '../setup/Card';
import { Classes } from '../setup/Classes';
import { Plan } from '../setup/Plan';
import { Teaching } from '../setup/Teaching';
import { TypeList } from '../setup/TypeList';
import { Week } from '../setup/Week';
import { useAppData } from '../storage/AppData';
import { WeekDraw } from '../week/WeekDraw';
import { Welcome } from './Welcome';
import { PrivacyNotice } from '../help/PrivacyNotice';
import type { RootStackParamList } from './AppNavigator';

/** Setup's first step, which leads to the card. */
export function TeachingScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Teaching'>) {
  return <Teaching onNext={() => navigation.navigate('Card')} />;
}

/** Setup's second step, which leads to the classes. */
export function CardScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Card'>) {
  return <Card onNext={() => navigation.navigate('Classes')} />;
}

/** Setup's third step, which leads to the week. */
export function ClassesScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Classes'>) {
  return (
    <Classes
      onType={(schoolClass) => navigation.navigate('TypeList', { classId: schoolClass.id, name: schoolClass.name })}
      onNext={() => navigation.navigate('Week')}
    />
  );
}

/** Setup's fourth step; it leads to the plan. */
export function WeekScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Week'>) {
  return (
    <Week
      onDraw={() => navigation.navigate('WeekDraw')}
      onResolve={(slot) => navigation.navigate('WeekDraw', { slot })}
      onTimes={() => navigation.navigate('Times')}
      onNext={() => navigation.navigate('Plan')}
    />
  );
}

/**
 * Setup's last step; it leads to Setup-7-Ready. Finishing is recorded once,
 * so the app opens on Today from then on (#183).
 */
export function PlanScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Plan'>) {
  const data = useAppData();
  return (
    <Plan
      onChange={(group) => navigation.navigate('Packs', { grade: group.grade, subject: group.subject })}
      onFinish={() => {
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

/** A grade and subject's packs; pinning or cancelling returns to the plan. */
export function PacksScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Packs'>) {
  return (
    <Packs
      grade={route.params.grade}
      subject={route.params.subject}
      schoolId={route.params.schoolId}
      classId={route.params.classId}
      onDone={() => navigation.goBack()}
    />
  );
}

/** Drawing the week by hand, with a slot already open when one is given; «حفظ الأسبوع» returns. */
export function WeekDrawScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'WeekDraw'>) {
  return <WeekDraw openAt={route.params?.slot} onDone={() => navigation.goBack()} />;
}

/** A class's list, typed by hand; «حفظ القائمة» returns to the classes. */
export function TypeListScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'TypeList'>) {
  return <TypeList classId={route.params.classId} onDone={() => navigation.goBack()} />;
}

/** The welcome leads to the notice; Back from the notice returns here. */
export function WelcomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  return <Welcome lockSet onStart={() => navigation.navigate('Privacy')} />;
}

/** The first-use notice leads to setup without recording that it was read. */
export function FirstNotice({ navigation }: NativeStackScreenProps<RootStackParamList, 'Privacy'>) {
  return (
    <PrivacyNotice
      onAccept={() => navigation.navigate('Teaching')}
      onConnections={() => navigation.navigate('Connections')}
    />
  );
}

/** The same notice, from Help or Settings. */
export function HelpNotice({ navigation }: NativeStackScreenProps<RootStackParamList, 'PrivacyNotice'>) {
  return <PrivacyNotice onConnections={() => navigation.navigate('Connections')} />;
}
