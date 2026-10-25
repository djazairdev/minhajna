// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's screens, as routes (#246, answer 489): the statements
// received, and opening one, a new one or one kept. `readerRoutes` gives the
// navigator their entries, as `planRoutes` does.

import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ReaderList } from '../reader/ReaderList';
import { ReaderOpen } from '../reader/ReaderOpen';
import type { useText } from '../text/i18n';
import type { RootStackParamList } from './routes';

/** The statements received; one opens as it was checked, and «فتح بيان» opens another. */
export function ReaderListScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ReaderList'>) {
  return <ReaderList onOpen={(id) => navigation.navigate('ReaderOpen', id === undefined ? undefined : { id })} />;
}

/** A statement opened and checked, or one kept; back to the list, which is under it or comes in its place. */
export function ReaderOpenScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ReaderOpen'>) {
  const id = route.params?.id;
  return <ReaderOpen {...(id !== undefined && { id })} onList={() => navigation.popTo('ReaderList')} />;
}

type Stack = ReturnType<typeof createNativeStackNavigator<RootStackParamList>>;

/** Reader mode's routes, for the app's navigator. */
export function readerRoutes(Stack: Stack, t: ReturnType<typeof useText>) {
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <>
      <Stack.Screen name="ReaderList" component={ReaderListScreen} options={dark(t('reader.title'))} />
      <Stack.Screen name="ReaderOpen" component={ReaderOpenScreen} options={dark(t('reader.open'))} />
    </>
  );
}
