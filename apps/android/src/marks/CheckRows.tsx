// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rows of «مقارنة قبل التوقيع» (#242, Marks-check and Marks-check-diff,
// answer 467): each differing row with every value that differs, «الفرض: 14,25
// في السجل، و12,25 في الملف», or not in the file; then the control sheet, each
// pupil with each value in the register and in the file, said as matching or
// differing in words, never by colour alone, and read by TalkBack as one line.
// The register's numbers take the decimal mark of the file's value, a comma as
// the CSV file writes them when it has none, so a match never looks unlike.

import type { CheckCell, CheckRow, ExportCheck } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { partName } from './export-rules';

type Translate = ReturnType<typeof useText>;

/** A cell's column: the name, a part or the average. */
function cellName(t: Translate, part: CheckCell['part']): string {
  if (part === 'name') return t('marks.export.check.name');
  return part === 'average' ? t('marks.book.average') : partName(t, part);
}

/** A value as read from the file: a name isolated, a dash for nothing. */
function fileText(part: CheckCell['part'], value: string): string {
  if (value === '') return '—';
  return part === 'name' ? isolate(value) : value;
}

/** The register's value, a number with the file's decimal mark, or a comma when the file's value has none. */
function registerText(cell: CheckCell): string {
  if (cell.part === 'name' || !/^\d+\.\d+$/.test(cell.register)) return fileText(cell.part, cell.register);
  return /\d\.\d/.test(cell.file ?? '') ? cell.register : cell.register.replace('.', ',');
}

/** A differing cell: both values, or the register's alone when the file has none. */
function diffLine(t: Translate, cell: CheckCell): string {
  const words = { part: cellName(t, cell.part), register: registerText(cell) };
  return cell.file === null
    ? t('marks.export.check.notInFile', words)
    : t('marks.export.check.cellDiff', { ...words, file: fileText(cell.part, cell.file) });
}

/** The row's number and pupil. */
const rowName = (row: CheckRow, nameOf: (pupilId: string) => string) =>
  `${row.number} · ${isolate(nameOf(row.pupilId))}`;

export type DiffRowsProps = {
  readonly check: ExportCheck;
  readonly nameOf: (pupilId: string) => string;
};

export function DiffRows({ check, nameOf }: DiffRowsProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View style={styles.rows}>
      {check.rows
        .filter((row) => !row.same)
        .map((row) => (
          <View key={row.pupilId} testID={`check-diff-${row.pupilId}`} accessible style={styles.card}>
            <Text style={[styles.title, align]}>{rowName(row, nameOf)}</Text>
            {row.cells
              .filter((cell) => !cell.same)
              .map((cell) => (
                <Text key={cell.part} style={[styles.body, align]}>
                  {diffLine(t, cell)}
                </Text>
              ))}
          </View>
        ))}
    </View>
  );
}

export function CheckRows({ check, nameOf }: DiffRowsProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="check-sheet" style={styles.rows}>
      <Text style={[styles.title, align]}>{t('marks.export.check.sheet')}</Text>
      <Text style={[styles.note, align]}>{t('marks.export.check.legend')}</Text>
      {check.rows.map((row) => {
        const cells = row.cells.filter((cell) => cell.part !== 'name');
        const status = t(row.same ? 'marks.export.check.same' : 'marks.export.check.differs');
        const spoken = [
          rowName(row, nameOf),
          ...cells.map((cell) =>
            t('marks.export.check.cellSpoken', {
              part: cellName(t, cell.part),
              register: registerText(cell),
              file: cell.file === null ? t('marks.export.check.none') : fileText(cell.part, cell.file),
            }),
          ),
          status,
        ].join(t('marks.book.comma'));
        return (
          <View
            key={row.pupilId}
            testID={`check-row-${row.pupilId}`}
            accessible
            accessibilityLabel={spoken}
            style={styles.pupil}
          >
            <View style={styles.head}>
              <Text style={[styles.body, styles.grow, align]}>{rowName(row, nameOf)}</Text>
              <Text style={[row.same ? styles.note : styles.strong, align]}>{status}</Text>
            </View>
            <View style={styles.values}>
              {cells.map((cell) => (
                <View key={cell.part} style={styles.value}>
                  <Text style={[styles.note, align]}>{cellName(t, cell.part)}</Text>
                  <Text style={[styles.body, align]}>{registerText(cell)}</Text>
                  <Text style={[cell.same ? styles.note : styles.strong, align]}>
                    {cell.file === null ? '—' : fileText(cell.part, cell.file)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing['space-8'] },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-12'],
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  pupil: {
    gap: spacing['space-4'],
    paddingVertical: spacing['space-8'],
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  head: { flexDirection: 'row', gap: spacing['space-8'], alignItems: 'baseline' },
  grow: { flex: 1 },
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-16'] },
  value: { minWidth: 72 },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  strong: { ...typography.label, color: colors.danger },
  note: { ...typography.caption, color: colors.ink2 },
});
