// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Getting started, step 2 of 5: the teacher card (#26, Setup-3-Card), the
// details the documents print at the top. The name is a personal field: it is
// optional, and it never leaves the phone (PRD §3.2, §5.6). The rank is
// printed and travels with the lesson record. The subjects, schools and school
// year come from step 1 and the calendar, so they are shown here, not typed
// again. «التوقيع المرسوم» opens the drawn signature, off until the teacher
// turns it on (#236, R-3.8-41); changing the name keeps it.

import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { personalWith } from '@minhajna/core';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { signatureStatus } from '../drawn/DrawnSignature';
import { SetupSteps } from '../components/SetupSteps';
import { TextField } from '../components/TextField';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { localized } from './names';
import { SETUP_STEPS } from './Teaching';
import { useDraft } from './useDraft';

/** The card's two typed fields, each saved once typing pauses. */
function useCard() {
  const { state, record } = useAppData();
  const name = useDraft(state.personal?.name ?? '', (value) => {
    record({ kind: 'teacher.personal.set', personal: personalWith(state.personal, { name: value }) });
  });
  const rank = useDraft(state.teacher?.rank ?? '', (value) => {
    record({ kind: 'teacher.set', card: { rank: value.trim() } });
  });
  return { name, rank };
}

/** A detail the card prints but this step does not change. */
function Shown({ label, value, testID }: { label: string; value: string; testID: string }) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${value}`} style={styles.shown}>
      <Text style={[styles.label, align]}>{label}</Text>
      <View style={styles.box}>
        <Text style={[styles.value, align]}>{value}</Text>
      </View>
    </View>
  );
}

/** The second step of setup; `onNext` leads on, with or without the card filled in. */
export function Card({
  onNext,
  onSignature,
  editing = false,
}: {
  onNext: () => void;
  onSignature: () => void;
  editing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { profile, year, state, unsaved } = useAppData();
  const { name, rank } = useCard();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const schools = [...state.schools.values()];
  const subjects = profile.subjects
    .filter((subject) => schools.some((school) => school.subjects.includes(subject.code)))
    .map((subject) => localized(subject.name))
    .join(comma);
  const leave = () => {
    name.flush();
    rank.flush();
    onNext();
  };
  return (
    <View style={[styles.screen, { direction }]}>
      {!editing && <SetupSteps testID="setup-steps" count={SETUP_STEPS} reached={2} />}
      <ScrollView contentContainerStyle={[styles.content, sides]} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {t('setup.cardHeading')}
          </Text>
          <Text style={[styles.sub, align]}>{t('setup.cardIntro')}</Text>
        </View>
        <TextField
          testID="card-name"
          label={t('setup.name')}
          optionalLabel={t('setup.personal')}
          placeholder={t('setup.namePlaceholder')}
          value={name.value}
          onChangeText={name.change}
          onBlur={name.flush}
          returnKeyType="next"
        />
        <TextField
          testID="card-rank"
          label={t('setup.rank')}
          placeholder={t('setup.rankPlaceholder')}
          value={rank.value}
          onChangeText={rank.change}
          onBlur={rank.flush}
          returnKeyType="done"
        />
        <View style={styles.pair}>
          <Shown testID="card-subjects" label={t('setup.subject')} value={subjects} />
          <Shown testID="card-year" label={t('setup.schoolYear')} value={year.id} />
        </View>
        <Shown
          testID="card-schools"
          label={t('setup.school')}
          value={schools.map((school) => school.name).join(comma)}
        />
        <Text style={[styles.sub, align]}>{t(editing ? 'settings.cardFromSchools' : 'setup.fromStepOne')}</Text>
        <RowLink
          testID="card-signature"
          icon={controlIcon('tune')}
          title={t('settings.rows.signature')}
          description={signatureStatus(t, state.personal)}
          onPress={() => {
            name.flush();
            rank.flush();
            onSignature();
          }}
        />
        {unsaved && (
          <Text testID="not-saved" accessibilityLiveRegion="polite" style={[styles.unsaved, align]}>
            {t('setup.notSaved')}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-8'] }]}>
        <Button testID="card-next" label={t(editing ? 'settings.done' : 'setup.next')} onPress={leave} />
        {!editing && (
          <View style={styles.later}>
            <Button testID="card-later" variant="plain" label={t('setup.later')} onPress={leave} />
          </View>
        )}
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
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-12'] },
  shown: { flexGrow: 1, flexBasis: 140, gap: spacing['space-6'] },
  label: { ...typography.label, color: colors.ink2 },
  box: {
    minHeight: sizes.target,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-14'],
    paddingVertical: spacing['space-10'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.paper,
  },
  value: { ...typography.body, color: colors.ink },
  unsaved: { ...typography.label, color: colors.ink },
  foot: { paddingTop: spacing['space-12'], gap: spacing['space-4'], backgroundColor: colors.paper },
  later: { flexDirection: 'row', justifyContent: 'center' },
});
