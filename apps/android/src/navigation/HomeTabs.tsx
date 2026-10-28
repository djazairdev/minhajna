// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The home tabs, Today, Classes and Documents: at the foot of the screen on
// the phone, and as the rail at the start of the window on a PC, where Classes
// reads «الأقسام والنقاط» as on the design's board (#251, answer 524).

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNotifyOpen, useNotifyPlan } from '../notify/useNotify';
import { onPc, useDeviceText } from '../text/device-text';
import { DocumentsTabScreen } from './DocumentScreens';
import { HomeTabBar } from './NavigationChrome';
import { ClassesTabScreen, TodayTab } from './RecordScreens';
import type { HomeTabParamList } from './routes';

export const tabLabels = {
  Today: 'navigation.today',
  Classes: 'navigation.classes',
  Documents: 'navigation.documents',
} as const satisfies Record<keyof HomeTabParamList, string>;

const Tabs = createBottomTabNavigator<HomeTabParamList>();

export function HomeTabs() {
  const t = useDeviceText();
  useNotifyPlan();
  useNotifyOpen();
  return (
    <Tabs.Navigator
      backBehavior="history"
      tabBar={(props) => <HomeTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        title: t(tabLabels[route.name]),
        tabBarPosition: onPc() ? 'left' : 'bottom',
      })}
    >
      <Tabs.Screen name="Today" component={TodayTab} />
      <Tabs.Screen name="Classes" component={ClassesTabScreen} />
      <Tabs.Screen name="Documents" component={DocumentsTabScreen} />
    </Tabs.Navigator>
  );
}
