// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «حفظ كشف النقاط في ملف» (#242, Export-file, answers 466 and 467): once the
// term's export is ready, the mark sheet as a PDF or a CSV file, each with its
// note; on a middle-school PDF, «خانة التوقيع» as on the printed sheet;
// «حماية الملف بكلمة سر», on and recommended, with the password shown as typed,
// never kept or filled in by the phone; then «اختيار مكان الحفظ» through the
// file picker, or «مشاركة» through the share screen after Share-warn. A saved
// or shared file goes into the activity log as the sheet, its term, and PDF or
// CSV. One file at a time; what became of it is said once the picker closes.

import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { SegmentedControl } from '../components/SegmentedControl';
import { Switch } from '../components/Switch';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { markSheetPages } from '../documents/mark-sheet-pages';
import { useOutputRun } from '../documents/output-run';
import { CopyWarning, SignatureChoice, useSignatureInUse } from '../documents/SignatureChoice';
import { useDocumentData } from '../documents/useDocumentData';
import { courseLabel } from '../exams/course-label';
import { useOutputLog } from '../log/output-log';
import files from '../native/NativeMinhajnaFiles';
import pdf from '../native/NativeMinhajnaPdf';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { courseExport } from './export-rules';
import { passwordAllowed, sheetCsv, sheetFileName, type FileFormat } from './export-file-rules';
import { termWord } from './marks-rules';
import { ShareWarn } from './ShareWarn';

export type ExportFileProps = {
  readonly courseId: string;
  readonly term: number;
  /** Opens the signature's settings. */
  readonly onSignature: () => void;
};

export function ExportFile({ courseId, term, onSignature }: ExportFileProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const documents = useDocumentData();
  const { busy, said, run, clear } = useOutputRun();
  const logged = useOutputLog();
  const inUse = useSignatureInUse();
  const [format, setFormat] = useState<FileFormat>('pdf');
  const [drawn, setDrawn] = useState(true);
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [warning, setWarning] = useState(false);
  const opener = useRef<ViewInstance | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sheet = useMemo(() => courseExport(context, profile, courseId, term), [context, profile, courseId, term]);
  if (sheet === null || !sheet.ready) {
    return <Text style={[styles.body, styles.empty, align]}>{t('marks.export.file.unavailable')}</Text>;
  }
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  const signable = format === 'pdf' && room?.level === 'cem';
  const label = courseLabel(t, state, profile, courseId, true);
  const fileName = sheetFileName(t, label, term, documents, format);
  const secret = locked ? password : '';
  const wrong = locked && !passwordAllowed(password);
  const make = async () => {
    if (format === 'csv') return files.makeText(sheetCsv(t, documents, courseId, term, sheet), fileName, secret);
    const html = markSheetPages({ ...documents, drawn }, t, courseId, term, sheet);
    const made = await pdf.makePdf(html, 'document-mark-sheet', false);
    return files.adoptPdf(made.name, fileName, secret);
  };
  const filed = () => logged('mark-sheet', `term-${term}`).filed(format);
  const ready = () => {
    setTried(true);
    return !wrong;
  };
  const save = () => {
    if (!ready()) return;
    run(async () => {
      if (!(await files.saveFile(await make()))) return null;
      filed();
      return 'saved';
    });
  };
  const share = () => {
    setWarning(false);
    run(async () => {
      await files.shareFile(await make(), t('marks.export.share.title'));
      filed();
      return null;
    });
  };
  const change =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      clear();
    };
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
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
      <Text testID="file-line" style={[styles.note, align]}>
        {t('marks.export.file.line', { class: label, term: termWord(t, term), count: sheet.rows.length })}
      </Text>
      <SegmentedControl
        testID="file-format"
        label={t('marks.export.file.format')}
        choices={[
          { value: 'pdf', label: 'PDF' },
          { value: 'csv', label: 'CSV' },
        ]}
        selected={format}
        disabled={busy}
        onSelect={change(setFormat)}
      />
      <Text testID="file-format-note" style={[styles.note, align]}>
        {t(format === 'pdf' ? 'marks.export.file.pdfNote' : 'marks.export.file.csvNote')}
      </Text>
      {signable && (
        <SignatureChoice
          testID="file-signature"
          label={t('documents.output.signatureChoice')}
          drawn={drawn}
          disabled={busy}
          onDrawn={change(setDrawn)}
          onSettings={onSignature}
        />
      )}
      <Switch
        testID="file-protect"
        label={t('marks.export.file.protect')}
        description={t('marks.export.file.protectNote')}
        value={locked}
        disabled={busy}
        onValueChange={change(setLocked)}
      />
      {locked && (
        <TextField
          testID="file-password"
          label={t('marks.export.file.password')}
          placeholder={t('marks.export.file.passwordExample')}
          value={password}
          onChangeText={change(setPassword)}
          error={tried && wrong ? t('marks.export.file.passwordRule') : undefined}
          maxLength={64}
          textDirection="ltr"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          importantForAutofill="no"
          editable={!busy}
        />
      )}
      <Text style={[styles.note, align]}>
        {t(
          !locked
            ? 'marks.export.file.open'
            : format === 'csv'
              ? 'marks.export.file.passwordCsv'
              : 'marks.export.file.passwordPdf',
        )}
      </Text>
      <View style={styles.actions}>
        <Button testID="file-save" label={t('marks.export.file.save')} disabled={busy} onPress={save} />
        <Button
          ref={opener}
          testID="file-share"
          variant="line"
          label={t('marks.export.share.action')}
          disabled={busy}
          onPress={() => ready() && setWarning(true)}
        />
        <CopyWarning testID="file-copy" shown={signable && inUse && drawn} />
      </View>
      <Text style={[styles.note, align]}>{t('marks.export.file.picker')}</Text>
      {said !== null && (
        <Notice
          testID="file-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
      <ShareWarn
        visible={warning}
        fileName={locked ? `${fileName}.zip` : fileName}
        locked={locked}
        returnFocusRef={opener}
        onClose={() => setWarning(false)}
        onShare={share}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  actions: { gap: spacing['space-10'] },
  empty: { padding: spacing['space-16'] },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
