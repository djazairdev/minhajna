// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The documents as navigation routes (#212): the Documents tab, and a
// document's output above the tabs.

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { documentKind } from '../documents/catalogue';
import { DocumentOutput } from '../documents/DocumentOutput';
import { DocumentsTab } from '../documents/DocumentsTab';
import type { HomeTabParamList, RootStackParamList } from './AppNavigator';

/** The Documents tab. */
export function DocumentsTabScreen({
  navigation,
}: CompositeScreenProps<
  BottomTabScreenProps<HomeTabParamList, 'Documents'>,
  NativeStackScreenProps<RootStackParamList>
>) {
  return <DocumentsTab onOpen={(id) => navigation.navigate('DocOutput', { id })} />;
}

/** A document's output; a document this version does not make shows nothing. */
export function DocOutputScreen({ route }: NativeStackScreenProps<RootStackParamList, 'DocOutput'>) {
  const kind = documentKind(route.params.id);
  return kind === undefined ? null : <DocumentOutput kind={kind} />;
}
