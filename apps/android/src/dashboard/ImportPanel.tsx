// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The side panel of a file import, as D-Classes draws it: choosing the file;
// then, before anything changes, the figures of what the file brings and the
// refused lines, each with its number and why; then applying what can be, or
// cancelling; and once applied, how many changes were made. A file the page
// cannot read says so: an Excel workbook is to be saved as CSV UTF-8 first.

import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import files from '../native/NativeMinhajnaFiles';
import { useDeviceText } from '../text/device-text';
import { Figure, Figures } from './page-parts';
import { Table } from './Table';

export type ImportFigure = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly warn?: boolean;
};

export type ImportCheckShown = {
  readonly figures: readonly ImportFigure[];
  readonly refused: readonly { readonly line: number; readonly where?: string; readonly why: string }[];
  /** How many changes applying makes. */
  readonly changes: number;
};

export type ImportPanelProps = {
  readonly title: string;
  /** Reads the file's text into a check, or the sentence that refuses the whole file. */
  readonly check: (text: string) => ImportCheckShown | string;
  readonly onApply: () => void;
  readonly onClose: () => void;
  /** The column of where each refused line belongs, when the import names one. */
  readonly whereLabel?: string;
};

const refusalOf = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'E_FILE_BINARY' ? 'binary' : code === 'E_FILE_SIZE' ? 'size' : 'failed';
};

/** Choosing a file, its check, and applying it. */
export function ImportPanel({ title, check, onApply, onClose, whereLabel }: ImportPanelProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [shown, setShown] = useState<ImportCheckShown | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const picking = useRef(false);
  const pick = () => {
    if (picking.current) return;
    picking.current = true;
    files.openText().then(
      (text) => {
        picking.current = false;
        if (text === null) return;
        const read = check(text);
        setShown(typeof read === 'string' ? null : read);
        setProblem(typeof read === 'string' ? read : null);
      },
      (error: unknown) => {
        picking.current = false;
        setShown(null);
        setProblem(t(`dashboard.import.file.${refusalOf(error)}`));
      },
    );
  };
  return (
    <View testID="import-panel" style={styles.panel}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {title}
      </Text>
      {problem !== null && (
        <Text testID="import-problem" accessibilityRole="alert" style={[styles.warn, align]}>
          {problem}
        </Text>
      )}
      {applied !== null ? (
        <>
          <Text testID="import-applied" accessibilityRole="alert" style={[styles.ok, align]}>
            {t('dashboard.import.applied', { count: applied })}
          </Text>
          <Button
            testID="import-close"
            variant="line"
            icon={controlIcon('cross')}
            label={t('dashboard.back')}
            onPress={onClose}
          />
        </>
      ) : shown === null ? (
        <>
          <Button
            testID="import-pick"
            variant="line"
            icon={controlIcon('tune')}
            label={t('dashboard.import.pick')}
            onPress={pick}
          />
          <Button
            testID="import-cancel"
            variant="line"
            icon={controlIcon('cross')}
            label={t('dashboard.cancel')}
            onPress={onClose}
          />
        </>
      ) : (
        <>
          <Figures>
            {shown.figures.map((one) => (
              <Figure
                key={one.id}
                testID={`import-figure-${one.id}`}
                value={one.value}
                label={one.label}
                warn={one.warn}
              />
            ))}
          </Figures>
          {shown.refused.length > 0 && (
            <Table
              testID="import-refused"
              label={t('dashboard.import.refusedLines')}
              columns={[
                { id: 'line', label: t('dashboard.import.line'), width: 90 },
                ...(whereLabel === undefined ? [] : [{ id: 'where', label: whereLabel, width: 80 }]),
                { id: 'why', label: t('dashboard.import.why'), grow: 1 },
              ]}
              rows={shown.refused.slice(0, 50).map((one) => ({
                key: String(one.line),
                cells: [
                  t('dashboard.import.lineNumber', { line: one.line }),
                  ...(whereLabel === undefined ? [] : [one.where ?? '—']),
                  one.why,
                ],
              }))}
            />
          )}
          <Button
            testID="import-apply"
            icon={controlIcon('check')}
            label={t('dashboard.import.apply', { count: shown.changes })}
            disabled={shown.changes === 0}
            onPress={() => {
              onApply();
              setApplied(shown.changes);
            }}
          />
          <Button
            testID="import-cancel"
            variant="line"
            icon={controlIcon('cross')}
            label={t('dashboard.cancel')}
            onPress={onClose}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing['space-12'] },
  title: { ...typography.h3, color: colors.ink },
  warn: { ...typography.label, color: colors['notice-ink'] },
  ok: {
    ...typography.label,
    color: colors['ok-ink'],
    backgroundColor: colors.ok,
    padding: spacing['space-10'],
    borderRadius: radius['radius-control'],
  },
});
