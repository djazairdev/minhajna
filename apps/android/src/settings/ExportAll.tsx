// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصدير كل البيانات» in Settings (#248, Export-all, R-3.10-19, R-5.9-01,
// R-5.9-03, R-5.9-15, answer 472): free, at any time. The Minhajna archive,
// everything with its history and the pinned plan releases, or three CSV
// files for spreadsheets. The archive leaves the teacher card's personal
// fields and the drawn signature on the phone, and private notes unless the
// teacher includes them here. Every school year so far goes in: choosing one
// comes with the yearly archive. The file is protected by a password by
// default, never kept, and leaves only through the file picker, with the
// advice to keep it on a computer, an SD card or a USB key. The size shown
// is the files' before compression. Each export goes into the activity log,
// with its kind, never its content.

import { utf8Length } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { Switch } from '../components/Switch';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import type { Translate } from '../documents/document-data';
import { useOutputRun } from '../documents/output-run';
import { useDocumentData } from '../documents/useDocumentData';
import { useOutputLog } from '../log/output-log';
import { passwordAllowed, safeFileName } from '../marks/export-file-rules';
import build from '../native/NativeMinhajnaBuild';
import files from '../native/NativeMinhajnaFiles';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { exportFiles, type ExportFile, type ExportFormat } from './export-all-files';
import { settingsStyles as styles } from './styles';

/** The files' size before compression, in kilobytes or megabytes, as the screen says it. */
export function sizeLine(t: Translate, made: readonly ExportFile[]): string {
  const bytes = made.reduce((sum, file) => sum + (utf8Length(file.text) ?? file.text.length * 3), 0);
  return bytes < 1024 * 1024
    ? t('settings.exportAll.sizeKb', { size: Math.max(1, Math.ceil(bytes / 1024)) })
    : t('settings.exportAll.sizeMb', { size: (bytes / (1024 * 1024)).toFixed(1) });
}

export function ExportAll() {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const documents = useDocumentData();
  const { entries, settled } = useAppData();
  const { busy, said, run, clear } = useOutputRun();
  const logged = useOutputLog()('export-all', documents.day);
  const [format, setFormat] = useState<ExportFormat>('archive');
  const [notes, setNotes] = useState(false);
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const years = [...new Set([...documents.state.courses.values()].map((course) => course.year))].sort();
  const made = (app: string) => exportFiles(t, documents, { format, entries: entries(), app, privateNotes: notes });
  const size = useMemo(
    () => sizeLine(t, exportFiles(t, documents, { format, entries: entries(), app: '', privateNotes: notes })),
    [documents, entries, format, notes, t],
  );
  const wrong = locked && !passwordAllowed(password);
  const name = t(format === 'archive' ? 'settings.exportAll.archiveName' : 'settings.exportAll.csvName');
  const changed =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      clear();
    };
  const save = () => {
    setTried(true);
    if (wrong) return;
    run(async () => {
      await settled();
      const { version } = await build.describe();
      const kept = made(version);
      const zip = safeFileName(`${name} ${documents.day}`, 'zip').replace(/\.zip$/, '');
      const token = await files.makeZip(
        kept.map((file) => file.name),
        kept.map((file) => file.text),
        zip,
        locked ? password : '',
      );
      if (!(await files.saveFile(token))) return null;
      logged.filed(format);
      return 'saved';
    });
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text style={[styles.sub, align]}>{t('settings.exportAll.free')}</Text>
      <View style={styles.card}>
        <RadioCardGroup
          testID="export-format"
          label={t('settings.exportAll.format')}
          selected={format}
          onSelect={changed(setFormat)}
          disabled={busy}
          choices={[
            {
              value: 'archive',
              label: t('settings.exportAll.archive'),
              description: t('settings.exportAll.archiveLine'),
            },
            { value: 'csv', label: t('settings.exportAll.csv.title'), description: t('settings.exportAll.csvLine') },
          ]}
        />
        <Text style={[styles.sub, align]}>{t('settings.exportAll.leftOut')}</Text>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.exportAll.year')}
        </Text>
        <Text testID="export-years" style={[styles.body, align]}>
          {t('settings.exportAll.years', { years: years.join(' · ') || documents.year.id })}
        </Text>
      </View>
      <View style={styles.card}>
        {format === 'archive' && (
          <Switch
            testID="export-notes"
            label={t('settings.exportAll.notes')}
            description={t('settings.exportAll.notesLine')}
            value={notes}
            disabled={busy}
            onValueChange={changed(setNotes)}
          />
        )}
        <Switch
          testID="export-protect"
          label={t('settings.exportAll.protect')}
          description={t('settings.exportAll.protectLine')}
          value={locked}
          disabled={busy}
          onValueChange={changed(setLocked)}
        />
        {locked && (
          <TextField
            testID="export-password"
            label={t('settings.exportAll.password')}
            placeholder={t('marks.export.file.passwordExample')}
            value={password}
            onChangeText={changed(setPassword)}
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
        {locked && <Text style={[styles.sub, align]}>{t('settings.exportAll.passwordLine')}</Text>}
      </View>
      <Notice testID="export-confidential" icon={controlIcon('info')} message={t('settings.exportAll.confidential')} />
      <Text testID="export-size" style={[styles.sub, align]}>
        {size}
      </Text>
      <Button testID="export-save" label={t('settings.exportAll.save')} disabled={busy} onPress={save} />
      <Text style={[styles.sub, align]}>{t('settings.exportAll.saveNote')}</Text>
      {said !== null && (
        <Notice
          testID="export-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
    </ScrollView>
  );
}
