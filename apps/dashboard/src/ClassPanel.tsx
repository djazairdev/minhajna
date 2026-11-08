// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes' side panel for the class chosen (answers 807 to 809): its name,
// how many pupils and its year, then three tabs: its pupils, who teaches each
// of its subjects, and its week. The panel reads the newest book each time it
// draws (desk-book.ts), so it never holds a copy of its own.

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SegmentedControl } from '../../android/src/components/SegmentedControl';
import { colors, spacing, typography } from '../../android/src/design/tokens';
import { gradeName } from '../../android/src/setup/names';
import { useDashboardText } from './text';
import { AssignTab } from './AssignTab';
import { Quiet } from './page-parts';
import { PupilsTab } from './PupilsTab';
import type { SchoolDeskView } from './SchoolDesk';
import { useDeskBook } from './desk-book';
import { WeekTab } from './WeekTab';

/** One class's panel. */
export function ClassPanel(props: SchoolDeskView & { readonly classId: string }) {
  const t = useDashboardText();
  const { direction } = useLocale();
  const view = { ...props, ...useDeskBook(props) };
  const [tab, setTab] = useState<'pupils' | 'teachers' | 'week'>('pupils');
  const schoolClass = view.book.classes.find((one) => one.id === props.classId);
  if (schoolClass === undefined) return null;
  return (
    <View testID="class-panel" style={styles.panel}>
      <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction, textAlign: 'start' }]}>
        {schoolClass.name}
      </Text>
      <Quiet>
        {[
          t('dashboard.classes.listed', { count: schoolClass.pupils.length }),
          gradeName(view.profile, schoolClass.grade),
        ].join(' · ')}
      </Quiet>
      <SegmentedControl
        testID="class-tab"
        label={schoolClass.name}
        choices={[
          { value: 'pupils', label: t('dashboard.classes.tab.pupils') },
          { value: 'teachers', label: t('dashboard.classes.tab.teachers') },
          { value: 'week', label: t('dashboard.classes.tab.week') },
        ]}
        selected={tab}
        onSelect={setTab}
      />
      {tab === 'pupils' && <PupilsTab {...view} schoolClass={schoolClass} />}
      {tab === 'teachers' && <AssignTab {...view} schoolClass={schoolClass} />}
      {tab === 'week' && <WeekTab {...view} schoolClass={schoolClass} />}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing['space-12'] },
  title: { ...typography.h3, color: colors.ink },
});
