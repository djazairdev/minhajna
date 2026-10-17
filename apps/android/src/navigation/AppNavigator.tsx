// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createBottomTabNavigator, type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
  type CompositeScreenProps,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import { colors } from '../design/tokens';
import StorageCheck from '../debug/StorageCheck';
import { Gallery } from '../gallery/Gallery';
import { samples } from '../gallery/samples';
import { currentLanguage, useText } from '../text/i18n';
import { HomePreview, InnerPreview, tabLabels } from './HomePreview';
import { BottomNav, TopBar } from './NavigationChrome';
import { CorrectScreen, EntryScreen, RollScreen, TodayTab } from './RecordScreens';
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
import { ClassPlan } from '../classes/ClassPlan';
import { ClassesTab } from '../classes/ClassesTab';
import type { Cell } from '../week/week-rules';

export { tabLabels } from './HomePreview';

/** Routes contain no record contents; persistence, URL linking and tracking remain unconfigured. */
export type HomeTabParamList = { Today: undefined; Classes: undefined; Documents: undefined };
/** Inner pages cover the tabs and carry no record contents. The gallery and the storage check exist in debug builds only. */
export type RootStackParamList = {
  Welcome: undefined;
  Privacy: undefined;
  Teaching: undefined;
  Card: undefined;
  Classes: undefined;
  TypeList: { classId: string; name: string };
  Week: undefined;
  WeekDraw: { slot?: Cell } | undefined;
  Times: undefined;
  Plan: undefined;
  Packs: { grade: string; subject: string };
  Ready: undefined;
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  NavigationPreview: undefined;
  Gallery: undefined;
  StorageCheck: undefined;
  Help: undefined;
  PrivacyNotice: undefined;
  Connections: undefined;
  Licences: undefined;
  LicenceNotice: { name: string };
  Entry: { key: string; day: string };
  ClassPlan: { courseId: string };
  Roll: { key: string; day: string };
  Correct: { unit: string; day: string; pupilId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<HomeTabParamList>();
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.sheet,
    text: colors.ink,
    border: colors.line,
    primary: colors.ink,
  },
};

/** The developer menu's item that opens the gallery, in English like the rest of that menu. */
export const GALLERY_MENU_ITEM = 'Component gallery';
/** The developer menu's item that runs the storage check (#19). */
export const STORAGE_CHECK_MENU_ITEM = 'Storage check';

/**
 * Places typed tabs under the native stack so inner screens cover them. In
 * debug builds, the developer menu also opens the component gallery and the
 * storage check.
 */
export function AppNavigator({
  direction = I18nManager.isRTL ? 'rtl' : 'ltr',
  initialRouteName = 'Welcome',
}: {
  direction?: 'rtl' | 'ltr';
  initialRouteName?: 'Welcome' | 'Home';
}) {
  const t = useText();
  const navigation = useNavigationContainerRef<RootStackParamList>();
  useEffect(() => {
    if (!__DEV__) return;
    DevSettings.addMenuItem(GALLERY_MENU_ITEM, () => navigation.navigate('Gallery'));
    DevSettings.addMenuItem(STORAGE_CHECK_MENU_ITEM, () => navigation.navigate('StorageCheck'));
  }, [navigation]);
  return (
    <NavigationContainer ref={navigation} direction={direction} theme={theme}>
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
        <Stack.Screen
          name="NavigationPreview"
          component={InnerPreview}
          options={{ title: t('navigation.previewTitle'), statusBarStyle: 'dark' }}
        />
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
        <Stack.Screen
          name="Entry"
          component={EntryScreen}
          options={{ title: t('entry.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen name="Roll" component={RollScreen} options={{ title: t('roll.title'), statusBarStyle: 'dark' }} />
        <Stack.Screen
          name="Correct"
          component={CorrectScreen}
          options={{ title: t('correct.title'), statusBarStyle: 'dark' }}
        />
        <Stack.Screen
          name="ClassPlan"
          component={ClassPlanScreen}
          options={{ title: t('classPlan.title'), statusBarStyle: 'dark' }}
        />
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
      <Tabs.Screen name="Documents" component={HomePreview} />
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

/** The Classes tab; a class's «المخطط» opens its plan. */
function ClassesTabScreen({
  navigation,
}: CompositeScreenProps<
  BottomTabScreenProps<HomeTabParamList, 'Classes'>,
  NativeStackScreenProps<RootStackParamList>
>) {
  return <ClassesTab onPlan={(courseId) => navigation.navigate('ClassPlan', { courseId })} />;
}

/** A class's plan. */
function ClassPlanScreen({ route }: NativeStackScreenProps<RootStackParamList, 'ClassPlan'>) {
  return <ClassPlan courseId={route.params.courseId} />;
}
