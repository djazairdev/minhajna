// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Back arrow is a shape, not a bidi-sensitive glyph: Android mirrors neutral
// text. Its end border resolves to physical left in RTL before rotation.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DefaultTheme, useLocale } from '@react-navigation/native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, sizes, spacing, typography } from '../design/tokens';
import { documentKind } from '../documents/catalogue';
import { SETUP_STEPS } from '../setup/Teaching';
import { useText } from '../text/i18n';

/** The navigator's colours, from the design's tokens. */
export const theme = {
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

/** Each setup screen's step, which its bar's subtitle names. */
const SETUP_ROUTES = { Teaching: 1, Card: 2, Classes: 3, Week: 4, Plan: 5 } as const;

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

/** Provides a labelled, RTL-aware Back control and a scalable two-line heading. */
export function TopBar({ navigation, options, route }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const document = route.name === 'DocOutput' ? documentKind((route.params as { id: string }).id) : undefined;
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, direction },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('navigation.back')}
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <View
            testID="back-icon"
            importantForAccessibility="no"
            style={[styles.arrow, { transform: [{ rotate: direction === 'rtl' ? '135deg' : '225deg' }] }]}
          />
        </Pressable>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            {options.title}
          </Text>
          {route.name === 'Privacy' && <Text style={styles.subtitle}>{t('privacy.subtitle')}</Text>}
          {route.name === 'TypeList' && <Text style={styles.subtitle}>{t('setup.sorted')}</Text>}
          {route.name === 'Times' && <Text style={styles.subtitle}>{t('times.subtitle')}</Text>}
          {route.name === 'Security' && <Text style={styles.subtitle}>{t('security.subtitle')}</Text>}
          {route.name === 'Extra' && <Text style={styles.subtitle}>{t('extra.subtitle')}</Text>}
          {route.name === 'AddSessions' && <Text style={styles.subtitle}>{t('addSessions.subtitle')}</Text>}
          {route.name === 'PrintWeek' && <Text style={styles.subtitle}>{t('documents.printWeek.line')}</Text>}
          {route.name === 'DocOutput' && document !== undefined && (
            <Text style={styles.subtitle}>
              {t(document.landscape ? 'documents.output.landscape' : 'documents.output.portrait')}
            </Text>
          )}
          {Object.hasOwn(SETUP_ROUTES, route.name) && (
            <Text style={styles.subtitle}>
              {t('setup.step', { step: SETUP_ROUTES[route.name as keyof typeof SETUP_ROUTES], count: SETUP_STEPS })}
            </Text>
          )}
        </View>
        <View style={styles.back}>{options.headerRight?.({ canGoBack: true })}</View>
      </View>
    </View>
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
  header: {
    backgroundColor: colors.sheet,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.bar,
    paddingHorizontal: spacing['space-8'],
  },
  back: { width: sizes.target, minHeight: sizes.target, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 12, height: 12, borderTopWidth: 2, borderEndWidth: 2, borderColor: colors.ink },
  heading: { flex: 1, paddingVertical: spacing['space-8'] },
  title: { ...typography['bar-title'], color: colors.ink, textAlign: 'center' },
  subtitle: { ...typography['bar-subtitle'], color: colors.ink2, textAlign: 'center' },
});
