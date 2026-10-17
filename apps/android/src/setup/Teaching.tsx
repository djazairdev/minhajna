// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Getting started, step 1 of 5: levels, subjects and schools (#25, §3.2),
// as Setup-2-Teaching and, with several schools, Setup-2b-Schools draw them.
// One school is open at a time; the others fold to a line with «تعديل».
// Every change is saved as it is made, the wilaya included.

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { SetupSteps } from '../components/SetupSteps';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { SchoolFields, SchoolSummary } from './SchoolFields';
import { isComplete } from './school-rules';
import { useSchools } from './useSchools';

/** The steps of Getting started, as the bar under the title counts them. */
export const SETUP_STEPS = 5;

/** The first step of setup; `onNext` leads on once every school is complete. */
export function Teaching({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { profile, unsaved } = useAppData();
  const { schools, chooseLevels, chooseSubjects, chooseZone, rename, flush, add, remove } = useSchools();
  const [open, setOpen] = useState(() => (schools.find((school) => !isComplete(profile, school)) ?? schools[0]).id);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const single = schools.length === 1;
  const complete = schools.every((school) => isComplete(profile, school));
  const openSchool = (id: string) => {
    flush();
    setOpen(id);
  };
  const fieldsOf = (index: number) => {
    const school = schools[index];
    return (
      <SchoolFields
        key={school.id}
        profile={profile}
        school={school}
        layout={single ? 'single' : { number: index + 1 }}
        onLevels={(levels) => chooseLevels(school.id, levels)}
        onSubjects={(subjects) => chooseSubjects(school.id, subjects)}
        onName={(name) => rename(school.id, name)}
        onNameDone={flush}
        onZone={(zone) => chooseZone(school.id, zone)}
        onDelete={
          single
            ? undefined
            : () => {
                remove(school.id);
                setOpen((schools.find((other) => other.id !== school.id) ?? school).id);
              }
        }
      />
    );
  };
  return (
    <View style={[styles.screen, { direction }]}>
      <SetupSteps testID="setup-steps" count={SETUP_STEPS} reached={1} />
      <ScrollView contentContainerStyle={[styles.content, sides]} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {t('setup.teachingHeading')}
          </Text>
          <Text style={[styles.sub, align]}>{t(single ? 'setup.teachingIntro' : 'setup.schoolsIntro')}</Text>
        </View>
        {schools.map((school, index) =>
          single || school.id === open ? (
            fieldsOf(index)
          ) : (
            <SchoolSummary key={school.id} profile={profile} school={school} onEdit={() => openSchool(school.id)} />
          ),
        )}
        {!single && <Notice testID="schools-merged" icon={controlIcon('info')} message={t('setup.merged')} />}
        <Button testID="add-school" variant="line" label={t('setup.addSchool')} onPress={() => openSchool(add())} />
        {unsaved && (
          <Text testID="not-saved" accessibilityLiveRegion="polite" style={[styles.unsaved, align]}>
            {t('setup.notSaved')}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button
          testID="setup-next"
          label={t('setup.next')}
          disabled={!complete}
          accessibilityHint={complete ? undefined : t('setup.nextHint')}
          onPress={() => {
            flush();
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
  intro: { gap: spacing['space-6'] },
  heading: { ...typography.h2, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  unsaved: { ...typography.label, color: colors.ink },
  foot: { paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
