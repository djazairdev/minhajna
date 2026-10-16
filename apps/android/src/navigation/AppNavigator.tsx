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
import { DevSettings, I18nManager, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, sizes, spacing, typography } from '../design/tokens';
import { Gallery } from '../gallery/Gallery';
import { samples } from '../gallery/samples';
import { currentLanguage, useText } from '../text/i18n';
import { BottomNav, TopBar } from './NavigationChrome';
import { Welcome } from './Welcome';
import { HelpScreen, LicenceNoticeScreen, LicencesScreen, noticeTitle } from '../help/HelpScreens';

/** Routes contain no record contents; persistence, URL linking and tracking remain unconfigured. */
export type HomeTabParamList = { Today: undefined; Classes: undefined; Documents: undefined };
/** Inner pages cover the tabs and carry no record contents. The gallery exists in debug builds only. */
export type RootStackParamList = {
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  NavigationPreview: undefined;
  Gallery: undefined;
  Help: undefined;
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
/** Each tab's label in the catalogue. */
export const tabLabels = {
  Today: 'navigation.today',
  Classes: 'navigation.classes',
  Documents: 'navigation.documents',
} as const satisfies Record<keyof HomeTabParamList, string>;

/** The developer menu's item that opens the gallery, in English like the rest of that menu. */
export const GALLERY_MENU_ITEM = 'Component gallery';

/**
 * Places typed tabs under the native stack so inner screens cover them. In
 * debug builds, the developer menu also opens the component gallery.
 */
export function AppNavigator({ direction = I18nManager.isRTL ? 'rtl' : 'ltr' }: { direction?: 'rtl' | 'ltr' }) {
  const t = useText();
  const navigation = useNavigationContainerRef<RootStackParamList>();
  useEffect(() => {
    if (__DEV__) DevSettings.addMenuItem(GALLERY_MENU_ITEM, () => navigation.navigate('Gallery'));
  }, [navigation]);
  return (
    <NavigationContainer ref={navigation} direction={direction} theme={theme}>
      <Stack.Navigator screenOptions={{ statusBarStyle: 'light', header: (props) => <TopBar {...props} /> }}>
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
        <Stack.Screen name="Help" component={HelpScreen} options={{ title: t('help.title'), statusBarStyle: 'dark' }} />
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

type HomeProps = CompositeScreenProps<
  BottomTabScreenProps<HomeTabParamList>,
  NativeStackScreenProps<RootStackParamList>
>;

function HomePreview({ navigation, route }: HomeProps) {
  const t = useText();
  return (
    <Welcome>
      <Text style={styles.tabTitle} accessibilityRole="header">
        {t(tabLabels[route.name])}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('NavigationPreview')}
        style={styles.open}
      >
        <Text style={styles.openLabel}>{t('navigation.openPreview')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('help.title')}
        onPress={() => navigation.navigate('Help')}
        style={styles.open}
      >
        <Text style={styles.openLabel}>{t('help.title')}</Text>
      </Pressable>
    </Welcome>
  );
}

function InnerPreview() {
  const insets = useSafeAreaInsets();
  const t = useText();
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
      <Text style={styles.description}>{t('navigation.previewDescription')}</Text>
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
