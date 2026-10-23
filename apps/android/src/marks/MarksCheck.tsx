// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مقارنة قبل التوقيع» (#242, Marks-check and Marks-check-diff, R-3.7-09,
// answers 466 and 467): once the term's export is ready, a file the teacher
// picks, set beside the register in the control sheet's form. It says how many
// rows match; each differing row first, with «تصحيح في الكشف» and «إعادة تعبئة
// الملف»; the columns the file lacks, and the numbers not on the list or on two
// lines; then every pupil. A file that is not text, over 2 MB, or without the
// list's header is refused with what to do. The file's text stays in memory
// only, and the check is made again from the register each time it changes, so
// a correction shows when the teacher comes back. Nothing is changed.

import { parseCsv } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { colors, spacing, typography } from '../design/tokens';
import { useMounted } from '../documents/output-run';
import { courseLabel } from '../exams/course-label';
import files from '../native/NativeMinhajnaFiles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { i18n, LANGUAGES, useText, type Language } from '../text/i18n';
import { CheckRows, DiffRows } from './CheckRows';
import { csvLabels, fileCheck, refusalOf, type CheckRefusal } from './export-file-rules';
import { courseExport, partName } from './export-rules';
import { termWord } from './marks-rules';

const REFUSALS: Readonly<Record<CheckRefusal, string>> = {
  binary: 'marks.export.check.binary',
  size: 'marks.export.check.size',
  header: 'marks.export.check.header',
  failed: 'marks.export.check.failed',
};

export type MarksCheckProps = {
  readonly courseId: string;
  readonly term: number;
  /** Opens the grade book, to correct the register. */
  readonly onBook: () => void;
  /** Opens the file screen, to make the file again. */
  readonly onFile: () => void;
};

export function MarksCheck({ courseId, term, onBook, onFile }: MarksCheckProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const languages = useMemo(
    () => (Object.keys(LANGUAGES) as Language[]).map((language) => csvLabels(i18n.getFixedT(language))),
    [],
  );
  const [table, setTable] = useState<string[][] | null>(null);
  const [refused, setRefused] = useState<CheckRefusal | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useMounted();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sheet = useMemo(() => courseExport(context, profile, courseId, term), [context, profile, courseId, term]);
  if (sheet === null || !sheet.ready) {
    return <Text style={[styles.body, styles.empty, align]}>{t('marks.export.check.unavailable')}</Text>;
  }
  const nameOf = (pupilId: string) => state.pupils.get(pupilId)?.name ?? '';
  const check = table === null ? null : fileCheck(sheet, table, nameOf, languages);
  const shownRefusal = refused ?? (table !== null && check === null ? 'header' : null);
  const differ = check === null ? 0 : check.rows.length - check.matched;
  const pick = () => {
    if (busy) return;
    setBusy(true);
    files.openText().then(
      (text) => {
        if (!mounted.current) return;
        setBusy(false);
        if (text === null) return;
        setRefused(null);
        setTable(parseCsv(text));
      },
      (error: unknown) => {
        if (!mounted.current) return;
        setBusy(false);
        setTable(null);
        setRefused(refusalOf(error));
      },
    );
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <Text testID="check-line" style={[styles.title, align]}>
        {`${courseLabel(t, state, profile, courseId, true)} · ${termWord(t, term)}`}
      </Text>
      <Text style={[styles.note, align]}>{t('marks.export.check.form')}</Text>
      <Button
        testID="check-pick"
        label={t(table === null ? 'marks.export.check.pick' : 'marks.export.check.again')}
        disabled={busy}
        onPress={pick}
      />
      <Text style={[styles.note, align]}>{t('marks.export.check.which')}</Text>
      {shownRefusal !== null && (
        <Notice
          testID="check-refused"
          variant="notice"
          badge={t('marks.export.check.refusedBadge')}
          message={t(REFUSALS[shownRefusal] as 'marks.export.check.failed')}
        />
      )}
      {check !== null && (
        <>
          <Text testID="check-summary" style={[styles.title, align]}>
            {differ === 0
              ? t('marks.export.check.matched', { matched: check.matched, total: check.rows.length })
              : t('marks.export.check.differ', { matched: check.matched, total: check.rows.length, count: differ })}
          </Text>
          {check.missingColumns.length > 0 && (
            <Text testID="check-columns" style={[styles.body, align]}>
              {t('marks.export.check.columns', {
                parts: check.missingColumns.map((part) => partName(t, part)).join(t('marks.book.comma')),
              })}
            </Text>
          )}
          {check.extra.length > 0 && (
            <Text testID="check-extra" style={[styles.body, align]}>
              {t('marks.export.check.extra', { numbers: check.extra.join(t('marks.book.comma')) })}
            </Text>
          )}
          {check.twice.length > 0 && (
            <Text testID="check-twice" style={[styles.body, align]}>
              {t('marks.export.check.twice', { numbers: check.twice.join(t('marks.book.comma')) })}
            </Text>
          )}
          {differ > 0 && (
            <>
              <DiffRows check={check} nameOf={nameOf} />
              <Button testID="check-book" label={t('marks.export.check.book')} onPress={onBook} />
              <Button testID="check-refill" variant="line" label={t('marks.export.check.refill')} onPress={onFile} />
              <Text style={[styles.note, align]}>{t('marks.export.check.where')}</Text>
            </>
          )}
          <CheckRows check={check} nameOf={nameOf} />
          <Text testID="check-never" style={[styles.note, align]}>
            {t('marks.export.check.never')}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  empty: { padding: spacing['space-16'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
