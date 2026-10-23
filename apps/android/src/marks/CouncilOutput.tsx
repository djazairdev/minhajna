// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing and saving «ملف مجلس القسم» (#244, Council, R-3.8-01, R-3.8-02,
// R-5.9-15, answer 470): «طباعة الملف», then «حماية الملف بكلمة سر», on and
// recommended, with the password shown as typed, never kept or filled in by
// the phone, and «حفظ PDF» through the file picker, the PDF inside an
// encrypted archive when protected, as on the export's file screen. The file
// is named by the class, subject, term and year, never a pupil; each print and
// save goes into the activity log with the term. What became of it is said
// once.

import type { CouncilPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Switch } from '../components/Switch';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { spacing, typography, colors } from '../design/tokens';
import { councilPages } from '../documents/council-pages';
import { yearLabel } from '../documents/document-data';
import { useOutputRun } from '../documents/output-run';
import { useDocumentData } from '../documents/useDocumentData';
import { useOutputLog } from '../log/output-log';
import files from '../native/NativeMinhajnaFiles';
import pdf from '../native/NativeMinhajnaPdf';
import { useText } from '../text/i18n';
import { passwordAllowed, safeFileName } from './export-file-rules';
import { termWord } from './marks-rules';

export type CouncilOutputProps = {
  readonly pack: CouncilPack;
  readonly courseId: string;
  readonly term: number;
  /** The class and subject, as the file's name gives them. */
  readonly label: string;
};

export function CouncilOutput({ pack, courseId, term, label }: CouncilOutputProps) {
  const t = useText();
  const { direction } = useLocale();
  const documents = useDocumentData();
  const { busy, said, print, run, clear } = useOutputRun();
  const logged = useOutputLog()('council', `term-${term}`);
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const title = t('marks.council.title');
  const html = () => councilPages(documents, t, pack, courseId, term);
  const fileName = safeFileName(`${title} ${label} ${termWord(t, term)} ${yearLabel(documents)}`, 'pdf');
  const wrong = locked && !passwordAllowed(password);
  const save = () => {
    setTried(true);
    if (wrong) return;
    run(async () => {
      const made = await pdf.makePdf(html(), 'document-council', false);
      const file = await files.adoptPdf(made.name, fileName, locked ? password : '');
      if (!(await files.saveFile(file))) return null;
      logged.saved();
      return 'saved';
    });
  };
  return (
    <View style={styles.group}>
      <Button
        testID="council-print"
        label={t('marks.council.print')}
        disabled={busy}
        onPress={() => print(html, title, false, logged.printed)}
      />
      <Switch
        testID="council-protect"
        label={t('marks.export.file.protect')}
        description={t('marks.export.file.protectNote')}
        value={locked}
        disabled={busy}
        onValueChange={(value) => {
          setLocked(value);
          clear();
        }}
      />
      {locked && (
        <TextField
          testID="council-password"
          label={t('marks.export.file.password')}
          placeholder={t('marks.export.file.passwordExample')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clear();
          }}
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
      <Text style={[styles.note, align]}>{t(locked ? 'marks.export.file.passwordPdf' : 'marks.export.file.open')}</Text>
      <Button testID="council-save" variant="line" label={t('documents.output.save')} disabled={busy} onPress={save} />
      <Text style={[styles.note, align]}>{t('marks.council.saveNote')}</Text>
      {said !== null && (
        <Notice
          testID="council-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-10'] },
  note: { ...typography.caption, color: colors.ink2 },
});
