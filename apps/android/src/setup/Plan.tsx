// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Getting started, step 5 of 5: the plan and the calendar (#30,
// Setup-6-Plan). For each grade and subject, the pack its classes are pinned
// to, with its status, timing, release and source, and each class's pin; a
// grade with no pack yet works with typed items. The national calendar is
// shown as built in. Finishing opens Setup-7-Ready, with the September
// check (#31); where the class starts in its plan and the calendar's own
// screens come later.

import { packsFor, type PinnedPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { SetupSteps } from '../components/SetupSteps';
import { colors, radius, spacing, typography } from '../design/tokens';
import { groupName, packFacts, packSource } from '../plan/pack-labels';
import { packOfPin, pinOfClass, planGroups, type PlanGroup } from '../plan/plan-rules';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { SETUP_STEPS } from './Teaching';

/** The last step of setup; `onChange` opens a group's packs, and `onFinish` ends setup. */
export function Plan({ onChange, onFinish }: { onChange: (group: PlanGroup) => void; onFinish: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, packs } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const groups = planGroups(state);

  const card = (group: PlanGroup) => {
    const pins = group.classes.map((schoolClass) => ({
      schoolClass,
      pin: pinOfClass(state, schoolClass.id, group.subject, year.id),
    }));
    const pinned = pins.find((entry) => entry.pin !== null)?.pin ?? null;
    const pack = packOfPin(packs, pinned);
    const offered = packsFor(packs, group.grade, group.subject);
    const pinName = (name: string, pin: PinnedPack | null) =>
      pin === null
        ? t('plan.free', { name: isolate(name) })
        : t('plan.pin', { name: isolate(name), release: pin.release });
    return (
      <View key={group.key} testID={`plan-${group.key}`} style={styles.card}>
        <View style={styles.cardHead}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {groupName(t, profile, group)}
          </Text>
          {pack !== undefined && <Text style={styles.badge}>{t(`plan.status.${pack.status}`)}</Text>}
        </View>
        {pack !== undefined ? (
          <>
            <Text style={[styles.body, align]}>{packFacts(t, pack)}</Text>
            <Text style={[styles.sub, align]}>{packSource(t, pack)}</Text>
          </>
        ) : (
          <Text style={[styles.body, align]}>{offered.length === 0 ? t('plan.noPacksYet') : t('plan.notPinned')}</Text>
        )}
        {offered.length > 0 && (
          <Button
            testID={`plan-change-${group.key}`}
            variant="line"
            label={pinned === null ? t('plan.choose') : t('plan.change')}
            onPress={() => onChange(group)}
          />
        )}
        <Text style={[styles.label, align]}>{t('plan.pinnedFor')}</Text>
        <View style={styles.pins}>
          {pins.map(({ schoolClass, pin }) => (
            <Text key={schoolClass.id} style={styles.pin}>
              {pinName(schoolClass.name, pin)}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { direction }]}>
      <SetupSteps testID="setup-steps" count={SETUP_STEPS} reached={5} />
      <ScrollView contentContainerStyle={[styles.content, sides]}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {t('plan.heading')}
          </Text>
          <Text style={[styles.sub, align]}>{t('plan.intro')}</Text>
        </View>
        {groups.map(card)}
        <View testID="plan-calendar" style={styles.card}>
          <View style={styles.cardHead}>
            <Text accessibilityRole="header" style={[styles.title, align]}>
              {t('plan.calendar', { year: year.id })}
            </Text>
            <Text style={styles.badge}>{t('plan.bundled')}</Text>
          </View>
          <Text style={[styles.sub, align]}>{t('plan.calendarSub')}</Text>
        </View>
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="plan-finish" label={t('plan.finish')} onPress={onFinish} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    gap: spacing['space-16'],
    paddingTop: spacing['space-4'],
    paddingBottom: spacing['space-16'],
  },
  intro: { gap: spacing['space-6'] },
  heading: { ...typography.h2, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  title: { ...typography.label, color: colors.ink, flexGrow: 1, flexShrink: 1 },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  badge: {
    ...typography.badge,
    color: colors.ink,
    backgroundColor: colors.soft,
    borderRadius: radius['radius-badge'],
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-4'],
  },
  pins: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  pin: {
    ...typography.label,
    color: colors.chalk,
    backgroundColor: colors.board,
    borderRadius: radius['radius-chip'],
    paddingHorizontal: spacing['space-14'],
    paddingVertical: spacing['space-8'],
  },
  foot: { paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
