// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The side panel that adds or edits a school in the Ministry's list (answers
// 804 and 809), as N-Reference draws it: wilaya, commune and cycle selects,
// then the school's name, the only thing typed. A new school takes its
// commune's next free code; an edited one keeps its code, so phones that chose
// it keep it.

import type { CountryProfile, DirectorySchool, ReferenceDraft } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../android/src/components/Button';
import { TextField } from '../../android/src/components/TextField';
import { controlIcon } from '../../android/src/design/Icon';
import { colors, spacing, typography } from '../../android/src/design/tokens';
import { localized } from '../../android/src/setup/names';
import { useDashboardText } from './text';
import { communesOf } from './communes';
import { PickField } from './PickField';
import { placeLabel } from './place-rules';
import { newSchoolId, withSchool } from './reference-rules';

export type SchoolFormProps = {
  readonly profile: CountryProfile;
  readonly editing?: DirectorySchool;
  /** The filters' wilaya and commune, which a new school starts from. */
  readonly start: { readonly wilaya: string | null; readonly commune: string | null };
  /** The schools of the published list, whose codes a new school never takes. */
  readonly published: readonly DirectorySchool[];
  readonly onDone: (step: ((draft: ReferenceDraft) => ReferenceDraft) | null) => void;
};

/** One school's place, cycle and name. */
export function SchoolForm({ profile, editing, start, published, onDone }: SchoolFormProps) {
  const t = useDashboardText();
  const { direction } = useLocale();
  const [wilaya, setWilaya] = useState(editing?.wilaya ?? start.wilaya);
  const [commune, setCommune] = useState(editing?.commune.code ?? start.commune);
  const [level, setLevel] = useState<string | null>(editing?.level ?? null);
  const [name, setName] = useState(editing?.name ?? '');
  const [tried, setTried] = useState(false);
  const place = communesOf(wilaya).find((one) => one.code === commune);
  const named = name.trim();
  const ready = wilaya !== null && place !== undefined && level !== null && named !== '' && named.length <= 120;
  const save = () => {
    setTried(true);
    if (!ready) return;
    onDone((draft) => {
      const id = editing?.id ?? newSchoolId(draft.schools, place.code, published);
      return withSchool(draft, { id, name: named, level, wilaya, commune: place });
    });
  };
  return (
    <View testID="school-form" style={styles.form}>
      <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction, textAlign: 'start' }]}>
        {t(editing === undefined ? 'dashboard.schools.add' : 'dashboard.schools.edit')}
      </Text>
      <PickField
        testID="school-form-wilaya"
        label={t('dashboard.place.wilaya')}
        choices={(profile.zones ?? []).map((zone) => ({ value: zone.code, label: placeLabel(zone.code, zone.name) }))}
        value={wilaya}
        onChange={(value) => {
          setWilaya(value);
          setCommune(null);
        }}
      />
      <PickField
        testID="school-form-commune"
        label={t('dashboard.place.commune')}
        choices={communesOf(wilaya).map((one) => ({ value: one.code, label: placeLabel(one.code, one.name) }))}
        value={commune}
        disabled={wilaya === null}
        onChange={setCommune}
      />
      <PickField
        testID="school-form-level"
        label={t('dashboard.schools.level')}
        choices={profile.levels.map((one) => ({ value: one.code, label: localized(one.name) }))}
        value={level}
        onChange={setLevel}
      />
      <TextField
        testID="school-form-name"
        label={t('dashboard.schools.name')}
        value={name}
        onChangeText={setName}
        maxLength={120}
        error={tried && named === '' ? t('dashboard.schools.nameNeeded') : undefined}
        onSubmitEditing={save}
      />
      <View style={styles.buttons}>
        <Button testID="school-form-save" icon={controlIcon('check')} label={t('dashboard.save')} onPress={save} />
        <Button
          testID="school-form-cancel"
          variant="line"
          icon={controlIcon('cross')}
          label={t('dashboard.cancel')}
          onPress={() => onDone(null)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing['space-14'] },
  title: { ...typography.h3, color: colors.ink },
  buttons: { gap: spacing['space-8'] },
});
