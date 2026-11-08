// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher app's tabs and its stack screens' bar, which is the shared
// StackBar with each teacher screen's line under its title.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useLocale } from '@react-navigation/native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, sizes, spacing, typography } from '../design/tokens';
import { documentKind } from '../documents/catalogue';
import { HandoverBar } from '../settings/HandoverBar';
import { SETUP_STEPS } from '../setup/Teaching';
import { onPc } from '../text/device-text';
import { useText } from '../text/i18n';
import { SideRail } from './SideRail';
import { StackBar, barSubtitle } from './StackBar';

export { theme } from './StackBar';

/** Each setup screen's step, which its bar's subtitle names. */
const SETUP_ROUTES = { Teaching: 1, Card: 2 } as const;

/** The tabs, under the banner of a working copy on the other device (answer 513); the rail on a PC (answer 524). */
export function HomeTabBar(props: BottomTabBarProps) {
  if (onPc()) return <SideRail {...props} />;
  return (
    <View>
      <HandoverBar onReceive={() => props.navigation.navigate('TakeBack')} />
      <BottomNav {...props} />
    </View>
  );
}

/** Keeps tab labels and selection accessible without exposing decorative icons. */
export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  return (
    <View
      style={[
        styles.tabs,
        { direction, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      {state.routes.map((route, index) => {
        const selected = index === state.index;
        const label = descriptors[route.key].options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.tab}
          >
            <View
              style={[styles.pill, selected && styles.selectedPill]}
              importantForAccessibility="no-hide-descendants"
            >
              <View
                style={[
                  styles.icon,
                  { borderColor: selected ? colors.ink : colors.ink2 },
                  route.name === 'Classes' && styles.classIcon,
                ]}
              >
                <View style={[styles.iconRule, { backgroundColor: selected ? colors.ink : colors.ink2 }]} />
                {route.name === 'Documents' && <View style={styles.documentRule} />}
              </View>
            </View>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The shared bar, with the line each teacher screen has under its title. */
export function TopBar(props: NativeStackHeaderProps) {
  const { route } = props;
  const t = useText();
  const document = route.name === 'DocOutput' ? documentKind((route.params as { id: string }).id) : undefined;
  return (
    <StackBar
      {...props}
      subtitle={
        <>
          {route.name === 'Privacy' && <Text style={barSubtitle}>{t('privacy.subtitle')}</Text>}
          {route.name === 'Times' && <Text style={barSubtitle}>{t('times.subtitle')}</Text>}
          {route.name === 'Security' && (
            <Text style={barSubtitle}>{t(Platform.OS === 'web' ? 'security.web.subtitle' : 'security.subtitle')}</Text>
          )}
          {route.name === 'Extra' && <Text style={barSubtitle}>{t('extra.subtitle')}</Text>}
          {route.name === 'AddSessions' && <Text style={barSubtitle}>{t('addSessions.subtitle')}</Text>}
          {route.name === 'PrintWeek' && <Text style={barSubtitle}>{t('documents.printWeek.line')}</Text>}
          {route.name === 'DocOutput' && document !== undefined && (
            <Text style={barSubtitle}>
              {t(document.landscape ? 'documents.output.landscape' : 'documents.output.portrait')}
            </Text>
          )}
          {Object.hasOwn(SETUP_ROUTES, route.name) && (
            <Text style={barSubtitle}>
              {t('setup.step', { step: SETUP_ROUTES[route.name as keyof typeof SETUP_ROUTES], count: SETUP_STEPS })}
            </Text>
          )}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  tab: {
    flex: 1,
    minHeight: sizes.nav,
    minWidth: sizes.target,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['space-8'],
  },
  pill: {
    width: sizes.target,
    minHeight: 28,
    borderRadius: radius['radius-pill'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPill: { backgroundColor: colors['pill-on'] },
  icon: {
    width: sizes.icon,
    height: sizes.icon,
    borderWidth: 2,
    borderRadius: 3,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  classIcon: { borderRadius: radius['radius-tag'] },
  iconRule: { height: 2 },
  documentRule: { height: 2, backgroundColor: colors.ink2, marginTop: 3 },
  label: { ...typography.nav, color: colors.ink2, textAlign: 'center', marginTop: spacing['space-4'] },
  selectedLabel: { color: colors.ink, fontWeight: '700', fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700') },
});
