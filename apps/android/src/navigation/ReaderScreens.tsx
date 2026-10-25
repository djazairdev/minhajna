// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's screens, as routes (#246, answers 489 and 490): the statements
// received, opening one, a new one or one kept, its spot-check sheet, and the
// school's picture, also as the home of a reader who started from the welcome,
// with no back to it. `readerRoutes` gives the navigator their entries, as
// `planRoutes` does.

import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ReaderList } from '../reader/ReaderList';
import { ReaderOpen } from '../reader/ReaderOpen';
import { ReaderPicture } from '../reader/ReaderPicture';
import { ReaderSpot } from '../reader/ReaderSpot';
import type { useText } from '../text/i18n';
import type { RootStackParamList } from './routes';

/**
 * The statements received; one opens as it was checked, «فتح بيان» opens another, and the picture shows them all,
 * back on the reader's home when it is under the list.
 */
export function ReaderListScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ReaderList'>) {
  return (
    <ReaderList
      onOpen={(id) => navigation.navigate('ReaderOpen', id === undefined ? undefined : { id })}
      onPicture={() =>
        navigation.getState().routes.some((route) => route.name === 'ReaderHome')
          ? navigation.popTo('ReaderHome')
          : navigation.navigate('ReaderPicture')
      }
    />
  );
}

/** A statement's spot-check sheet, with days drawn as it opens. */
export function ReaderSpotScreen({ route }: NativeStackScreenProps<RootStackParamList, 'ReaderSpot'>) {
  return <ReaderSpot id={route.params.id} />;
}

/** The school's picture; a cell opens its statement. */
export function ReaderPictureScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ReaderPicture'>) {
  return (
    <ReaderPicture
      onOpen={(id) => navigation.navigate('ReaderOpen', id === undefined ? undefined : { id })}
      onList={() => navigation.popTo('ReaderList')}
    />
  );
}

/** The picture as a reader's home, with Settings, Help and setting the app up for teaching. */
export function ReaderHomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ReaderHome'>) {
  return (
    <ReaderPicture
      onOpen={(id) => navigation.navigate('ReaderOpen', id === undefined ? undefined : { id })}
      onList={() => navigation.navigate('ReaderList')}
      home={{
        onSettings: () => navigation.navigate('Settings'),
        onHelp: () => navigation.navigate('Help'),
        onTeach: () => navigation.navigate('Teaching'),
      }}
    />
  );
}

/** A statement opened and checked, or one kept; back to the list, which is under it or comes in its place. */
export function ReaderOpenScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ReaderOpen'>) {
  const id = route.params?.id;
  return (
    <ReaderOpen
      {...(id !== undefined && { id })}
      onList={() => navigation.popTo('ReaderList')}
      onSpot={(spot) => navigation.navigate('ReaderSpot', { id: spot })}
    />
  );
}

type Stack = ReturnType<typeof createNativeStackNavigator<RootStackParamList>>;

/** Reader mode's routes, for the app's navigator. */
export function readerRoutes(Stack: Stack, t: ReturnType<typeof useText>) {
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <>
      <Stack.Screen name="ReaderList" component={ReaderListScreen} options={dark(t('reader.title'))} />
      <Stack.Screen name="ReaderOpen" component={ReaderOpenScreen} options={dark(t('reader.open'))} />
      <Stack.Screen name="ReaderPicture" component={ReaderPictureScreen} options={dark(t('reader.picture.title'))} />
      <Stack.Screen name="ReaderSpot" component={ReaderSpotScreen} options={dark(t('reader.spot.title'))} />
      <Stack.Screen
        name="ReaderHome"
        component={ReaderHomeScreen}
        options={{ headerShown: false, statusBarStyle: 'dark' }}
      />
    </>
  );
}
