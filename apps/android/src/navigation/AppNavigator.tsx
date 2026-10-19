// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  useNavigationContainerRef,
  type InitialState,
  type NavigationState,
} from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import StorageCheck from '../debug/StorageCheck';
import { Gallery } from '../gallery/Gallery';
import { samples } from '../gallery/samples';
import { currentLanguage, useText } from '../text/i18n';
import { BottomNav, TopBar, theme } from './NavigationChrome';
import { RollRules } from '../roll/RollRules';
import {
  ClassPlanScreen,
  TestScheduleScreen,
  ExamWindowScreen,
  DutyScreen,
  AddSessionsScreen,
  ExtraScreen,
  ClassesTabScreen,
  CorrectScreen,
  EntryScreen,
  PupilMoveScreen,
  RollScreen,
  SeatsSetupScreen,
  TextsBookScreen,
  HomeworkScreen,
  TodayTab,
} from './RecordScreens';
import { LockPinScreen, SecurityScreen } from './LockScreens';
import { ClassScreen } from './ClassScreens';
import { PupilScreen, RollMonthScreen, RollPrintScreen } from './RollBookScreens';
import {
  BookFixesScreen,
  DocOutputScreen,
  DocumentsTabScreen,
  PilotTimingsScreen,
  PrintWeekScreen,
} from './DocumentScreens';
import { documentKind } from '../documents/catalogue';
import { Welcome } from './Welcome';
import {
  CardScreen,
  ClassesScreen,
  PacksScreen,
  PlanScreen,
  ReadyScreen,
  TeachingScreen,
  TypeListScreen,
  WeekDrawScreen,
  WeekScreen,
} from './SetupScreens';
import { HelpScreen, LicenceNoticeScreen, LicencesScreen, noticeTitle } from '../help/HelpScreens';
import { Connections, PrivacyNotice } from '../help/PrivacyNotice';
import { Times } from '../times/Times';
import type { HomeTabParamList, RootStackParamList } from './routes';

/** Each tab's label in the catalogue. */
export const tabLabels = {
  Today: 'navigation.today',
  Classes: 'navigation.classes',
  Documents: 'navigation.documents',
} as const satisfies Record<keyof HomeTabParamList, string>;

export type { HomeTabParamList, RootStackParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<HomeTabParamList>();

/** The developer menu's item that opens the gallery, in English like the rest of that menu. */
export const GALLERY_MENU_ITEM = 'Component gallery';
/** The developer menu's item that runs the storage check (#19). */
export const STORAGE_CHECK_MENU_ITEM = 'Storage check';

/** A screen's title over a paper screen, with dark status bar icons. */
const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });

/**
 * Places typed tabs under the native stack so inner screens cover them. In
 * debug builds, the developer menu also opens the component gallery and the
 * storage check. After the app lock, the screens come back as they were,
 * from a state kept in memory only (#210).
 */
