// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The timetable page's printing card (#581, D-TT-import step 3, answer 609),
// under the checks for the director and the preparer: what it prints, with the
// boxes for the director and, beside them, the censeur in a lycée, the
// education counsellor in a CEM or the inspector in a primary school; the set
// of grids, classes, teachers or rooms, each with its count, the classes first;
// and two buttons, printing through the device's print service and saving as a
// PDF named for the set, the school and the world's day, on the phone as on the
// PC. A timetable that names no room says so, and the buttons wait. Every page
// says it comes from a demo world with made-up data and is not an official
// document (grids-print.ts). Preparing, a PDF saved with its name, and a
// failure are said in a live line, which goes through preparing each time so
// that saving again is said again; a print cancelled says nothing, one run at a
// time, and nothing is shown once the card is gone.

import {
  timetableNames,
  type Day,
  type DemoSchool,
  type GridOf,
  type ImportedSession,
  type Weekday,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radius, spacing, typography } from '../design/tokens';
import { personName } from '../director/dashboard-text';
import pdf from '../native/NativeMinhajnaPdf';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { gridsHtml, yearOf } from './grids-print';

export type TimetablePrintProps = {
  readonly school: DemoSchool;
  /** The school's wilaya, as the reference data names it. */
  readonly wilaya: string;
  readonly sessions: readonly ImportedSession[];
  readonly workingDays: readonly Weekday[];
  /** The world's day. */
  readonly date: Day;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
};

type Said = 'printing' | 'saved' | 'failed' | null;

/** The timetable page's printing card: the set of grids, printed or saved as a PDF. */
export function TimetablePrint({ school, wilaya, sessions, workingDays, date, dayText }: TimetablePrintProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [of, setOf] = useState<GridOf>('class');
  const [said, setSaid] = useState<Said>(null);
  const [file, setFile] = useState('');
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const show = (next: Said) => {
    if (mounted.current) setSaid(next);
  };
  const count = (set: GridOf) => timetableNames(sessions, set).length;
  const choice = (value: GridOf) => ({ value, label: t(`ttPrint.of.${value}`, { count: count(value) }) });
  const html = () =>
    gridsHtml(
      t,
      {
        of,
        sessions,
        workingDays,
        school: personName(school),
        wilaya,
        year: yearOf(date),
        level: school.level,
        day: dayText(date),
        mark: t('ttPrint.demo'),
      },
      currentLanguage(),
      direction,
    );
  const run = async (save: boolean) => {
    if (running.current) return;
    running.current = true;
    show('printing');
    try {
      let done: Said = null;
      if (!save) await pdf.printHtml(html(), t(`ttPrint.files.${of}`), true);
      else {
        const name = `${t(`ttPrint.files.${of}`)} ${personName(school)} ${date}.pdf`;
        const made = await pdf.makePdf(html(), 'timetable-grids', true);
        if (await pdf.savePdf(made.name, name)) {
          if (mounted.current) setFile(name);
          done = 'saved';
        }
      }
      show(done);
    } catch {
      show('failed');
    } finally {
      running.current = false;
    }
  };
  const busy = said === 'printing';
  const none = count(of) === 0;
  return (
    <View testID="tt-print" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('ttPrint.title')}
      </Text>
      <Text style={[styles.small, align]}>{t(`ttPrint.lines.${school.level}`)}</Text>
      <SegmentedControl
        testID="tt-print-of"
        label={t('ttPrint.which')}
        choices={[choice('class'), choice('teacher'), choice('room')]}
        selected={of}
        disabled={busy}
        onSelect={setOf}
      />
      {none && <Text style={[styles.small, align]}>{t('ttPrint.noRooms')}</Text>}
      <View style={styles.buttons}>
        <Button
          testID="tt-print-go"
          label={t('ttPrint.print')}
          disabled={busy || none}
          onPress={() => void run(false)}
        />
        <Button
          testID="tt-print-pdf"
          variant="line"
          label={t('ttPrint.pdf')}
          disabled={busy || none}
          onPress={() => void run(true)}
        />
      </View>
      <Text
        testID="tt-print-said"
        accessibilityLiveRegion="polite"
        style={[said === 'failed' ? styles.problem : styles.small, align]}
      >
        {said === null ? '' : t(`ttPrint.said.${said}`, { name: file })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
