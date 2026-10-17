// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Typing a class list (#27, Setup-4c-Type, R-3.2-11): the name, the sex and,
// if the teacher has it, the registration number. Each pupil is saved when
// added, the list is sorted alphabetically, and there is no limit on its size.
// Tapping a pupil loads them back into the form, to correct or remove. Until
// the pilot, teachers type made-up names only, and the screen says so (choice
// F1 of the field check, #49).

import type { Pupil } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { registrationTaken, sortedPupils, typedPupil } from './class-rules';

type Sex = 'f' | 'm';

/** The form, empty for a new pupil or filled with the one being corrected. */
function useForm() {
  const [editing, setEditing] = useState<Pupil | null>(null);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('m');
  const [registration, setRegistration] = useState('');
  const load = (pupil: Pupil | null) => {
    setEditing(pupil);
    setName(pupil?.name ?? '');
    if (pupil) setSex(pupil.sex);
    setRegistration(pupil?.registration ?? '');
  };
  return { editing, name, setName, sex, setSex, registration, setRegistration, load };
}

/** One typed pupil, in the list's order. */
function Row({ pupil, at, onPress }: { pupil: Pupil; at: number; onPress: () => void }) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sex = pupil.sex === 'f' ? t('setup.female') : t('setup.male');
  const second = pupil.registration ?? t('setup.noRegistration');
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
        <Text style={[styles.second, align, pupil.registration !== undefined && styles.number]}>{second}</Text>
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
  const t = useText();
  const { state, record, erase, newId, unsaved } = useAppData();
  const form = useForm();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const pupils = sortedPupils(state.pupils.values(), classId);
  const taken = registrationTaken(state.pupils.values(), classId, form.registration, form.editing?.id);
  const ready = form.name.trim() !== '' && !taken;
  const keep = () => {
    if (!ready) return;
    const id = form.editing?.id ?? newId();
    const pupil = typedPupil({ id, classId, name: form.name, sex: form.sex }, form.registration);
    record({
      kind: 'pupil.set',
      pupil: { ...pupil, groups: form.editing?.groups ?? [], movements: form.editing?.movements ?? [] },
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
        <Notice testID="made-up-only" variant="notice" badge={t('setup.trialBadge')} message={t('setup.madeUpOnly')} />
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
        </View>
        <View>
          {pupils.map((pupil, index) => (
            <Row key={pupil.id} pupil={pupil} at={index + 1} onPress={() => form.load(pupil)} />
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