export function AppNavigator({
  direction = I18nManager.isRTL ? 'rtl' : 'ltr',
  initialRouteName = 'Welcome',
  initialState,
  onStateChange,
  onAction,
}: {
  direction?: 'rtl' | 'ltr';
  initialRouteName?: 'Welcome' | 'Home';
  initialState?: InitialState;
  onStateChange?: (state: NavigationState | undefined) => void;
  /** Called as each navigation action is sent, before any screen it brings is drawn. */
  onAction?: () => void;
}) {
  const t = useText();
  const navigation = useNavigationContainerRef<RootStackParamList>();
  useEffect(
    () => (onAction === undefined ? undefined : navigation.addListener('__unsafe_action__', onAction)),
    [navigation, onAction],
  );
  useEffect(() => {
    if (!__DEV__) return;
    DevSettings.addMenuItem(GALLERY_MENU_ITEM, () => navigation.navigate('Gallery'));
    DevSettings.addMenuItem(STORAGE_CHECK_MENU_ITEM, () => navigation.navigate('StorageCheck'));
  }, [navigation]);
  return (
    <NavigationContainer
      ref={navigation}
      direction={direction}
      theme={theme}
      initialState={initialState}
      onStateChange={onStateChange}
    >
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ statusBarStyle: 'light', header: (props) => <TopBar {...props} /> }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Privacy"
          component={FirstNotice}
          options={{ title: t('privacy.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="Teaching"
          component={TeachingScreen}
          options={{ title: t('setup.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="Card"
          component={CardScreen}
          options={{ title: t('setup.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="Classes"
          component={ClassesScreen}
          options={{ title: t('setup.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="TypeList"
          component={TypeListScreen}
          options={({ route }) => ({
            title: t('setup.typeTitle', { name: route.params.name }),
            statusBarStyle: 'dark',
          })}
        />
        <Stack.Screen
          name="Week"
          component={WeekScreen}
          options={{ title: t('setup.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="WeekDraw"
          component={WeekDrawScreen}
          options={{ title: t('week.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="Plan"
          component={PlanScreen}
          options={{ title: t('setup.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="Packs"
          component={PacksScreen}
          options={{ title: t('plan.packsTitle'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen name="Ready" component={ReadyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Times" component={Times} options={{ title: t('times.title'), statusBarStyle: 'dark' }} />
        <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false, statusBarStyle: 'dark' }} />
        {__DEV__ && (
          <Stack.Screen
            name="Gallery"
            component={Gallery}
            options={{ title: samples[currentLanguage()].title, statusBarStyle: 'dark' }}
          />
        )}
        {__DEV__ && (
          <Stack.Screen
            name="StorageCheck"
            component={StorageCheck}
            options={{ title: STORAGE_CHECK_MENU_ITEM, statusBarStyle: 'dark' }}
          />
        )}
        <Stack.Screen name="Help" component={HelpScreen} options={{ title: t('help.title'), statusBarStyle: 'dark' }} />
        <Stack.Screen name="Security" component={SecurityScreen} options={dark(t('security.title'))} />
        <Stack.Screen name="LockPin" component={LockPinScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="DocOutput"
          component={DocOutputScreen}
          options={({ route }) => dark(documentKind(route.params.id)?.title(t) ?? '')}
        />
        <Stack.Screen name="PrintWeek" component={PrintWeekScreen} options={dark(t('documents.printWeek.name'))} />
        <Stack.Screen name="Entry" component={EntryScreen} options={dark(t('entry.title'))} />
        <Stack.Screen name="Roll" component={RollScreen} options={{ title: t('roll.title'), statusBarStyle: 'dark' }} />
        <Stack.Screen name="Correct" component={CorrectScreen} options={dark(t('correct.title'))} />
        <Stack.Screen name="RollRules" component={RollRules} options={dark(t('rules.title'))} />
        <Stack.Screen name="PupilMove" component={PupilMoveScreen} options={dark(t('move.title'))} />
        <Stack.Screen name="SeatsSetup" component={SeatsSetupScreen} options={dark(t('seats.title'))} />
        <Stack.Screen name="Class" component={ClassScreen} options={dark(t('classPage.title'))} />
        <Stack.Screen name="RollMonth" component={RollMonthScreen} options={dark(t('classPage.roll'))} />
        <Stack.Screen name="Pupil" component={PupilScreen} options={dark(t('classPage.roll'))} />
        <Stack.Screen name="RollPrint" component={RollPrintScreen} options={dark(t('rollPrint.title'))} />
        <Stack.Screen name="BookFixes" component={BookFixesScreen} options={dark(t('bookFixes.title'))} />
        <Stack.Screen name="PilotTimings" component={PilotTimingsScreen} options={dark(t('pilotTimings.title'))} />
        <Stack.Screen name="ClassPlan" component={ClassPlanScreen} options={dark(t('classPlan.title'))} />
        <Stack.Screen name="TestSchedule" component={TestScheduleScreen} options={dark(t('tests.title'))} />
        <Stack.Screen name="ExamWindow" component={ExamWindowScreen} options={dark(t('examWindow.title'))} />
        <Stack.Screen name="Duty" component={DutyScreen} options={dark(t('duties.title'))} />
        <Stack.Screen name="TextsBook" component={TextsBookScreen} options={dark(t('book.title'))} />
        <Stack.Screen name="Homework" component={HomeworkScreen} options={dark(t('homework.title'))} />
        <Stack.Screen name="Extra" component={ExtraScreen} options={dark(t('extra.title'))} />
        <Stack.Screen name="AddSessions" component={AddSessionsScreen} options={dark(t('addSessions.title'))} />
        <Stack.Screen
          name="PrivacyNotice"
          component={HelpNotice}
          options={{ title: t('privacy.helpTitle'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="Connections"
          component={Connections}
          options={{ title: t('connections.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="Licences"
          component={LicencesScreen}
          options={{ title: t('help.licences'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="LicenceNotice"
          component={LicenceNoticeScreen}
          options={({ route }) => ({ title: noticeTitle(route.params.name, t), statusBarStyle: 'dark' })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeTabs() {
  const t = useText();
  return (
    <Tabs.Navigator
      backBehavior="history"
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={({ route }) => ({ headerShown: false, title: t(tabLabels[route.name]) })}
    >
      <Tabs.Screen name="Today" component={TodayTab} />
      <Tabs.Screen name="Classes" component={ClassesTabScreen} />
      <Tabs.Screen name="Documents" component={DocumentsTabScreen} />
    </Tabs.Navigator>
  );
}

/** The welcome leads to the notice; Back from the notice returns here. */
function WelcomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  return <Welcome onStart={() => navigation.navigate('Privacy')} />;
}

/**
 * The notice before first use, which leads to setup. Nothing records that it
 * was read: until setup is complete, every start shows the welcome and the
 * notice, and setup shows what was already chosen.
 */
function FirstNotice({ navigation }: NativeStackScreenProps<RootStackParamList, 'Privacy'>) {
  return (
    <PrivacyNotice
      onAccept={() => navigation.navigate('Teaching')}
      onConnections={() => navigation.navigate('Connections')}
    />
  );
}

/** The same notice, from Help. */
function HelpNotice({ navigation }: NativeStackScreenProps<RootStackParamList, 'PrivacyNotice'>) {
  return <PrivacyNotice onConnections={() => navigation.navigate('Connections')} />;
}
