// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bringing in the school's timetable from a file (#576, D-TT-import, §7.4,
// R-7.4-08 to R-7.4-10, answer 592), on the timetable page of the director's
// and the preparer's workspaces: the source, FET's CSV export or the school's
// template saved from Excel as CSV UTF-8, then a file chosen through the
// device's table picker and read by that source's reader in every language the
// app speaks (timetable-words.ts). What was read is counted and said aloud, on
// a PC in the page's hidden live region, and the checks follow: no clash, or
// each row left out with its problem in plain words; the columns not read; the
// sessions shared by several classes, and FET's guessed groups, for the
// preparer to confirm; whether weeks A and B balance for each group of pupils
// and each teacher (grid-text.ts, answer 593), counted on the sessions
// imported; and that checking each class's hours against the official grid, and
// each subject's free half-day, wait for that data. Each class's week follows
// as a grid (TimetableGrid.tsx). A file with no session says so. A header that
// cannot be read refuses the whole file, said apart, with a hint to try the
// other source when the header has no time column the source expects. A file
// that cannot be read says so, with how to save it from Excel, and keeps what
// was shown; another source clears it, and the source is fixed while a file is
// being chosen. The timetable read is kept in memory for the world it was read
// in, so it outlives a change of page, until it is sent (#577) or the world is
// left; nothing is uploaded or signed. Minhajna imports the timetable and never
// builds it.

import {
  alternates,
  parseCsv,
  readFetTimetable,
  readTimetable,
  type BellData,
  type FetImport,
  type FetProblem,
  type TimetableImport as TemplateImport,
  type Weekday,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radius, spacing, typography } from '../design/tokens';
import NativeInput from '../native/NativeMinhajnaCalendarInput';
import { onPc, useDeviceText } from '../text/device-text';
import { weekCheck } from './grid-text';
import { problemText, readCounts } from './import-text';
import { TimetableGrid } from './TimetableGrid';
import { afternoonStart, fetWords, levelBells, timetableWords } from './timetable-words';

/** A timetable read from a file, with the source it was read as. */
export type TimetableRead = {
  readonly source: 'fet' | 'template';
  readonly result: FetImport | TemplateImport;
};

/** The problems of a header that keep a whole file from being read. */
const REFUSED: readonly FetProblem['kind'][] = ['columns', 'column-twice', 'fet-columns'];
const refusedBy = (problem: FetProblem) => REFUSED.includes(problem.kind);
/** Whether a refused header lacks the time columns its source expects, as when the file comes from the other one. */
const otherSource = (problem: FetProblem) =>
  problem.kind === 'fet-columns'
    ? problem.missing.includes('hour')
    : problem.kind === 'columns' && problem.missing.includes('start') && problem.missing.includes('end');

export type TimetableImportProps = {
  /** The school's level, whose bell times give FET's numbered hours their times. */
  readonly level: string;
  readonly bells: BellData;
  readonly workingDays: readonly Weekday[];
  /** The timetable read so far in this world, or null. */
  readonly read: TimetableRead | null;
  readonly onRead: (read: TimetableRead | null) => void;
};

