// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's rail (#251, Web-week, answers 524 and 525), at the start of the
// window in place of the phone's bottom tabs: the app's name, the teacher and
// the schools, the home tabs and Settings, then at its foot the banner of a
// working copy on the other device, where the copy here came from, never a
// sync, and «قفل الآن», which locks at once as the automatic lock does.

import { deviceFacts } from '@minhajna/core';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilyForWeight } from '../design/fonts';
import { colorRoles, colors, fontFamilies, radius, sizes, spacing, typography } from '../design/tokens';
import { useLockAway } from '../lock/lock-away';
import { HandoverBar } from '../settings/HandoverBar';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { dayAndMonth } from '../today/DayMark';

/** The rail's line on where the copy here came from, or null when this PC started fresh. */
function useCopyLine(): string | null {
  const t = useDeviceText();
  const { entries, profile } = useAppData();
  const received = deviceFacts(entries()).received;
  if (received === null) return null;
  return t(`shell.from.${received.from}`, { day: dayAndMonth(received.day, currentLanguage(), profile) });
}

export function SideRail({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state: data } = useAppData();
  const lockAway = useLockAway();
  const copy = useCopyLine();
  const who = [data.personal?.name, ...[...data.schools.values()].map((school) => school.name)].filter(Boolean);
  const link = (key: string, label: string, selected: boolean, onPress: () => void, tab: boolean) => (
    <Pressable
      key={key}
      testID={`rail-${key}`}
      accessibilityRole={tab ? 'tab' : 'button'}
      accessibilityLabel={label}
      aria-selected={tab ? selected : undefined}
      onPress={onPress}
      style={[styles.link, selected && styles.selected]}
    >
      <View importantForAccessibility="no-hide-descendants" style={[styles.icon, key === 'Settings' && styles.round]}>
        <View style={styles.rule} />
      </View>
      <Text style={[styles.label, selected && styles.selectedLabel, align]}>{label}</Text>
    </Pressable>
  );
  return (
    <View testID="side-rail" style={[styles.rail, { direction }]}>
      <Text accessibilityRole="header" style={[styles.brand, align]}>
        {t('name')}
      </Text>
      {who.length > 0 && <Text style={[styles.who, align]}>{who.join(' · ')}</Text>}
      <View accessibilityRole="tablist" style={styles.links}>
        {state.routes.map((route, index) => {
          const selected = index === state.index;
          return link(
            route.name,
            descriptors[route.key].options.title ?? route.name,
            selected,
            () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            },
            true,
          );
        })}
      </View>
      {link('Settings', t('settings.title'), false, () => navigation.navigate('Settings'), false)}
      <View style={styles.foot}>
        <HandoverBar onReceive={() => navigation.navigate('TakeBack')} />
        {copy !== null && (
          <Text testID="rail-copy" style={[styles.copy, align]}>
            {copy}
          </Text>
        )}
        {lockAway !== null && (
          <Pressable
            testID="rail-lock"
            accessibilityRole="button"
            accessibilityLabel={t('shell.lockNow')}
            onPress={lockAway}
            style={styles.lock}
          >
            <Text style={styles.lockLabel}>{t('shell.lockNow')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: sizes['web-sidebar'],
    gap: spacing['space-4'],
    paddingTop: spacing['space-20'],
    paddingBottom: spacing['space-16'],
    paddingHorizontal: spacing['space-14'],
    backgroundColor: colors.board,
  },
  brand: {
    ...typography.brand,
    fontSize: 40,
    lineHeight: 46,
    color: colors.chalk,
    paddingHorizontal: spacing['space-10'],
  },
  who: {
    ...typography.caption,
    color: colors['chalk-75'],
    paddingHorizontal: spacing['space-10'],
    paddingBottom: spacing['space-14'],
  },
  links: { gap: spacing['space-4'] },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-10'],
    minHeight: sizes.target,
    paddingHorizontal: spacing['space-12'],
    borderRadius: radius['radius-button'],
  },
  selected: { backgroundColor: colors['chalk-14'] },
  icon: {
    width: sizes['icon-small'],
    height: sizes['icon-small'],
    borderWidth: 1.5,
    borderRadius: 3,
    borderColor: colors['chalk-82'],
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  round: { borderRadius: sizes['icon-small'] / 2 },
  rule: { height: 1.5, backgroundColor: colors['chalk-82'] },
  label: { ...typography.body, flexShrink: 1, color: colors['chalk-82'] },
  selectedLabel: {
    color: colors.chalk,
    fontWeight: '700',
    fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'),
  },
  foot: { marginTop: 'auto', gap: spacing['space-8'], paddingHorizontal: spacing['space-10'] },
  copy: { ...typography.caption, color: colors['chalk-75'] },
  lock: {
    minHeight: sizes.target,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: radius['radius-button'],
    borderColor: colorRoles.boardControlBorder,
  },
  lockLabel: { ...typography.button, color: colors.chalk },
});
