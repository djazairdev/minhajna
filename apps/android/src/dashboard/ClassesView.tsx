// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes' main column (answer 807): the title and adding a class; how
// many classes and pupils, classes with no list and subjects with no teacher,
// amber when there are some; the filters by year and by what is missing; and
// the classes, each opening its side panel.

import { MAX_BOOK_CLASSES } from '@minhajna/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { gradeName } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { ClassPanel } from './ClassPanel';
import { NewClassForm } from './NewClassForm';
import { Chips, Figure, Figures, PageTitle, Quiet, RowLink } from './page-parts';
import { gaps, unitsOf } from './school-rules';
import type { SchoolDeskView } from './SchoolDesk';
import { Table } from './Table';

const MISSING = ['noList', 'noTeacher'] as const;

/** The school's classes. */
export function ClassesView(view: SchoolDeskView) {
  const { profile, list, school, book, update, onAside } = view;
  const t = useDeviceText();
  const [filter, setFilter] = useState('all');
  const [chosen, setChosen] = useState<string | null>(null);
  const level = list.levels.find((one) => one.code === school.level);
  const grades = profile.levels.find((one) => one.code === school.level)?.grades ?? [];
  const units = unitsOf(level);
  const pupils = book.classes.reduce((count, one) => count + one.pupils.length, 0);
  const noList = book.classes.filter((one) => one.pupils.length === 0).length;
  const noTeacher = book.classes.reduce((count, one) => count + gaps(one, units), 0);
  const shown = book.classes
    .filter(
      (one) =>
        filter === 'all' ||
        (filter === 'noList'
          ? one.pupils.length === 0
          : filter === 'noTeacher'
            ? gaps(one, units) > 0
            : one.grade === filter),
    )
    .sort((one, other) => one.name.localeCompare(other.name, undefined, { numeric: true }));
  const open = (classId: string) => {
    setChosen(classId);
    onAside(<ClassPanel key={classId} {...view} classId={classId} />);
  };
  return (
    <View style={styles.view}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <PageTitle>{t('dashboard.home.school')}</PageTitle>
        </View>
        <Button
          testID="classes-add"
          variant="line"
          icon={controlIcon('plus')}
          label={t('dashboard.classes.add')}
          disabled={book.classes.length >= MAX_BOOK_CLASSES}
          onPress={() =>
            onAside(
              <NewClassForm
                key="new"
                book={book}
                grades={grades}
                onDone={(step) => {
                  if (step !== null) update(step);
                  onAside(null);
                }}
              />,
            )
          }
        />
      </View>
      <Figures>
        <Figure testID="classes-count" value={book.classes.length} label={t('dashboard.classes.classes')} />
        <Figure testID="classes-pupils" value={pupils} label={t('dashboard.classes.pupils')} />
        <Figure testID="classes-no-list" value={noList} label={t('dashboard.classes.noListCount')} warn={noList > 0} />
        <Figure
          testID="classes-no-teacher"
          value={noTeacher}
          label={t('dashboard.classes.noTeacherCount')}
          warn={noTeacher > 0}
        />
      </Figures>
      <Chips
        testID="classes-filter"
        label={t('dashboard.classes.filter')}
        choices={[
          { value: 'all', label: t('dashboard.classes.all') },
          ...grades.map((grade) => ({ value: grade.code, label: gradeName(profile, grade.code) })),
          ...MISSING.map((one) => ({ value: one, label: t(`dashboard.classes.${one}`) })),
        ]}
        value={filter}
        onChange={setFilter}
      />
      <Table
        testID="classes-table"
        label={t('dashboard.home.school')}
        columns={[
          { id: 'class', label: t('dashboard.classes.column.class'), grow: 1 },
          { id: 'pupils', label: t('dashboard.classes.column.pupils'), width: 90 },
          { id: 'teachers', label: t('dashboard.classes.column.teachers'), width: 130 },
          { id: 'state', label: t('dashboard.classes.column.state'), width: 150 },
        ]}
        rows={shown.map((one) => {
          const missing = gaps(one, units);
          return {
            key: one.id,
            chosen: one.id === chosen,
            cells: [
              <RowLink key="open" testID={`class-${one.id}`} label={one.name} onPress={() => open(one.id)} />,
              one.pupils.length,
              t('dashboard.classes.taught', { done: units.length - missing, all: units.length }),
              one.pupils.length === 0
                ? t('dashboard.classes.noList')
                : missing > 0
                  ? t('dashboard.classes.noTeacher')
                  : t('dashboard.classes.ready'),
            ],
          };
        })}
      />
      <Quiet>{t('dashboard.schools.shown', { shown: shown.length, total: book.classes.length })}</Quiet>
    </View>
  );
}

const styles = StyleSheet.create({
  view: { gap: spacing['space-12'] },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing['space-8'] },
  grow: { flex: 1, minWidth: 200 },
});
