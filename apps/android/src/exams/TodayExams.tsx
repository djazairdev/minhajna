// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's exam part (#221, Today-exams, answers 268 to 270): the warning
// cards for classes whose plan would push items past the next exams, then,
// on a day an exam window covers, the teacher's invigilations and class
// exams typed for the day and «إضافة حراسة أو اختبار».

import { dutiesOn, examDay, type Context, type Day } from '@minhajna/core';
import { useMemo } from 'react';
import { Button } from '../components/Button';
import { useText } from '../text/i18n';
import { DutyCards } from './DutyCards';
import { ExamWarnings } from './ExamWarnings';

/** What Today's exam part opens: a class's warning answers, and the form for the day's entries. */
export type TodayExamsOpen = {
  readonly warning: (courseId: string) => void;
  readonly duty: (day: Day) => void;
};

export function TodayExams({ context, day, open }: { context: Context; day: Day; open: TodayExamsOpen }) {
  const t = useText();
  const examWeek = useMemo(() => examDay(context, day), [context, day]);
  const duties = examWeek ? dutiesOn(context.state, day) : [];
  return (
    <>
      <ExamWarnings context={context} day={day} onOpen={open.warning} />
      {duties.length > 0 && <DutyCards context={context} duties={duties} />}
      {examWeek && (
        <Button testID="today-duty" variant="line" label={t('duties.open')} onPress={() => open.duty(day)} />
      )}
    </>
  );
}
