// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The documents as navigation routes (#212): the Documents tab, a
// document's output above the tabs, and «طباعة الأسبوع» (#215). The
// roll-call book opens Roll-print (#217), «المذكرات» a lesson note and
// «التوزيعات» its screen, which prints in the tab it shows (#237). In a pilot
// build, the tab's last row opens «توقيتاتي» (#220).

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseDay } from '@minhajna/core';
import { BookFixes } from '../book/BookFixes';
import { Dist } from '../distributions/Dist';
import { documentKind } from '../documents/catalogue';
import { DocumentOutput } from '../documents/DocumentOutput';
import { DocumentsTab } from '../documents/DocumentsTab';
import { PrintWeek } from '../documents/PrintWeek';
import { PilotTimings } from '../pilot/PilotTimings';
import { useTimingStore } from '../pilot/timing-store';
import type { HomeTabParamList, RootStackParamList } from './AppNavigator';

/** The Documents tab. */
export function DocumentsTabScreen({
  navigation,
}: CompositeScreenProps<
  BottomTabScreenProps<HomeTabParamList, 'Documents'>,
  NativeStackScreenProps<RootStackParamList>
>) {
  return (
    <DocumentsTab
      onOpen={(id) =>
        id === 'roll'
          ? navigation.navigate('RollPrint')
          : id === 'distributions'
            ? navigation.navigate('Dist')
            : navigation.navigate('DocOutput', { id })
      }
      onPrintWeek={() => navigation.navigate('PrintWeek')}
      onFixes={() => navigation.navigate('BookFixes')}
      onNote={(key, day) => navigation.navigate('Note', { key, day })}
      onTimings={() => navigation.navigate('PilotTimings')}
    />
  );
}

/** «تصحيحات دفتر النصوص», above the tabs, on the month and class given. */
export function BookFixesScreen({ route }: NativeStackScreenProps<RootStackParamList, 'BookFixes'>) {
  return <BookFixes {...route.params} />;
}

/** «التوزيعات», above the tabs, on the class and subject given; its button opens the output in the tab shown. */
export function DistScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Dist'>) {
  const courseId = route.params?.courseId;
  return (
    <Dist
      {...(courseId !== undefined && { courseId })}
      onPrint={(layout, day) => navigation.navigate('DocOutput', { id: 'distributions', layout, day })}
    />
  );
}

/** «توقيتاتي في التجربة», above the tabs; nothing outside a pilot build. */
export function PilotTimingsScreen() {
  const store = useTimingStore();
  return store === null ? null : <PilotTimings store={store} />;
}

/** «طباعة الأسبوع», above the tabs. */
export function PrintWeekScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'PrintWeek'>) {
  return <PrintWeek onSignature={() => navigation.navigate('SettingsSignature')} />;
}

/** A document's output, for the month of the day given, if any; a document this version does not make shows nothing. */
export function DocOutputScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'DocOutput'>) {
  const kind = documentKind(route.params.id);
  const { day, layout } = route.params;
  return kind === undefined ? null : (
    <DocumentOutput
      kind={kind}
      {...(day !== undefined && { day: parseDay(day) })}
      {...(layout !== undefined && { layout })}
      onSignature={() => navigation.navigate('SettingsSignature')}
    />
  );
}
