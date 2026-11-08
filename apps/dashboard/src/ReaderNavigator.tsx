// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's navigator in the dashboard (answer 856), built from the
// teacher app's shared stack with reader mode's routes only: the privacy
// notice in reader mode, which leads to the reader's home with nothing behind
// it; the reader's routes, with a home that goes back to the dashboard and
// offers Settings, and the crash report kept before the last stop; and the
// small Settings with what it opens. There is no setup and no Help. Back on a
// first screen with nothing behind it goes back to the dashboard too. The
// browser's tab keeps the dashboard's name, rather than the screen's.

import {
  usePreventRemove,
  useNavigationContainerRef,
  type InitialState,
  type NavigationState,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackHeaderProps,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useState } from 'react';
import { I18nManager, Platform, Text } from 'react-native';
import { CrashSheet } from '../../android/src/help/CrashSheet';
import { Connections, PrivacyNotice } from '../../android/src/help/PrivacyNotice';
import { useLockStorage } from '../../android/src/lock/lock-storage';
import { LockPinScreen, SecurityScreen } from '../../android/src/navigation/LockScreens';
import { readerRoutes } from '../../android/src/navigation/ReaderScreens';
import type { RootStackParamList } from '../../android/src/navigation/routes';
import { StackBar, barSubtitle } from '../../android/src/navigation/StackBar';
import { ReaderPicture } from '../../android/src/reader/ReaderPicture';
import { EraseDevice } from '../../android/src/settings/EraseDevice';
import { Language } from '../../android/src/settings/Language';
import { StackApp } from '../../android/src/shell/StackApp';
import { useReaderConnections, useReaderNotice } from './reader-notice';
import { useSavedLeave } from './reader-leave';
import { ReaderSettings, type ReaderTarget } from './ReaderSettings';
import { ReaderStrip } from './ReaderStrip';
import { useDashboardText } from './text';
import { useDeviceText } from '../../android/src/text/device-text';

type Props<Route extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Route>;

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Where each settings row leads. */
const TARGETS = {
  security: 'Security',
  language: 'Language',
  erase: 'SettingsErase',
  privacy: 'PrivacyNotice',
} as const satisfies Record<ReaderTarget, keyof RootStackParamList>;

/** The bar, with Back to the dashboard on a first screen, and the lines under the notice's and the lock's titles. */
function ReaderBar(props: NativeStackHeaderProps) {
  const t = useDeviceText();
  const { leave, failed } = useSavedLeave();
  const { route, navigation } = props;
  const line =
    route.name === 'Privacy'
      ? t('privacy.subtitle')
      : route.name === 'Security'
        ? t(Platform.OS === 'web' ? 'security.web.subtitle' : 'security.subtitle')
        : null;
  return (
    <StackBar
      {...props}
      onBack={navigation.canGoBack() ? undefined : leave}
      subtitle={
        <>
          {line !== null && <Text style={barSubtitle}>{line}</Text>}
          {failed && (
            <Text testID="reader-leave-failed" accessibilityRole="alert" style={barSubtitle}>
              {t('settings.failed')}
            </Text>
          )}
        </>
      }
    />
  );
}

/** The notice in reader mode; accepting it opens the reader's home, with nothing behind it. */
function FirstNotice({ navigation }: Props<'Privacy'>) {
  return (
    <PrivacyNotice
      onAccept={() => navigation.reset({ index: 0, routes: [{ name: 'ReaderHome' }] })}
      onConnections={() => navigation.navigate('Connections')}
      texts={useReaderNotice()}
    />
  );
}

/** The same notice, from Settings. */
function NoticeAgain({ navigation }: Props<'PrivacyNotice'>) {
  return <PrivacyNotice onConnections={() => navigation.navigate('Connections')} texts={useReaderNotice()} />;
}

/** What the dashboard connects to, and why. */
function ReaderConnections() {
  return <Connections paragraphs={useReaderConnections()} />;
}

/** The school's picture as the reader's home, under the way back to the dashboard. */
function ReaderHome({ navigation }: Props<'ReaderHome'>) {
  const { leave, failed } = useSavedLeave();
  return (
    <>
      <ReaderStrip onLeave={leave} failed={failed} />
      <CrashSheet />
      <ReaderPicture
        onOpen={(id) => navigation.navigate('ReaderOpen', id === undefined ? undefined : { id })}
        onList={() => navigation.navigate('ReaderList')}
        onMerge={(grade) => navigation.navigate('ReaderMerge', { grade })}
        home={{ onSettings: () => navigation.navigate('Settings') }}
      />
    </>
  );
}

/** Reader mode's settings. */
function SettingsScreen({ navigation }: Props<'Settings'>) {
  return <ReaderSettings onOpen={(target) => navigation.navigate(TARGETS[target])} />;
}

/** The interface's language; a change of direction reloads the page, on the dashboard's home. */
function LanguageScreen({ navigation }: Props<'Language'>) {
  return <Language onDone={() => navigation.goBack()} />;
}

/** Erasing this PC, with no export; the screen stays while an erase runs. */
function EraseScreen() {
  const storage = useLockStorage();
  const [busy, setBusy] = useState(false);
  usePreventRemove(busy, () => undefined);
  return <EraseDevice storage={storage} onBusy={setBusy} />;
}

/** The reader's stack, from the state the shell gives. */
export function ReaderNavigator({
  initialState,
  onAction,
  onStateChange,
}: {
  readonly initialState?: InitialState;
  readonly onAction: () => void;
  readonly onStateChange: (state: NavigationState | undefined) => void;
}) {
  const t = useDeviceText();
  const dashboard = useDashboardText();
  const navigation = useNavigationContainerRef<RootStackParamList>();
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <StackApp
      Stack={Stack}
      navigation={navigation}
      bar={ReaderBar}
      direction={I18nManager.isRTL ? 'rtl' : 'ltr'}
      initialRouteName="ReaderHome"
      initialState={initialState}
      onAction={onAction}
      onStateChange={onStateChange}
      documentTitle={{ enabled: false }}
    >
      <Stack.Screen name="Privacy" component={FirstNotice} options={dark(t('privacy.title'))} />
      {readerRoutes(Stack, t, ReaderHome)}
      <Stack.Screen name="Settings" component={SettingsScreen} options={dark(t('settings.title'))} />
      <Stack.Screen name="Security" component={SecurityScreen} options={dark(t('security.title'))} />
      <Stack.Screen name="LockPin" component={LockPinScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Language" component={LanguageScreen} options={dark(t('settings.rows.language'))} />
      <Stack.Screen name="SettingsErase" component={EraseScreen} options={dark(t('settings.eraseDevice.erase'))} />
      <Stack.Screen name="PrivacyNotice" component={NoticeAgain} options={dark(t('privacy.helpTitle'))} />
      <Stack.Screen
        name="Connections"
        component={ReaderConnections}
        options={dark(dashboard('dashboard.reader.connections.title'))}
      />
    </StackApp>
  );
}
