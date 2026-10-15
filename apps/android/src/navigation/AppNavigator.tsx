// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createBottomTabNavigator, type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  DefaultTheme,
  NavigationContainer,
  type CompositeScreenProps,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, sizes, spacing, typography } from '../design/tokens';
import text from '../text/ar.json';
import { BottomNav, TopBar } from './NavigationChrome';
import { Welcome } from './Welcome';

// No record contents in routes, persistence, URL linking or tracking hooks.
export type HomeTabParamList = { Today: undefined; Classes: undefined; Documents: undefined };
export type RootStackParamList = {
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  NavigationPreview: undefined;
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
export const tabLabels: Record<keyof HomeTabParamList, string> = {
  Today: text.navigation.today,
  Classes: text.navigation.classes,
  Documents: text.navigation.documents,
};

export function AppNavigator({ direction = I18nManager.isRTL ? 'rtl' : 'ltr' }: { direction?: 'rtl' | 'ltr' }) {
  return (
    <NavigationContainer direction={direction} theme={theme}>
      <Stack.Navigator screenOptions={{ statusBarStyle: 'light', header: (props) => <TopBar {...props} /> }}>
        <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="NavigationPreview"
          component={InnerPreview}
          options={{ title: text.navigation.previewTitle, statusBarStyle: 'dark' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeTabs() {
  return (
    <Tabs.Navigator
      backBehavior="history"
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={({ route }) => ({ headerShown: false, title: tabLabels[route.name] })}
    >
      <Tabs.Screen name="Today" component={HomePreview} />
      <Tabs.Screen name="Classes" component={HomePreview} />
      <Tabs.Screen name="Documents" component={HomePreview} />
    </Tabs.Navigator>
  );
}

type HomeProps = CompositeScreenProps<
  BottomTabScreenProps<HomeTabParamList>,
  NativeStackScreenProps<RootStackParamList>
>;

function HomePreview({ navigation, route }: HomeProps) {
  return (
    <Welcome>
      <Text style={styles.tabTitle} accessibilityRole="header">
        {tabLabels[route.name]}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('NavigationPreview')}
        style={styles.open}
      >
        <Text style={styles.openLabel}>{text.navigation.openPreview}</Text>
      </Pressable>
    </Welcome>
  );
}

function InnerPreview() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[
        styles.inner,
        {
          paddingBottom: spacing['space-20'] + insets.bottom,
          paddingLeft: spacing['space-20'] + insets.left,
          paddingRight: spacing['space-20'] + insets.right,
        },
      ]}
    >
      <Text style={styles.description}>{text.navigation.previewDescription}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabTitle: { ...typography.h2, color: colors.chalk, marginTop: spacing['space-24'], textAlign: 'center' },
  open: {
    minHeight: sizes.target,
    justifyContent: 'center',
    backgroundColor: colors.chalk,
    padding: spacing['space-12'],
    marginTop: spacing['space-16'],
  },
  openLabel: { ...typography.button, color: colors.board, textAlign: 'center' },
  inner: { flexGrow: 1, padding: spacing['space-20'] },
  description: { ...typography.body, color: colors.ink, textAlign: 'auto' },
});
