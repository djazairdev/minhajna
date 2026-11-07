// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Getting started, step 1 (#25, answers 802 to 809): the level, the option for
// that level, then the wilaya, commune and school, all chosen from the
// directory's published list, with nothing typed and no subtitles or helper
// texts. The list is fetched as the step opens and held in memory; the step
// says so while it loads, and when there is no network or nothing published,
// with a retry. Next records the chosen school, keeping the ID of the school
// the history already holds, and the levels and subjects its classes use, if
// any (school-guards.ts); a school the teacher holds as another is not offered.
// Settings changes and adds schools on its own page (SettingsSchools.tsx).

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { SetupSteps } from '../components/SetupSteps';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { protectedChoices } from '../settings/school-guards';
import { chosenSchool, choiceOf, schoolFrom, unchanged, type Choice } from './school-choice';
import { ReferenceState, SchoolChoice } from './SchoolChoice';
import { useReference } from './useReference';

/** The steps of Getting started, as the bar under the title counts them. */
export const SETUP_STEPS = 5;

/** The arrow onward on each step's Next; Settings' Done, which goes nowhere further, has none. */
export const NEXT_ARROW = { icon: controlIcon('chevron'), iconEnd: true } as const;

/** The first step of setup; `onNext` leads on once a school is chosen. */
export function Teaching({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useDeviceText();
  const { profile, state, record, newId, unsaved } = useAppData();
  const { load, retry } = useReference();
  const [before, ...others] = [...state.schools.values()];
  const held = others.flatMap((school) => (school.code === undefined ? [] : [school.code]));
  const [picked, setPicked] = useState<Choice | null>(null);
  const list = load.kind === 'ready' ? load.list : null;
  const choice = picked ?? (list === null ? null : choiceOf(list, before));
  const chosen = list === null || choice === null ? null : chosenSchool(list, choice);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  return (
    <View style={[styles.screen, { direction }]}>
      <SetupSteps testID="setup-steps" count={SETUP_STEPS} reached={1} />
      <ScrollView contentContainerStyle={[styles.content, sides]} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.heading, align]}>
          {t('setup.teachingHeading')}
        </Text>
        <ReferenceState load={load} onRetry={retry} />
        {list !== null && choice !== null && (
          <SchoolChoice profile={profile} list={list} choice={choice} onChoice={setPicked} held={held} />
        )}
        {unsaved && (
          <Text testID="not-saved" accessibilityLiveRegion="polite" style={[styles.unsaved, align]}>
            {t('setup.notSaved')}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button
          testID="setup-next"
          {...NEXT_ARROW}
          label={t('setup.next')}
          disabled={chosen === null}
          onPress={() => {
            if (chosen === null) return;
            const school = schoolFrom(chosen, before?.id ?? newId(), before);
            const kept = {
              ...school,
              levels: protectedChoices(state, school.id, 'levels', school.levels),
              subjects: protectedChoices(state, school.id, 'subjects', school.subjects),
            };
            if (!unchanged(kept, before)) record({ kind: 'school.set', school: kept });
            onNext();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    gap: spacing['space-20'],
    paddingTop: spacing['space-4'],
    paddingBottom: spacing['space-16'],
  },
  heading: { ...typography.h2, color: colors.ink },
  unsaved: { ...typography.label, color: colors.ink },
  foot: { paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
