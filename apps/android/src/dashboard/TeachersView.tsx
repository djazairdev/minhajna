// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's teachers and their joining codes (answers 808 and 809, as
// D-Issue draws them): adding a teacher with their name and option; the
// teachers, each with their option, how many classes they teach and whether
// their code is ready; a teacher's panel to see, print or renew the code; and
// printing every code at once. The server issues a code when the book is
// saved, so a teacher just added waits for it a moment.

import type { BookTeacher } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import qr from '../native/NativeMinhajnaCalendarInput';
import pdf from '../native/NativeMinhajnaPdf';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { codeSheetHtml } from './code-sheet';
import { PageTitle, Quiet, RowLink } from './page-parts';
import { optionName } from './reference-rules';
import { codeShown } from './school-rules';
import type { SchoolDeskView } from './SchoolDesk';
import { Table } from './Table';
import { TeacherForm } from './TeacherForm';
import { TeacherPanel } from './TeacherPanel';

/** The teachers' page. */
export function TeachersView(view: SchoolDeskView) {
  const { profile, list, school, book, update, onAside } = view;
  const t = useDeviceText();
  const { direction } = useLocale();
  const [chosen, setChosen] = useState<string | null>(null);
  const [printFailed, setPrintFailed] = useState(false);
  const level = list.levels.find((one) => one.code === school.level);
  const optionOf = (code: string) => {
    const option = level?.options.find((one) => one.code === code);
    return option === undefined ? code : optionName(t, profile, option);
  };
  const teaches = (id: string) => book.classes.filter((one) => Object.values(one.teachers).includes(id)).length;
  const sorted = [...book.teachers].sort((one, other) => one.name.localeCompare(other.name));
  const print = (chosenOnes: readonly BookTeacher[]) => {
    const teachers = chosenOnes
      .filter((one) => one.code !== undefined)
      .map((one) => ({
        name: one.name,
        option: optionOf(one.option),
        code: codeShown(one.code!),
        rows: qr.qrRows(codeShown(one.code!)),
      }));
    if (teachers.length === 0) return;
    setPrintFailed(false);
    const html = codeSheetHtml(t, { school: school.name, teachers }, currentLanguage(), direction);
    pdf.printHtml(html, t('dashboard.teachers.sheet.title'), false).catch(() => setPrintFailed(true));
  };
  const open = (id: string) => {
    setChosen(id);
    onAside(<TeacherPanel key={id} {...view} teacherId={id} optionOf={optionOf} onPrint={print} />);
  };
  return (
    <View style={styles.view}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <PageTitle>{t('dashboard.teachers.title')}</PageTitle>
        </View>
        <Button
          testID="teachers-print"
          variant="line"
          icon={controlIcon('print')}
          label={t('dashboard.teachers.printAll')}
          onPress={() => print(sorted)}
        />
        <Button
          testID="teachers-add"
          variant="line"
          icon={controlIcon('plus')}
          label={t('dashboard.teachers.add')}
          onPress={() =>
            onAside(
              <TeacherForm
                key="new"
                profile={profile}
                level={level}
                onDone={(step) => {
                  if (step !== null) update(step);
                  onAside(null);
                }}
              />,
            )
          }
        />
      </View>
      {printFailed && <Quiet testID="teachers-print-failed">{t('dashboard.teachers.printFailed')}</Quiet>}
      {sorted.length === 0 ? (
        <Quiet testID="teachers-none">{t('dashboard.teachers.none')}</Quiet>
      ) : (
        <Table
          testID="teachers-table"
          label={t('dashboard.teachers.title')}
          columns={[
            { id: 'name', label: t('dashboard.teachers.column.name'), grow: 1 },
            { id: 'option', label: t('dashboard.teachers.column.option'), grow: 1 },
            { id: 'classes', label: t('dashboard.teachers.column.classes'), width: 90 },
            { id: 'code', label: t('dashboard.teachers.column.code'), width: 200 },
          ]}
          rows={sorted.map((one) => ({
            key: one.id,
            chosen: one.id === chosen,
            cells: [
              <RowLink key="name" testID={`teacher-${one.id}`} label={one.name} onPress={() => open(one.id)} />,
              optionOf(one.option),
              teaches(one.id),
              one.code === undefined ? t('dashboard.teachers.codeComing') : codeShown(one.code),
            ],
          }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  view: { gap: spacing['space-12'] },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing['space-8'] },
  grow: { flex: 1, minWidth: 200 },
});
