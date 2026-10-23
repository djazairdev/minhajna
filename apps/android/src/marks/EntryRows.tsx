// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Marks hub's rows of marks to enter (#239, #240): one for each of the
// term's tests, with its day and how many of its pupils are done, or «لا فرض في
// هذا الفصل بعد» opening «مواعيد الفروض»; «الاختبار», with its window's first
// day, for a subject with a term exam; and in lycée, «الأعمال التطبيقية» or
// «الشفهي» when the formula the administration chose weighs it. A class
// archived after the reshaping shows them but takes no new marks.

import { termTests, type AssessmentData, type Context, type Formula } from '@minhajna/core';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { entryDone, entrySheet, SHEET_TEXTS, type EntrySheet, type SatPart } from './entry-rules';

const PARTS = [
  { part: 'P', kind: 'practical' },
  { part: 'O', kind: 'oral' },
] as const;

export type EntryRowsProps = {
  readonly context: Context;
  readonly data: AssessmentData;
  readonly courseId: string;
  readonly term: number;
  /** The formula the class and subject follows; none for continuous assessment only. */
  readonly formula: Formula | undefined;
  readonly archived: boolean;
  readonly onTests: () => void;
  readonly onEntry: (term: number, testId?: string) => void;
  readonly onPart: (term: number, part: 'practical' | 'oral') => void;
};

export function EntryRows({
  context,
  data,
  courseId,
  term,
  formula,
  archived,
  onTests,
  onEntry,
  onPart,
}: EntryRowsProps) {
  const t = useText();
  const { profile } = useAppData();
  const sheetOf = (testId?: string, part?: SatPart) => entrySheet(context, data, courseId, term, testId, part);
  const entryLine = (sheet: EntrySheet) =>
    t('marks.entry.rowLine', {
      day: dayName(t, sheet.day, currentLanguage(), profile),
      done: entryDone(context, courseId, term, sheet).done,
      total: sheet.listed.length,
    });
  const tests = termTests(context, courseId, term);
  const exams = sheetOf();
  const parts = PARTS.filter(({ part }) => (formula?.weights[part] ?? 0) > 0);
  return (
    <>
      {tests.length === 0 && (
        <RowLink
          testID="marks-no-tests"
          icon={controlIcon('pencil')}
          title={t('marks.entry.noTests')}
          description={t('tests.openLine')}
          onPress={onTests}
        />
      )}
      {tests.map((test) => {
        const sheet = sheetOf(test.id);
        return (
          <RowLink
            key={test.id}
            testID={`marks-test-${test.id}`}
            icon={controlIcon('pencil')}
            title={test.title}
            description={sheet === null ? '' : entryLine(sheet)}
            disabled={archived || sheet === null}
            onPress={() => onEntry(term, test.id)}
          />
        );
      })}
      {formula !== undefined && (
        <RowLink
          testID="marks-exam"
          icon={controlIcon('pencil')}
          title={t('marks.entry.exam')}
          description={exams === null ? t('marks.entry.noExam') : entryLine(exams)}
          disabled={archived || exams === null}
          onPress={() => onEntry(term)}
        />
      )}
      {parts.map(({ kind }) => {
        const sheet = sheetOf(undefined, kind);
        return (
          <RowLink
            key={kind}
            testID={`marks-${kind}`}
            icon={controlIcon('pencil')}
            title={t(SHEET_TEXTS[kind].title)}
            description={sheet === null ? t('marks.entry.noExam') : entryLine(sheet)}
            disabled={archived || sheet === null}
            onPress={() => onPart(term, kind)}
          />
        );
      })}
    </>
  );
}
