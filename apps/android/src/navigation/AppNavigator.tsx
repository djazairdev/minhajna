// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
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
import { Welcome } from './Welcome';
import { HelpScreen, LicenceNoticeScreen, LicencesScreen, noticeTitle } from '../help/HelpScreens';
import { Connections, PrivacyNotice } from '../help/PrivacyNotice';
import { Card } from '../setup/Card';
import { Classes } from '../setup/Classes';
import { TypeList } from '../setup/TypeList';
import { Week } from '../setup/Week';
import { Packs } from '../plan/Packs';
import { Plan } from '../setup/Plan';
import { Times } from '../times/Times';
import { WeekDraw } from '../week/WeekDraw';
import type { Cell } from '../week/week-rules';
import { Teaching } from '../setup/Teaching';

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
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  NavigationPreview: undefined;
  Gallery: undefined;
  StorageCheck: undefined;
  Help: undefined;
  PrivacyNotice: undefined;
  Connections: undefined;
  Licences: undefined;
  LicenceNotice: { name: string };
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
        <Stack.Screen name="Times" component={Times} options={{ title: t('times.title'), statusBarStyle: 'dark' }} />
        <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
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
      <Tabs.Screen name="Today" component={HomePreview} />
      <Tabs.Screen name="Classes" component={HomePreview} />
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

/** Setup's first step, which leads to the card. */
function TeachingScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Teaching'>) {
  return <Teaching onNext={() => navigation.navigate('Card')} />;
}

/** Setup's second step, which leads to the classes. */
function CardScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Card'>) {
  return <Card onNext={() => navigation.navigate('Classes')} />;
}

/** Setup's third step, which leads to the week. */
function ClassesScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Classes'>) {
  return (
    <Classes
      onType={(schoolClass) => navigation.navigate('TypeList', { classId: schoolClass.id, name: schoolClass.name })}
      onNext={() => navigation.navigate('Week')}
    />
  );
}

/** Setup's fourth step; it leads to the plan. */
function WeekScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Week'>) {
  return (
    <Week
      onDraw={() => navigation.navigate('WeekDraw')}
      onResolve={(slot) => navigation.navigate('WeekDraw', { slot })}
      onTimes={() => navigation.navigate('Times')}
      onNext={() => navigation.navigate('Plan')}
    />
  );
}

/** Setup's last step; the September check comes with #31, so it leads to the tabs for now. */
function PlanScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Plan'>) {
  return (
    <Plan
      onChange={(group) => navigation.navigate('Packs', { grade: group.grade, subject: group.subject })}
      onFinish={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
    />
  );
}

/** A grade and subject's packs; pinning or cancelling returns to the plan. */
function PacksScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Packs'>) {
  return <Packs grade={route.params.grade} subject={route.params.subject} onDone={() => navigation.goBack()} />;
}

/** Drawing the week by hand, with a slot already open when one is given; «حفظ الأسبوع» returns. */
function WeekDrawScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'WeekDraw'>) {
  return <WeekDraw openAt={route.params?.slot} onDone={() => navigation.goBack()} />;
}

/** A class's list, typed by hand; «حفظ القائمة» returns to the classes. */
function TypeListScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'TypeList'>) {
  return <TypeList classId={route.params.classId} onDone={() => navigation.goBack()} />;
}

/** The same notice, from Help. */
function HelpNotice({ navigation }: NativeStackScreenProps<RootStackParamList, 'PrivacyNotice'>) {
  return <PrivacyNotice onConnections={() => navigation.navigate('Connections')} />;
}
