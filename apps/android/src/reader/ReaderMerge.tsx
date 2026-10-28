// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «دمج البيانات» (#246, R-Merge, answers 489 and 492): for one grade of the
// school's picture and one of its subjects, each class's latest statement in
// the school's order, under its school when grouped: its teacher and day, its
// last resource placed on its unit as this app's pack has it, drawn as boxes,
// the delay and the sessions not held. A row opens its statement. Nothing is
// ranked or coloured for a person. It prints for the council's register, or
// saves as a PDF, once every unnamed teacher's label is known, and stays on
// this phone. Nothing is recorded.

import { receivedStatements, statementMerge, statementPicture, teacherNames } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, sizes, spacing } from '../design/tokens';
import { frontDate } from '../documents/front-tables';
import { useOutputRun } from '../documents/output-run';
import { safeFileName } from '../marks/export-file-rules';
import { settingsStyles as styles } from '../settings/styles';
import { gradeName } from '../setup/names';
import { subjectName } from '../sharing/statement-lines';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { mergeHtml } from './merge-page';
import { mergeWords, type MergeWords } from './merge-words';
import { teacherLabel } from './reader-words';
import { useFingerprints } from './useFingerprints';
import { PrintSave } from '../documents/PrintSave';

export function ReaderMerge({ grade, onOpen }: { readonly grade: string; readonly onOpen: (id: string) => void }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { entries, profile, packs, today } = useAppData();
  const [chosen, setChosen] = useState<string | null>(null);
  const output = useOutputRun();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const names = teacherNames(entries());
  const part = statementPicture(receivedStatements(entries()), names).grades.find((one) => one.grade === grade);
  const codes = profile.subjects.map((subject) => subject.code);
  const rank = (code: string) => (codes.includes(code) ? codes.indexOf(code) : codes.length);
  const subjects = [...(part?.subjects ?? [])].sort((a, b) => rank(a) - rank(b));
  const subject = subjects.find((code) => code === chosen) ?? subjects[0];
  const merge = part === undefined || subject === undefined ? null : statementMerge(part, subject, packs);
  const fingerprints = useFingerprints(merge?.rows.map((row) => row.one.spki) ?? []);
  if (part === undefined || subject === undefined || merge === null) {
    return (
      <View style={[styles.screen, { padding: spacing['space-16'] }]}>
        <Text testID="reader-merge-empty" style={[styles.body, align]}>
          {t('reader.picture.empty')}
        </Text>
      </View>
    );
  }
  const rows = merge.rows.map((row) =>
    mergeWords(t, profile, row, teacherLabel(t, names, row.one.spki, fingerprints.get(row.one.spki) ?? null)),
  );
  const waiting = merge.rows.some((row) => !names.has(row.one.spki) && !fingerprints.has(row.one.spki));
  const words = { subject: subjectName(profile, subject), grade: gradeName(profile, grade) };
  const sheet = {
    title: [t('reader.merge.title'), words.subject, words.grade].join(' · '),
    scope: t('reader.merge.scope', {
      statements: t('reader.count', { count: rows.length }),
      teachers: t('reader.teachers', { count: merge.teachers }),
    }),
    today: frontDate(today()),
    rows,
    grouped: part.groups.length > 1,
  };
  const html = () => mergeHtml(t, sheet, currentLanguage(), direction);
  const file = safeFileName(`${t('reader.merge.title')} ${words.subject} ${words.grade} ${today()}`, 'pdf');
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
      {subjects.length > 1 && (
        <ChipGroup
          testID="merge-subject"
          label={t('reader.merge.subject')}
          choices={subjects.map((code) => ({ value: code, label: subjectName(profile, code) }))}
          selected={subject}
          onSelect={setChosen}
        />
      )}
      <Text testID="merge-title" accessibilityRole="header" style={[styles.title, align]}>
        {sheet.title}
      </Text>
      <Text style={[styles.sub, align]}>{sheet.scope}</Text>
      {rows.map((row, index) => (
        <View key={row.id} style={{ gap: spacing['space-8'] }}>
          {sheet.grouped && row.school !== rows[index - 1]?.school && (
            <Text accessibilityRole="header" style={[styles.title, align]}>
              {row.school === null ? t('reader.picture.noSchool') : isolate(row.school)}
            </Text>
          )}
          <MergeRow row={row} onOpen={onOpen} />
        </View>
      ))}
      <Text style={[styles.sub, align]}>{t('reader.merge.order')}</Text>
      <Text style={[styles.sub, align]}>{t('reader.merge.shared')}</Text>
      <View style={{ gap: spacing['space-8'] }}>
        <PrintSave
          print={{
            testID: 'merge-print',
            label: t('reader.merge.print'),
            disabled: output.busy || waiting,
            onPress: () => output.print(html, sheet.title, true, undefined, file),
          }}
          save={{
            testID: 'merge-pdf',
            variant: 'line',
            label: t('documents.output.save'),
            disabled: output.busy || waiting,
            onPress: () => output.save(html, 'merge', file, true),
          }}
        />
      </View>
      {output.said !== null && (
        <Notice
          testID="merge-said"
          icon={controlIcon(output.said === 'saved' ? 'check' : 'info')}
          message={t(output.said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
      <Text style={[styles.sub, align]}>{t('reader.merge.register')}</Text>
    </ScrollView>
  );
}

/** One class as a card that opens its statement; its place as boxes, half filled for a resource started. */
function MergeRow({ row, onOpen }: { readonly row: MergeWords; readonly onOpen: (id: string) => void }) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const lines = [row.day, row.unit, row.resource, ...(row.place === null ? [] : [row.place]), row.delay, row.notHeld];
  const head = `${isolate(row.section)} · ${row.teacher}`;
  return (
    <Pressable
      testID={`merge-row-${row.id}`}
      accessibilityRole="button"
      accessibilityLabel={[head, ...lines].join('\n')}
      onPress={() => onOpen(row.id)}
      style={({ pressed }) => [
        styles.card,
        { gap: spacing['space-4'], minHeight: sizes.target, minWidth: sizes.target },
        pressed && { backgroundColor: colors.soft },
      ]}
    >
      <Text style={[styles.title, align]}>{head}</Text>
      {lines.map((line, index) => (
        <Text key={index} style={[index === 0 ? styles.sub : styles.body, align]}>
          {line}
        </Text>
      ))}
      {row.track !== null && (
        <View style={[track.row, { direction }]} importantForAccessibility="no-hide-descendants">
          {Array.from({ length: row.track.of }, (_, index) => {
            const at = row.track?.at ?? 0;
            const filled = index < at || (index === at && row.track?.done === true);
            return (
              <View key={index} style={[track.box, filled && track.done, index === at && track.now]}>
                {index === at && !filled && <View style={track.half} />}
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
}

const track = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing['space-4'], flexWrap: 'wrap' },
  box: { width: 16, height: 16, borderWidth: 1, borderColor: colors.ink2, borderRadius: 3, overflow: 'hidden' },
  done: { backgroundColor: colors.ink },
  now: { borderWidth: 3, borderColor: colors.ink },
  half: { position: 'absolute', top: 0, bottom: 0, start: 0, width: '50%', backgroundColor: colors.ink },
});
