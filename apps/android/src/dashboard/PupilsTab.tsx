// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes' pupils tab (answer 807): the class's list, each pupil's name, sex
// and registration number; a pupil chosen can move to another class or leave,
// which takes them out of the list and the teachers' phones record it as a
// leaving, once confirmed; a pupil added by hand with their name, sex and
// registration number, which a later import matches on. A class holds at most
// as many pupils as the core allows.

import { MAX_CLASS_PUPILS, type BookClass, type BookPupil } from '@minhajna/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { Quiet, RowLink } from './page-parts';
import { PickField } from './PickField';
import { idsOf, movedPupil, newId, registrationTaken, withoutPupil, withPupil } from './school-rules';
import type { SchoolDeskView } from './SchoolDesk';
import { Table } from './Table';

const REGISTRATION = /^[A-Za-z0-9_+-]{1,64}$/u;

/** A pupil typed by hand. */
function AddPupil({ view, schoolClass }: { view: SchoolDeskView; schoolClass: BookClass }) {
  const t = useDeviceText();
  const [name, setName] = useState('');
  const [sex, setSex] = useState<string | null>(null);
  const [registration, setRegistration] = useState('');
  const number = registration.trim();
  const badNumber = number !== '' && !REGISTRATION.test(number);
  const taken = number !== '' && registrationTaken(view.book, number);
  const full = schoolClass.pupils.length >= MAX_CLASS_PUPILS;
  const ready =
    name.trim() !== '' && name.trim().length <= 120 && sex !== null && number !== '' && !badNumber && !taken && !full;
  const add = () => {
    if (!ready) return;
    view.update((book) => {
      const pupil: BookPupil = {
        id: newId('p', idsOf(book)),
        name: name.trim(),
        sex: sex === 'f' ? 'f' : 'm',
        registration: number,
      };
      return withPupil(book, schoolClass.id, pupil);
    });
    setName('');
    setRegistration('');
  };
  return (
    <View style={styles.form}>
      <TextField testID="pupil-name" label={t('dashboard.pupils.name')} value={name} onChangeText={setName} />
      <PickField
        testID="pupil-sex"
        label={t('dashboard.pupils.sex')}
        choices={[
          { value: 'f', label: t('dashboard.pupils.female') },
          { value: 'm', label: t('dashboard.pupils.male') },
        ]}
        value={sex}
        onChange={setSex}
      />
      <TextField
        testID="pupil-registration"
        label={t('dashboard.pupils.registration')}
        value={registration}
        onChangeText={setRegistration}
        textDirection="ltr"
        error={
          taken
            ? t('dashboard.pupils.taken')
            : badNumber
              ? t('dashboard.pupils.badNumber')
              : full
                ? t('dashboard.pupils.full')
                : undefined
        }
        onSubmitEditing={add}
      />
      <Button
        testID="pupil-add"
        icon={controlIcon('plus')}
        label={t('dashboard.pupils.add')}
        disabled={!ready}
        onPress={add}
      />
    </View>
  );
}

/** The class's pupils. */
export function PupilsTab(view: SchoolDeskView & { readonly schoolClass: BookClass }) {
  const { book, update, schoolClass } = view;
  const t = useDeviceText();
  const [acting, setActing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pupil = schoolClass.pupils.find((one) => one.id === acting);
  const others = book.classes.filter(
    (one) => one.id !== schoolClass.id && one.grade === schoolClass.grade && one.pupils.length < MAX_CLASS_PUPILS,
  );
  const sorted = [...schoolClass.pupils].sort((one, other) => one.name.localeCompare(other.name));
  return (
    <View style={styles.tab}>
      {sorted.length === 0 ? (
        <Quiet testID="pupils-none">{t('dashboard.pupils.none')}</Quiet>
      ) : (
        <Table
          testID="pupils-table"
          label={t('dashboard.classes.tab.pupils')}
          columns={[
            { id: 'name', label: t('dashboard.pupils.name'), grow: 1 },
            { id: 'sex', label: t('dashboard.pupils.sex'), width: 60 },
            { id: 'registration', label: t('dashboard.pupils.registration'), width: 110 },
          ]}
          rows={sorted.map((one) => ({
            key: one.id,
            chosen: one.id === acting,
            cells: [
              <RowLink
                key="name"
                testID={`pupil-${one.id}`}
                label={one.name}
                onPress={() => {
                  setActing(one.id === acting ? null : one.id);
                  setLeaving(false);
                }}
              />,
              t(one.sex === 'f' ? 'dashboard.pupils.female' : 'dashboard.pupils.male'),
              one.registration ?? '—',
            ],
          }))}
        />
      )}
      {pupil !== undefined && (
        <View testID="pupil-acting" style={styles.form}>
          {others.length > 0 && (
            <PickField
              testID="pupil-move"
              label={t('dashboard.pupils.move')}
              choices={others.map((one) => ({ value: one.id, label: one.name }))}
              value={null}
              onChange={(to) => {
                update((current) => movedPupil(current, pupil.id, to));
                setActing(null);
              }}
            />
          )}
          {leaving ? (
            <Button
              testID="pupil-leave-sure"
              variant="danger"
              label={t('dashboard.pupils.leaveSure', { name: pupil.name })}
              onPress={() => {
                update((current) => withoutPupil(current, pupil.id));
                setActing(null);
                setLeaving(false);
              }}
            />
          ) : (
            <Button
              testID="pupil-leave"
              variant="line"
              icon={controlIcon('cross')}
              label={t('dashboard.pupils.leave')}
              onPress={() => setLeaving(true)}
            />
          )}
        </View>
      )}
      {adding ? (
        <AddPupil view={view} schoolClass={schoolClass} />
      ) : (
        <Button
          testID="pupil-start"
          variant="line"
          icon={controlIcon('plus')}
          label={t('dashboard.pupils.add')}
          onPress={() => setAdding(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: spacing['space-10'] },
  form: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.well,
  },
});
