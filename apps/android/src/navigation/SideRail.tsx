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
import { Text, View } from 'react-native';
import { useLockAway } from '../lock/lock-away';
import { HandoverBar } from '../settings/HandoverBar';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { dayAndMonth } from '../today/DayMark';
import { RailButton, RailLink, railStyles as styles } from './RailLink';

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
  return (
    <View testID="side-rail" style={[styles.rail, { direction }]}>
      <Text accessibilityRole="header" style={[styles.brand, align]}>
        {t('name')}
      </Text>
      {who.length > 0 && <Text style={[styles.who, align]}>{who.join(' · ')}</Text>}
      <View accessibilityRole="tablist" style={styles.links}>
        {state.routes.map((route, index) => {
          const selected = index === state.index;
          return (
            <RailLink
              key={route.name}
              testID={`rail-${route.name}`}
              label={descriptors[route.key].options.title ?? route.name}
              selected={selected}
              tab
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
            />
          );
        })}
      </View>
      <RailLink
        testID="rail-Settings"
        label={t('settings.title')}
        selected={false}
        tab={false}
        round
        onPress={() => navigation.navigate('Settings')}
      />
      <View style={styles.foot}>
        <HandoverBar onReceive={() => navigation.navigate('TakeBack')} />
        {copy !== null && (
          <Text testID="rail-copy" style={[styles.line, align]}>
            {copy}
          </Text>
        )}
        {lockAway !== null && <RailButton testID="rail-lock" label={t('shell.lockNow')} onPress={lockAway} />}
      </View>
    </View>
  );
}
