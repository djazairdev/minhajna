// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes' teachers tab (answers 807 and 809): for each of the class's
// subjects, or each option where the level has a class teacher, a select of
// the school's teachers whose option holds it; one with no teacher is marked.
// A teacher is added on the teachers' page first.

import type { BookClass } from '@minhajna/core';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import { useDeviceText } from '../text/device-text';
import { Quiet } from './page-parts';
import { PickField } from './PickField';
import { optionName } from './reference-rules';
import { candidates, unitsOf, unitTeacher, withUnitTeacher, type Unit } from './school-rules';
import type { SchoolDeskView } from './SchoolDesk';

const NONE = '-';

/** Who teaches the class what. */
export function AssignTab({
  profile,
  list,
  school,
  book,
  update,
  schoolClass,
}: SchoolDeskView & { readonly schoolClass: BookClass }) {
  const t = useDeviceText();
  const level = list.levels.find((one) => one.code === school.level);
  const units = unitsOf(level);
  const name = (unit: Unit) =>
    unit.option === null ? subjectName(profile, unit.subjects[0] ?? '') : optionName(t, profile, unit.option);
  if (units.length === 0) return <Quiet>{t('dashboard.assign.noOptions')}</Quiet>;
  return (
    <View style={styles.tab}>
      {book.teachers.length === 0 && <Quiet testID="assign-no-teachers">{t('dashboard.assign.noTeachers')}</Quiet>}
      {units.map((unit) => {
        const teacher = unitTeacher(schoolClass, unit);
        return (
          <PickField
            key={unit.key}
            testID={`assign-${unit.key}`}
            label={name(unit)}
            warn={teacher === null}
            choices={[
              { value: NONE, label: t('dashboard.assign.none') },
              ...candidates(book, level, unit).map((one) => ({ value: one.id, label: one.name })),
            ]}
            value={teacher ?? NONE}
            onChange={(value) =>
              update((current) => withUnitTeacher(current, schoolClass.id, unit, value === NONE ? null : value))
            }
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: spacing['space-10'] },
});
