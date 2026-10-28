// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Typing a class list (#27, Setup-4c-Type, R-3.2-11): the name, the sex and, if
// the teacher has it, the registration number. Each pupil is saved when added,
// the list is sorted alphabetically, and there is no limit on its size. Tapping
// a pupil loads them back into the form, to correct or remove. The project's
// builds take made-up names only, and the screen says so (choice F1 of the
// field check, #49); the build the Ministry runs takes real names, and says how
// they are protected (#211), on a PC in this browser behind the passphrase
// (#250, answer 509). In a joint class, each pupil's year is chosen too, and
// the list counts each year's pupils (#43).

import { isJoint, levelGroups, pupilGrade, type Pupil, type SchoolClass } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { REAL_NAMES, realNamesDeclaration } from '../privacy/real-names';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { registrationTaken, sortedPupils, typedPupil } from './class-rules';
import { withYear, yearTally } from './joint-rules';
import { gradeName } from './names';

type Sex = 'f' | 'm';

/** The form, empty for a new pupil or filled with the one being corrected; a joint class's year stays chosen. */
function useForm(schoolClass: SchoolClass | undefined) {
  const [editing, setEditing] = useState<Pupil | null>(null);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('m');
  const [registration, setRegistration] = useState('');
  const [year, setYear] = useState<string | null>(null);
  const load = (pupil: Pupil | null) => {
    setEditing(pupil);
    setName(pupil?.name ?? '');
    if (pupil) setSex(pupil.sex);
    setRegistration(pupil?.registration ?? '');
    if (pupil && schoolClass) setYear(pupilGrade(pupil, schoolClass) ?? null);
  };
  return { editing, name, setName, sex, setSex, registration, setRegistration, year, setYear, load };
}

/** One typed pupil, in the list's order. */
function Row({ pupil, at, year, onPress }: { pupil: Pupil; at: number; year?: string; onPress: () => void }) {
  const { direction } = useLocale();
  const t = useDeviceText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sex = pupil.sex === 'f' ? t('setup.female') : t('setup.male');
  const second = [year, pupil.registration ?? t('setup.noRegistration')].filter(Boolean).join(' · ');
  return (
    <Pressable
      testID={`pupil-${pupil.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${at}. ${pupil.name}. ${second}. ${sex}`}
      accessibilityHint={t('setup.editPupil', { name: pupil.name })}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.soft }]}
    >
      <Text style={styles.at}>{at}</Text>
      <View style={styles.words}>
        <Text style={[styles.name, align]}>{pupil.name}</Text>
        <Text style={[styles.second, align, pupil.registration !== undefined && year === undefined && styles.number]}>
          {second}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{sex}</Text>
      </View>
    </Pressable>
  );
}

