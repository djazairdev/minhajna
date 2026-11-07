// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Settings' schools (answers 802 to 809): each school the teacher holds, with
// its level and subjects, Change to choose it again from the directory's list
// and "Add another school" to add one, with the same selects as setup and
// nothing typed. A school typed in an earlier version still shows by its name
// until it is changed. Existing classes keep the levels and subjects they use
// (school-guards.ts), and a school with classes cannot be removed; another one
// can, while a school remains. A school the teacher holds as another is not
// offered again. The phone's Back leaves a choice unsaved, as Cancel does, and
// a choice that changes nothing records nothing.

import type { School } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon, Icon } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { schoolLine } from '../setup/names';
import { chosenSchool, choiceOf, NO_CHOICE, schoolFrom, unchanged, type Choice } from '../setup/school-choice';
import { ReferenceState, SchoolChoice } from '../setup/SchoolChoice';
import { useReference } from '../setup/useReference';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { protectedChoices } from './school-guards';

/** Which school is being chosen again, or a new one. */
type Editing = { readonly id: string; readonly before?: School } | null;

/** The schools page; `onDone` leaves it. */
export function SettingsSchools({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { profile, state, erase, newId } = useAppData();
  const [editing, setEditing] = useState<Editing>(null);
  const schools = [...state.schools.values()];
  const used = (id: string) => [...state.classes.values()].some((one) => one.schoolId === id);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  if (editing !== null) {
    return <ChooseAgain editing={editing} onDone={() => setEditing(null)} />;
  }
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, sides, { direction, paddingBottom: insets.bottom + spacing['space-16'] }]}
    >
      {schools.some((school) => used(school.id)) && (
        <Notice testID="settings-school-guard" icon={controlIcon('lock')} message={t('settings.schoolGuard')} />
      )}
      {schools.map((school) => (
        <View key={school.id} testID={`school-${school.id}`} style={styles.summary}>
          <Icon name="school" size={sizes.icon} color={colors.board} />
          <View style={styles.words}>
            <Text style={[styles.name, align]}>{school.name.trim() || t('setup.unnamed')}</Text>
            <Text style={[styles.line, align]}>{schoolLine(t, profile, school)}</Text>
          </View>
          <Pressable
            testID={`change-${school.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('setup.changeSchool', { school: school.name.trim() || t('setup.unnamed') })}
            onPress={() => setEditing({ id: school.id, before: school })}
            style={({ pressed }) => [styles.change, pressed && styles.pressed]}
          >
            <Icon name="pencil" size={sizes['icon-small']} color={colors.ink} />
            <Text style={styles.changeWord}>{t('setup.change')}</Text>
          </Pressable>
        </View>
      ))}
      <Button
        testID="add-school"
        variant="line"
        icon={controlIcon('plus')}
        label={t('setup.addSchool')}
        onPress={() => setEditing({ id: newId() })}
      />
      {schools
        .filter((school) => schools.length > 1 && !used(school.id))
        .map((school) => (
          <Button
            key={school.id}
            testID={`delete-${school.id}`}
            variant="plain"
            label={t('setup.deleteNamed', { school: school.name.trim() || t('setup.unnamed') })}
            onPress={() => erase((event) => event.kind === 'school.set' && event.school.id === school.id)}
          />
        ))}
      <Button testID="setup-next" label={t('settings.done')} onPress={onDone} />
    </ScrollView>
  );
}

/** Choosing a school again, or a new one, from the directory's list; Save records it and Cancel leaves it as it was. */
function ChooseAgain({ editing: { id, before }, onDone }: { editing: NonNullable<Editing>; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { profile, state, record } = useAppData();
  const { load, retry } = useReference();
  const [picked, setPicked] = useState<Choice | null>(null);
  const list = load.kind === 'ready' ? load.list : null;
  const choice = picked ?? (list === null ? NO_CHOICE : choiceOf(list, before));
  const chosen = list === null ? null : chosenSchool(list, choice);
  const held = [...state.schools.values()].flatMap((one) =>
    one.id === id || one.code === undefined ? [] : [one.code],
  );
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const back = useEffectEvent(onDone);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => listener.remove();
  }, []);
  const save = () => {
    if (chosen === null) return;
    const school = schoolFrom(chosen, id, before);
    const levels = protectedChoices(state, id, 'levels', school.levels);
    const subjects = protectedChoices(state, id, 'subjects', school.subjects);
    const kept = { ...school, levels, subjects };
    if (!unchanged(kept, before)) record({ kind: 'school.set', school: kept });
    onDone();
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, sides, { direction, paddingBottom: insets.bottom + spacing['space-16'] }]}
      keyboardShouldPersistTaps="handled"
    >
      <ReferenceState load={load} onRetry={retry} />
      {list !== null && <SchoolChoice profile={profile} list={list} choice={choice} onChoice={setPicked} held={held} />}
      <Button
        testID="school-save"
        icon={controlIcon('check')}
        label={t('setup.useSchool')}
        disabled={chosen === null}
        onPress={save}
      />
      <Button testID="school-cancel" variant="plain" label={t('setup.cancel')} onPress={onDone} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    minHeight: sizes.target,
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  words: { flex: 1, minWidth: 0 },
  name: { ...typography['bar-title'], color: colors.ink },
  line: { ...typography.caption, color: colors.ink2 },
  change: {
    minWidth: sizes.target,
    minHeight: sizes.target,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-6'],
    paddingHorizontal: spacing['space-8'],
    borderRadius: radius['radius-button'],
  },
  pressed: { backgroundColor: colors.soft },
  changeWord: { ...typography.button, color: colors.ink },
});
