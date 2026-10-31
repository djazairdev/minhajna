// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Your devices once you joined the school's space (#566, R-9.3-05, R-6.5-02,
// answer 588), as Devices-moved draws it, under the band, opened from a
// joined school's card: in the national system, joining moves the sync
// between a teacher's own devices to the Ministry's server, encrypted as it
// is, checks it all arrived, and only then closes the project's account,
// whose encrypted data is erased within 10 days. The page says these steps
// with the day the teacher joined, first that in this demo nothing moves, and
// only the joining, which did happen, checked, the others numbered; then
// what moved, that nothing is lost, that the keys stay on the teacher's
// devices, this device with its own key, and a way back to what enters the
// school's space and what never does. The bar names the school by its short
// ID, and on a PC the title is said in the page's hidden live region. Going
// back leads to School-join.

import { readJoinCode, type Day, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Facts } from '../components/Facts';
import { RowLink } from '../components/RowLink';
import { DemoBand } from '../demo/DemoBand';
import { Icon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { shortSchool } from './SchoolJoined';

const STEPS = [
  ['demo.devices.joinedStep', 'demo.devices.joinedLine'],
  ['demo.devices.movedStep', 'demo.devices.movedLine'],
  ['demo.devices.closedStep', 'demo.devices.closedLine'],
] as const;
const LISTS = [
  ['demo.devices.what', ['demo.devices.what1', 'demo.devices.what2', 'demo.devices.what3']],
  ['demo.devices.lost', ['demo.devices.lost1', 'demo.devices.lost2']],
  ['demo.devices.keys', ['demo.devices.keys1', 'demo.devices.keys2', 'demo.devices.keys3']],
] as const;

/** The texts the page writes with the day the teacher joined. */
type Words =
  | (typeof STEPS)[number][number]
  | 'demo.devices.since'
  | 'demo.devices.demo'
  | 'demo.devices.this'
  | 'demo.devices.ownKey';

export type DevicesMovedProps = {
  /** The world's date, written out for the band. */
  readonly date: string;
  /** The join the page is about. */
  readonly join: SchoolJoined;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  /** Back to School-join. */
  readonly onClose: () => void;
  /** What the page says aloud on a PC, in its hidden live region. */
  readonly said: string;
};

/** The teacher's devices and copies once they joined the school's space. */
export function DevicesMoved({ date, join, dayText, onClose, said }: DevicesMovedProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const joined = dayText(join.certificate.issued);
  const words = (key: Words, style: object) => <Text style={[style, align]}>{t(key, { date: joined })}</Text>;
  return (
    <View testID="devices-moved" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID="devices-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="devices-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('demo.devices.title')}
          </Text>
          <Text style={[styles.small, align]}>
            {t('demo.devices.school', { school: shortSchool(readJoinCode(join.code)?.school ?? '') })}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {t('demo.devices.moved')}
            </Text>
            {words('demo.devices.demo', styles.small)}
            {words('demo.devices.since', styles.small)}
            <View style={styles.steps}>
              {STEPS.map(([step, line], index) => (
                <View key={step} testID="devices-step" style={[styles.step, index > 0 && styles.ruled]}>
                  {index === 0 ? (
                    <View
                      testID="devices-done"
                      accessible
                      accessibilityLabel={t('demo.devices.stepDone')}
                      style={[styles.disc, styles.done]}
                    >
                      <Icon name="check" size={16} color={colors.sheet} />
                    </View>
                  ) : (
                    <View style={[styles.disc, styles.ring]}>
                      <Text accessibilityLabel={t('demo.devices.step', { number: index + 1 })} style={styles.number}>
                        {index + 1}
                      </Text>
                    </View>
                  )}
                  <View style={styles.grow}>
                    {words(step, styles.label)}
                    {words(line, styles.small)}
                  </View>
                </View>
              ))}
            </View>
          </View>
          {LISTS.map(([head, items]) => (
            <View key={head} style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t(head)}
              </Text>
              <Facts
                kept={items.map((key) => ({ id: key, text: t(key), kept: true }))}
                keptLabel={t(head)}
                notKeptLabel={t(head)}
              />
            </View>
          ))}
          <View style={styles.card}>
            <Text accessibilityRole="header" style={[styles.small, align]}>
              {t('demo.devices.sync')}
            </Text>
            <View testID="devices-this" style={styles.step}>
              {!onPc() && <Icon name="phone" size={22} color={colors.ink} />}
              <View style={styles.grow}>
                {words('demo.devices.this', styles.label)}
                {words('demo.devices.ownKey', styles.small)}
              </View>
            </View>
          </View>
          <RowLink
            testID="devices-space"
            icon={({ size, color }) => <Icon name="school" size={size} color={color} />}
            title={t('demo.devices.space')}
            description={t('demo.devices.spaceLine')}
            onPress={onClose}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], paddingVertical: spacing['space-8'] },
  titles: { flexShrink: 1 },
  title: { ...typography['bar-title'], color: colors.ink },
  content: {
    flexGrow: 1,
    paddingTop: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    alignItems: 'center',
  },
  column: { width: '100%', maxWidth: 640, gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  steps: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    paddingHorizontal: spacing['space-12'],
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-12'], paddingVertical: spacing['space-12'] },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  disc: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.board },
  ring: { borderWidth: 1.5, borderColor: colors.rule },
  number: { ...typography.small, color: colors.ink2 },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  grow: { flex: 1, minWidth: 0, gap: spacing['space-2'] },
});
