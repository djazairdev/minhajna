// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Choosing a grade and subject's pack (#30, Setup-6b-Packs): each pack with
// its status, timing, release and source, the ones that apply best first, or
// no pack and typed items, each a radio card as drawn. What each status
// means is listed under them. The pack is pinned to the classes chosen, each
// staying on that release until another is chosen (PRD §4.2). Opened for one
// class, only that class is ticked, and its own release, even an older or
// missing one, is offered first and chosen. District variants come later.

import { courseOf, packsFor, pinOf, STATUS_ORDER, type PinnedPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { RadioCard } from '../components/RadioCard';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { groupName, packFacts, packSource } from './pack-labels';
import { packOfPin, pinEvents, pinOfClass, planGroups } from './plan-rules';

const NO_PACK = 'none';
const CURRENT = 'current';

/** The chooser for one grade and subject; `onDone` returns, pinned or not. */
export function Packs({
  grade,
  subject,
  schoolId,
  classId,
  onDone,
}: {
  grade: string;
  subject: string;
  schoolId?: string;
  classId?: string;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, packs, recordAll, newId } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const group = planGroups(state).find((candidate) => candidate.grade === grade && candidate.subject === subject);
  const classes = (group?.classes ?? []).filter(
    (schoolClass) => schoolId === undefined || schoolClass.schoolId === schoolId,
  );
  const offered = packsFor(packs, grade, subject);
  const pinOfOne = (id: string) => pinOfClass(state, id, subject, year.id, grade);
  const pinned = classId !== undefined ? pinOfOne(classId) : classes.map((one) => pinOfOne(one.id)).find(Boolean);
  const shared = (pin: PinnedPack | null) => pin?.id === pinned?.id && pin?.release === pinned?.release;
  const onePin = classId !== undefined || classes.every((one) => shared(pinOfOne(one.id)));
  const kept = onePin && pinned && !offered.some((pack) => pack.id === pinned.id && pack.release === pinned.release);
  const keptPack = kept ? packOfPin(packs, pinned) : undefined;
  const [chosen, setChosen] = useState(() => {
    if (kept) return CURRENT;
    const current = pinned && offered.find((pack) => pack.id === pinned.id);
    return current ? current.id : (offered[0]?.id ?? NO_PACK);
  });
  const [forClasses, setForClasses] = useState<string[]>(() =>
    classId !== undefined ? [classId] : classes.map((schoolClass) => schoolClass.id),
  );
  const [tried, setTried] = useState(false);
  const pin = () => {
    setTried(true);
    if (forClasses.length === 0) return;
    const pack = offered.find((candidate) => candidate.id === chosen);
    const target = chosen === CURRENT && pinned ? pinned : pack ? pinOf(pack) : null;
    const same = (id: string) => {
      const course = courseOf(state, id, subject, year.id, grade);
      const now = course?.pack ?? null;
      if (course === undefined) return false;
      return (
        now === target || (now !== null && target !== null && now.id === target.id && now.release === target.release)
      );
    };
    const missing = chosen === CURRENT && keptPack === undefined;
    const moved = missing ? [] : forClasses.filter((id) => !same(id));
    if (moved.length > 0) recordAll(pinEvents(state, moved, subject, year.id, target, newId, grade));
    onDone();
  };

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView contentContainerStyle={[styles.content, sides]}>
        <Text style={[styles.sub, align]}>
          {t('plan.packsIntro', { group: groupName(t, profile, { grade, subject }) })}
        </Text>
        <View accessibilityRole="radiogroup" style={styles.list}>
          {kept && pinned && (
            <RadioCard
              testID="pack-current"
              label={t('plan.current')}
              description={
                keptPack
                  ? `${packFacts(t, keptPack)}\n${packSource(t, keptPack)}`
                  : t('settings.missingPack', { release: pinned.release })
              }
              selected={chosen === CURRENT}
              onPress={() => setChosen(CURRENT)}
            />
          )}
          {offered.map((pack) => (
            <RadioCard
              key={pack.id}
              testID={`pack-${pack.id}`}
              label={t(`plan.status.${pack.status}`)}
              description={`${packFacts(t, pack)}\n${packSource(t, pack)}`}
              selected={chosen === pack.id}
              onPress={() => setChosen(pack.id)}
            />
          ))}
          <RadioCard
            testID="pack-none"
            label={t('plan.noPack')}
            description={t('plan.noPackSub')}
            selected={chosen === NO_PACK}
            onPress={() => setChosen(NO_PACK)}
          />
        </View>
        <View style={styles.legend}>
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('plan.statuses')}
          </Text>
          {STATUS_ORDER.map((status) => (
            <View key={status} style={styles.meaning}>
              <Text style={[styles.badge, align]}>{t(`plan.status.${status}`)}</Text>
              <Text style={[styles.sub, align]}>{t(`plan.meaning.${status}`)}</Text>
            </View>
          ))}
        </View>
        <ChipGroup
          testID="pack-classes"
          label={t('plan.pinFor')}
          hint={t('plan.pinNote')}
          multiple
          choices={classes.map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name }))}
          selected={forClasses}
          onSelect={setForClasses}
        />
        {tried && forClasses.length === 0 && (
          <Text testID="pack-no-class" accessibilityLiveRegion="polite" style={[styles.error, align]}>
            {t('plan.noClass')}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="pack-pin" label={t('plan.pinButton')} onPress={pin} />
        <Button testID="pack-cancel" variant="plain" label={t('setup.cancel')} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    gap: spacing['space-16'],
    paddingTop: spacing['space-8'],
    paddingBottom: spacing['space-16'],
  },
  list: { gap: spacing['space-8'] },
  sub: { ...typography.caption, color: colors.ink2 },
  label: { ...typography.label, color: colors.ink },
  error: { ...typography.label, color: colors['error-ink'] },
  legend: {
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  meaning: { gap: spacing['space-4'], alignItems: 'flex-start' },
  badge: {
    ...typography.badge,
    color: colors.ink,
    backgroundColor: colors.soft,
    borderRadius: radius['radius-badge'],
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-4'],
  },
  foot: { gap: spacing['space-8'], paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
