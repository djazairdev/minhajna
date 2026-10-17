// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Getting started, step 3 of 5: classes and their pupils (#27,
// Setup-4-Classes). Each class shows how many pupils it holds and whether its
// list is ready; a class without one offers «كتابة القائمة». Importing the
// official file comes with #42, and joint primary classes later, so neither
// button shows yet. There is no limit on a class's size (R-3.2-12).

import type { SchoolClass } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { SetupSteps } from '../components/SetupSteps';
import { controlIcon } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { AddClass } from './AddClass';
import { SETUP_STEPS } from './Teaching';

/** One class: its name, its size and whether its list is ready. */
function ClassCard({ schoolClass, count, onType }: { schoolClass: SchoolClass; count: number; onType: () => void }) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const ready = count > 0;
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const status = ready ? t('setup.listReady') : t('setup.listMissing');
  const head = (
    <View style={styles.head}>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{schoolClass.name}</Text>
      </View>
      <Text style={[styles.count, align]}>{ready ? t('setup.pupils', { count }) : status}</Text>
      {ready && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{status}</Text>
        </View>
      )}
    </View>
  );
  if (ready) {
    return (
      <Pressable
        testID={`class-${schoolClass.id}`}
        accessibilityRole="button"
        accessibilityLabel={[schoolClass.name, t('setup.pupils', { count }), status].join(comma)}
        accessibilityHint={t('setup.openList')}
        onPress={onType}
        style={({ pressed }) => [styles.card, pressed && { borderColor: colors.ink }]}
      >
        {head}
      </Pressable>
    );
  }
  return (
    <View testID={`class-${schoolClass.id}`} style={[styles.card, styles.open]}>
      {head}
      <Button testID={`type-${schoolClass.id}`} variant="line" label={t('setup.typeList')} onPress={onType} />
    </View>
  );
}

/** The third step of setup; `onType` opens a class's list and `onNext` leads on. */
export function Classes({ onType, onNext }: { onType: (schoolClass: SchoolClass) => void; onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, unsaved } = useAppData();
  const [adding, setAdding] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const schools = [...state.schools.values()];
  const classes = [...state.classes.values()].filter((schoolClass) => state.schools.has(schoolClass.schoolId));
  const sizeOf = (id: string) => [...state.pupils.values()].filter((pupil) => pupil.classId === id).length;
  return (
    <View style={[styles.screen, { direction }]}>
      <SetupSteps testID="setup-steps" count={SETUP_STEPS} reached={3} />
      <ScrollView contentContainerStyle={[styles.content, sides]} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {t('setup.classesHeading')}
          </Text>
          <Text style={[styles.sub, align]}>{t('setup.classesIntro')}</Text>
        </View>
        {classes.map((schoolClass) => (
          <ClassCard
            key={schoolClass.id}
            schoolClass={schoolClass}
            count={sizeOf(schoolClass.id)}
            onType={() => onType(schoolClass)}
          />
        ))}
        {adding ? (
          <AddClass schools={schools} onDone={() => setAdding(false)} />
        ) : (
          <Button testID="add-class-open" variant="line" label={t('setup.addClass')} onPress={() => setAdding(true)} />
        )}
        <Notice testID="columns-note" icon={controlIcon('lock')} message={t('setup.columnsNote')} />
        {unsaved && (
          <Text testID="not-saved" accessibilityLiveRegion="polite" style={[styles.unsaved, align]}>
            {t('setup.notSaved')}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="classes-next" label={t('setup.next')} onPress={onNext} />
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
  card: {
    minHeight: sizes.target,
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  open: { borderColor: colors.rule },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-12'] },
  chip: {
    paddingHorizontal: spacing['space-10'],
    paddingVertical: spacing['space-6'],
    borderRadius: radius['radius-class'],
    backgroundColor: colors.subject,
  },
  chipText: { ...typography['class-chip'], color: colors['on-subject'] },
  count: { ...typography.body, color: colors.ink, flexGrow: 1, flexShrink: 1 },
  badge: {
    paddingHorizontal: spacing['space-10'],
    paddingVertical: spacing['space-2'],
    borderRadius: radius['radius-badge'],
    backgroundColor: colors.ok,
  },
  badgeText: { ...typography.badge, color: colors['ok-ink'] },
  unsaved: { ...typography.label, color: colors.ink },
  foot: { paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