/** The list of one class; `onDone` returns to the classes. */
export function TypeList({ classId, onDone }: { classId: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useDeviceText();
  const { state, profile, record, erase, newId, unsaved } = useAppData();
  const schoolClass = state.classes.get(classId);
  const joint = schoolClass !== undefined && isJoint(schoolClass) ? schoolClass : undefined;
  const form = useForm(joint);
  const yearOf = (pupil: Pupil) => {
    const grade = joint && pupilGrade(pupil, joint);
    return joint === undefined ? undefined : grade ? gradeName(profile, grade) : t('joint.noYear');
  };
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const pupils = sortedPupils(state.pupils.values(), classId);
  const taken = registrationTaken(state.pupils.values(), classId, form.registration, form.editing?.id);
  const ready = form.name.trim() !== '' && !taken && (joint === undefined || form.year !== null);
  const keep = () => {
    if (!ready) return;
    const id = form.editing?.id ?? newId();
    const pupil = typedPupil({ id, classId, name: form.name, sex: form.sex }, form.registration);
    record({
      kind: 'pupil.set',
      pupil: {
        ...pupil,
        groups:
          joint && form.year ? withYear(form.editing?.groups ?? [], joint, form.year) : (form.editing?.groups ?? []),
        movements: form.editing?.movements ?? [],
      },
    });
    form.load(null);
  };
  const remove = (id: string) => {
    erase((event) =>
      event.kind === 'pupil.set' ? event.pupil.id === id : event.kind === 'pupil.moved' && event.pupilId === id,
    );
    form.load(null);
  };
  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView contentContainerStyle={[styles.content, sides]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.sub, align]}>{t('setup.typeIntro')}</Text>
        {realNamesDeclaration(REAL_NAMES, true) === null ? (
          <Notice
            testID="made-up-only"
            variant="notice"
            badge={t('setup.trialBadge')}
            message={t('setup.madeUpOnly')}
          />
        ) : (
          <Notice testID="real-names" variant="notice" badge={t('realNames.badge')} message={t('realNames.setup')} />
        )}
        <View style={styles.form}>
          <TextField
            testID="pupil-name"
            label={t('setup.name')}
            placeholder={t('setup.pupilPlaceholder')}
            value={form.name}
            onChangeText={form.setName}
          />
          <ChipGroup
            testID="pupil-sex"
            label={t('setup.sex')}
            choices={[
              { value: 'm' as const, label: t('setup.male') },
              { value: 'f' as const, label: t('setup.female') },
            ]}
            selected={form.sex}
            onSelect={form.setSex}
          />
          {joint && (
            <ChipGroup
              testID="pupil-year"
              label={t('joint.year')}
              choices={levelGroups(joint).map((group) => ({
                value: group.grade,
                label: gradeName(profile, group.grade),
              }))}
              selected={form.year}
              onSelect={form.setYear}
            />
          )}
          <TextField
            testID="pupil-registration"
            label={t('setup.registration')}
            optionalLabel={t('setup.optional')}
            placeholder={t('setup.registrationPlaceholder')}
            value={form.registration}
            onChangeText={(text) => form.setRegistration(text.replace(/\D/g, ''))}
            keyboardType="number-pad"
            textDirection="ltr"
            error={taken ? t('setup.registrationTaken') : undefined}
            onSubmitEditing={keep}
          />
          <Button
            testID="pupil-keep"
            variant="soft"
            label={form.editing ? t('setup.savePupil') : t('setup.addPupil')}
            disabled={!ready}
            onPress={keep}
          />
          {form.editing && (
            <View style={styles.centre}>
              <Button
                testID="pupil-remove"
                variant="plain"
                label={t('setup.removePupil')}
                onPress={() => form.editing && remove(form.editing.id)}
              />
              <Button testID="pupil-cancel" variant="plain" label={t('setup.cancel')} onPress={() => form.load(null)} />
            </View>
          )}
        </View>
        <View style={styles.tally}>
          <Text style={[styles.count, align]}>{t('setup.typed', { count: pupils.length })}</Text>
          <Text style={[styles.sub, align]}>{t('setup.noLimit')}</Text>
          {joint && (
            <Text testID="year-tally" style={[styles.sub, styles.wide, align]}>
              {yearTally(state.pupils.values(), joint)
                .map(({ grade, count }) =>
                  t('joint.tally', { year: gradeName(profile, grade), pupils: t('setup.pupils', { count }) }),
                )
                .join(' · ')}
            </Text>
          )}
        </View>
        <View>
          {pupils.map((pupil, index) => (
            <Row key={pupil.id} pupil={pupil} at={index + 1} year={yearOf(pupil)} onPress={() => form.load(pupil)} />
          ))}
        </View>
        {unsaved && (
          <Text testID="not-saved" accessibilityLiveRegion="polite" style={[styles.unsaved, align]}>
            {t('setup.notSaved')}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="list-save" label={t('setup.saveList')} onPress={onDone} />
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
  sub: { ...typography.caption, color: colors.ink2 },
  form: {
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  centre: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing['space-8'] },
  tally: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing['space-8'] },
  count: { ...typography.label, color: colors.ink },
  wide: { flexBasis: '100%' },
  row: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    paddingVertical: spacing['space-10'],
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.sheet,
    paddingHorizontal: spacing['space-12'],
  },
  at: { ...typography.body, color: colors.ink2, minWidth: 24, textAlign: 'center' },
  words: { flex: 1, minWidth: 0 },
  name: { ...typography.body, color: colors.ink },
  second: { ...typography.caption, color: colors.ink2 },
  number: { writingDirection: 'ltr' },
  badge: {
    paddingHorizontal: spacing['space-10'],
    paddingVertical: spacing['space-2'],
    borderRadius: radius['radius-badge'],
    backgroundColor: colors['pill-on'],
  },
  badgeText: { ...typography.badge, color: colors.ink2 },
  unsaved: { ...typography.label, color: colors.ink },
  foot: { paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
