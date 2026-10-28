// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The term's corrections on «تصحيح بعد الفصل» (#243, Export-fix, answer 468),
// latest first: the pupil by number and name, the mark before and after, the
// reason and the day, each read as one line, with «طباعة التقرير» and «حفظ
// PDF» for its «تقرير تصحيح نقطة», logged with the term. A middle-school class
// offers «خانة التوقيع» while the drawn signature is in use, as on the grade
// book. A saved report is named by the pupil's number, never their name.

import { targetKey, type MarkFix, type MarkTarget, type Version } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { fixReportPages } from '../documents/fix-report-pages';
import { useOutputRun } from '../documents/output-run';
import { CopyWarning, SignatureChoice, useSignatureInUse } from '../documents/SignatureChoice';
import { useDocumentData } from '../documents/useDocumentData';
import { logDay } from '../log/log-text';
import { useOutputLog } from '../log/output-log';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { fixLine, type FixTarget } from './fix-rules';
import { termWord } from './marks-rules';
import { PrintSave } from '../documents/PrintSave';

export type FixListProps = {
  readonly fixes: readonly Version<MarkFix>[];
  readonly term: number;
  /** The class and subject, as the file's name gives them. */
  readonly label: string;
  readonly signable: boolean;
  readonly targets: readonly FixTarget[];
  /** A corrected mark's name, or its part's when the term no longer has it. */
  readonly nameOf: (one: MarkTarget) => string;
  readonly numberOf: (pupilId: string) => number | undefined;
  readonly pupilName: (pupilId: string) => string;
  /** Opens the signature's settings. */
  readonly onSignature: () => void;
};

export function FixList(props: FixListProps) {
  const { fixes, term, label, signable, targets, nameOf, numberOf, pupilName, onSignature } = props;
  const t = useText();
  const { direction } = useLocale();
  const documents = useDocumentData();
  const { busy, said, print, save, clear } = useOutputRun();
  const logged = useOutputLog()('mark-fix', `term-${term}`);
  const inUse = useSignatureInUse();
  const [drawn, setDrawn] = useState(true);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (fixes.length === 0) return null;
  const title = t('documents.markFix.name');
  return (
    <View testID="fix-list" style={styles.group}>
      <Text style={[styles.title, align]}>{t('marks.fix.listTitle', { term: termWord(t, term) })}</Text>
      {signable && (
        <SignatureChoice
          testID="fix-signature"
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
      {[...fixes].reverse().map((fix) => {
        const target = targets.find((one) => one.key === targetKey(fix.value.mark.target));
        const name = nameOf(fix.value.mark.target);
        const number = numberOf(fix.value.mark.pupilId);
        const who = `${number ?? '—'} · ${isolate(pupilName(fix.value.mark.pupilId))}`;
        const lines = [
          fixLine(t, name, fix.value),
          `${t(`marks.fix.reasons.${fix.value.reason}`)} · ${logDay(fix.day)}`,
        ];
        const html = () => fixReportPages({ ...documents, drawn }, t, fix, name, target?.day ?? null);
        const pupil = t('marks.fix.filePupil', { number: number ?? '—' });
        const file = `${title} ${label} ${termWord(t, term)} ${pupil} ${fix.day}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
        return (
          <View key={fix.entry} style={styles.card}>
            <View testID={`fix-item-${fix.entry}`} accessible style={styles.lines}>
              <Text style={[styles.title, align]}>{who}</Text>
              {lines.map((line) => (
                <Text key={line} style={[styles.note, align]}>
                  {line}
                </Text>
              ))}
            </View>
            <View style={styles.actions}>
              <PrintSave
                print={{
                  testID: `fix-print-${fix.entry}`,
                  variant: 'line',
                  label: t('marks.fix.print'),
                  disabled: busy,
                  onPress: () => print(html, title, false, logged.printed, file),
                }}
                save={{
                  testID: `fix-save-${fix.entry}`,
                  variant: 'line',
                  label: t('documents.output.save'),
                  disabled: busy,
                  onPress: () => save(html, 'document-mark-fix', file, false, logged.saved),
                }}
              />
            </View>
          </View>
        );
      })}
      <CopyWarning testID="fix-copy" shown={signable && inUse && drawn} />
      {said !== null && (
        <Notice
          testID="fix-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-10'] },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  lines: { gap: spacing['space-2'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
