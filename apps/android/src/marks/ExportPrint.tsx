// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «كشف النقاط المطبوع» on «التصدير الفصلي» (#242, Marks-sheet, answer 466):
// what it holds, then «طباعة» and «حفظ PDF» for the class, subject and term's
// page, each going into the activity log with the term; a middle-school page
// offers «خانة التوقيع» while the drawn signature is in use, with «إعدادات
// التوقيع», and the line on where it goes, as on the grade book.

import type { TermExport } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { markSheetPages } from '../documents/mark-sheet-pages';
import { CopyWarning, SignatureChoice, useSignatureInUse } from '../documents/SignatureChoice';
import { useOutputRun } from '../documents/output-run';
import { useDocumentData } from '../documents/useDocumentData';
import { courseLabel } from '../exams/course-label';
import { useOutputLog } from '../log/output-log';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { sheetFileName } from './export-file-rules';

export type ExportPrintProps = {
  readonly courseId: string;
  readonly term: number;
  readonly sheet: TermExport;
  /** Opens the signature's settings. */
  readonly onSignature: () => void;
};

export function ExportPrint({ courseId, term, sheet, onSignature }: ExportPrintProps) {
  const t = useText();
  const { direction } = useLocale();
  const { state, profile } = useAppData();
  const documents = useDocumentData();
  const { busy, said, print, save, clear } = useOutputRun();
  const [drawn, setDrawn] = useState(true);
  const inUse = useSignatureInUse();
  const logged = useOutputLog();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  const signable = room?.level === 'cem';
  const html = () => markSheetPages({ ...documents, drawn }, t, courseId, term, sheet);
  const title = t('documents.markSheet.name');
  const label = courseLabel(t, state, profile, courseId, true);
  const file = sheetFileName(t, label, term, documents, 'pdf');
  const log = logged('mark-sheet', `term-${term}`);
  return (
    <View testID="export-print" style={styles.group}>
      <Text style={[styles.title, align]}>{t('marks.export.printTitle')}</Text>
      <Text style={[styles.note, align]}>{t('marks.export.printNote')}</Text>
      {signable && (
        <SignatureChoice
          testID="export-signature"
          label={t('documents.output.signatureChoice')}
          drawn={drawn}
          disabled={busy}
          onDrawn={(next) => {
            setDrawn(next);
            clear();
          }}
          onSettings={onSignature}
        />
      )}
      <Notice
        testID="export-signature-line"
        icon={controlIcon('info')}
        message={t(signable && inUse && drawn ? 'marks.export.drawnLine' : 'marks.export.signatureLine')}
      />
      <View style={styles.actions}>
        <Button
          testID="export-print-button"
          label={t('documents.output.print')}
          disabled={busy}
          onPress={() => print(html, title, false, log.printed)}
        />
        <Button
          testID="export-save"
          variant="line"
          label={t('documents.output.save')}
          disabled={busy}
          onPress={() => save(html, 'document-mark-sheet', file, false, log.saved)}
        />
        <CopyWarning testID="export-copy" shown={signable && inUse && drawn} />
      </View>
      {said !== null && (
        <Notice
          testID="export-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  actions: { gap: spacing['space-10'] },
  title: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