/** The timetable page: a file brought in and checked. */
export function TimetableImport({ level, bells, workingDays, read, onRead }: TimetableImportProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [source, setSource] = useState(read?.source ?? 'fet');
  const [unreadable, setUnreadable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState({ words: '', count: 0 });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const choose = (next: 'fet' | 'template') => {
    setSource(next);
    setUnreadable(false);
    if (read !== null && read.source !== next) onRead(null);
  };
  const open = async () => {
    setBusy(true);
    setUnreadable(false);
    try {
      const text = await NativeInput.readTable();
      if (!mounted.current || text === null) return;
      const rows = parseCsv(text);
      const result =
        source === 'fet'
          ? readFetTimetable(rows, fetWords(), levelBells(bells, level))
          : readTimetable(rows, timetableWords());
      onRead({ source, result });
      const leftRows = new Set(result.problems.filter((one) => one.kind !== 'column-unknown').map((one) => one.row));
      const words = result.problems.some(refusedBy)
        ? t('ttImport.notImported')
        : t('ttImport.done', {
            sessions: t('count.sessions', { count: result.sessions.length }),
            left: leftRows.size,
          });
      if (onPc()) setSaid((before) => ({ words, count: before.count + 1 }));
      else AccessibilityInfo.announceForAccessibility(words);
    } catch {
      if (mounted.current) setUnreadable(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const result = read?.result;
  const counts = result === undefined ? null : readCounts(result.sessions);
  const notRead = result?.problems.filter((one) => one.kind === 'column-unknown') ?? [];
  const refused = result?.problems.filter(refusedBy) ?? [];
  const left = result?.problems.filter((one) => one.kind !== 'column-unknown' && !refusedBy(one)) ?? [];
  const groups = result !== undefined && 'groups' in result ? result.groups : [];
  const weeks = result === undefined || result.sessions.length === 0 ? null : weekCheck(t, result.sessions);
  const lines = (testID: string, items: readonly string[]) =>
    items.map((line, index) => (
      <Text key={`${testID}-${index}`} testID={testID} style={[styles.small, align]}>
        {line}
      </Text>
    ));
  return (
    <View testID="timetable-import" style={styles.page}>
      {onPc() && (
        <View accessibilityLiveRegion="polite" style={styles.hidden}>
          <Text key={said.count} testID="tt-said">
            {said.words}
          </Text>
        </View>
      )}
      <Text style={[styles.small, align]}>{t('ttImport.lead')}</Text>
      <View style={styles.card}>
        <SegmentedControl
          testID="tt-source"
          label={t('ttImport.source')}
          choices={[
            { value: 'fet', label: t('ttImport.fet') },
            { value: 'template', label: t('ttImport.template') },
          ]}
          selected={source}
          onSelect={choose}
          disabled={busy}
        />
        <Text style={[styles.small, align]}>{t(source === 'fet' ? 'ttImport.fetLine' : 'ttImport.templateLine')}</Text>
        <Button testID="tt-open" label={t('ttImport.open')} disabled={busy} onPress={() => void open()} />
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
          {unreadable ? t('ttImport.unreadable') : ''}
        </Text>
      </View>
      {result !== undefined && refused.length > 0 && (
        <View testID="tt-refused" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('ttImport.refused')}
          </Text>
          {lines(
            'tt-problem',
            refused.map((one) => problemText(t, one)),
          )}
          {refused.some(otherSource) && <Text style={[styles.small, align]}>{t('ttImport.otherSource')}</Text>}
        </View>
      )}
      {result !== undefined && counts !== null && refused.length === 0 && (
        <View testID="tt-read" style={styles.card}>
          <Text style={[styles.body, align]}>
            {t('ttImport.read', { ...counts, sessions: t('count.sessions', { count: counts.sessions }) })}
          </Text>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('ttImport.checks')}
          </Text>
          {result.sessions.length === 0 && <Text style={[styles.small, align]}>{t('ttImport.noSessions')}</Text>}
          {result.sessions.length > 0 && left.length === 0 && (
            <Text style={[styles.small, align]}>{t('ttImport.clean')}</Text>
          )}
          {left.length > 0 && <Text style={[styles.label, align]}>{t('ttImport.problems')}</Text>}
          {lines(
            'tt-problem',
            left.map((one) => problemText(t, one)),
          )}
          {notRead.length > 0 && <Text style={[styles.label, align]}>{t('ttImport.notRead')}</Text>}
          {lines(
            'tt-not-read',
            notRead.map((one) => problemText(t, one)),
          )}
          {weeks !== null && (
            <Text style={[weeks.uneven.length > 0 ? styles.label : styles.small, align]}>{weeks.line}</Text>
          )}
          {lines('tt-weeks', weeks?.uneven ?? [])}
          {left.length > 0 && alternates(result.sessions) && (
            <Text style={[styles.small, align]}>{t('ttImport.weeksKept')}</Text>
          )}
          <Text style={[styles.small, align]}>{t('ttImport.gridLater')}</Text>
          {result.together.length > 0 && <Text style={[styles.label, align]}>{t('ttImport.together')}</Text>}
          {lines(
            'tt-together',
            result.together.map((pair) => t('ttImport.togetherRow', { row: pair.row, with: pair.with })),
          )}
          {groups.length > 0 && <Text style={[styles.label, align]}>{t('ttImport.groups')}</Text>}
          {lines(
            'tt-group',
            groups.map((one) => t('ttImport.groupRow', { set: one.set, group: one.group, class: one.class })),
          )}
          {groups.length > 0 && <Text style={[styles.small, align]}>{t('ttImport.groupsLine')}</Text>}
        </View>
      )}
      {result !== undefined && refused.length === 0 && result.sessions.length > 0 && (
        <TimetableGrid sessions={result.sessions} workingDays={workingDays} afternoon={afternoonStart(bells, level)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
