// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One school's fields on Setup-2-Teaching (#25). Alone, they follow
// Setup-2-Teaching: levels, subjects, then the school's name and wilaya. In a
// card, among several schools, they follow Setup-2b-Schools: the name and
// wilaya first, then levels and subjects named after the school. Bivalent
// teachers pick two subjects (R-3.2-23). Each school has its own wilaya, as
// the calendar's zone layer covers a school.

import type { CountryProfile, School } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { Icon } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { levelName, localized, schoolLine } from './names';
import { shownSubjects } from './school-rules';
import { ZonePicker } from './ZonePicker';

export interface SchoolFieldsProps {
  readonly profile: CountryProfile;
  readonly school: School;
  /** Alone on the screen, or one card among several, numbered from 1. */
  readonly layout: 'single' | { readonly number: number };
  readonly onLevels: (levels: string[]) => void;
  readonly onSubjects: (subjects: string[]) => void;
  readonly onName: (name: string) => void;
  readonly onNameDone: () => void;
  readonly onZone: (code: string) => void;
  /** Offered only while there is another school. */
  readonly onDelete?: () => void;
}

/** The levels, subjects and name of one school. */
export function SchoolFields(props: SchoolFieldsProps) {
  const { profile, school, layout } = props;
  const t = useText();
  const [all, setAll] = useState(false);
  const { shown, hidden } = shownSubjects(profile, school, all);
  const name = school.name.trim();
  const named = (key: 'level' | 'subject') =>
    layout !== 'single' && name !== '' ? t(`setup.${key}In`, { school: name }) : t(`setup.${key}`);
  const count = school.subjects.length;
  const subjectHint =
    count === 2 ? t('setup.twoSubjects') : count > 2 ? t('setup.severalSubjects') : t('setup.subjectHint');
  const place = (
    <>
      <TextField
        testID={`school-name-${school.id}`}
        label={layout === 'single' ? t('setup.school') : t('setup.schoolNumber', { number: layout.number })}
        placeholder={t('setup.schoolPlaceholder')}
        value={school.name}
        onChangeText={props.onName}
        onBlur={props.onNameDone}
        returnKeyType="done"
      />
      {profile.zones && (
        <ZonePicker testID={`zone-${school.id}`} zones={profile.zones} value={school.zone} onChange={props.onZone} />
      )}
    </>
  );
  const fields = (
    <>
      {layout !== 'single' && place}
      <ChipGroup
        testID={`levels-${school.id}`}
        multiple
        label={named('level')}
        hint={t('setup.levelHint')}
        choices={profile.levels.map((level) => ({ value: level.code, label: levelName(t, profile, level.code) }))}
        selected={school.levels}
        onSelect={props.onLevels}
      />
      <ChipGroup
        testID={`subjects-${school.id}`}
        multiple
        label={named('subject')}
        hint={subjectHint}
        choices={shown.map((subject) => ({ value: subject.code, label: localized(subject.name) }))}
        selected={school.subjects}
        onSelect={props.onSubjects}
        more={hidden > 0 ? { label: t('setup.moreSubjects'), onPress: () => setAll(true) } : undefined}
      />
      {layout === 'single' && place}
      {props.onDelete && (
        <View style={styles.delete}>
          <Button
            testID={`delete-${school.id}`}
            variant="plain"
            label={t('setup.deleteSchool')}
            onPress={props.onDelete}
          />
        </View>
      )}
    </>
  );
  return layout === 'single' ? (
    <View style={styles.fields}>{fields}</View>
  ) : (
    <View testID={`school-${school.id}`} style={[styles.fields, styles.card]}>
      {fields}
    </View>
  );
}

/** A school folded to its name and line, opened again with «تعديل». */
export function SchoolSummary({
  profile,
  school,
  onEdit,
}: {
  profile: CountryProfile;
  school: School;
  onEdit: () => void;
}) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const name = school.name.trim() || t('setup.unnamed');
  const line = schoolLine(t, profile, school);
  return (
    <Pressable
      testID={`summary-${school.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${t('setup.editSchool', { school: name })}. ${line}`}
      onPress={onEdit}
      style={({ pressed }) => [styles.summary, pressed && { borderColor: colors.ink }]}
    >
      <Icon name="school" size={sizes.icon} color={colors.board} />
      <View style={styles.words}>
        <Text style={[styles.name, align]}>{name}</Text>
        <Text style={[styles.line, align]}>{line}</Text>
      </View>
      <Text style={styles.edit}>{t('setup.edit')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing['space-20'] },
  card: {
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  delete: { flexDirection: 'row', justifyContent: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    minHeight: sizes.target,
    minWidth: sizes.target,
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  words: { flex: 1, minWidth: 0 },
  name: { ...typography['bar-title'], color: colors.ink },
  line: { ...typography.caption, color: colors.ink2 },
  edit: { ...typography.button, color: colors.ink },
});
