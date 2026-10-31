// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A signed week as the director reads it (#585, D-Record, D-Record-fix,
// R-3.1-08, R-5.5-02, R-5.5-04, R-5.5-09, answer 613): headed by its class, and
// whether corrected, then its subject, teacher and dates; that it was signed
// with the teacher's certified key, and not corrected since or with how many
// signed corrections; each session by its date, bell span and group, with its
// state as signed: as planned, not held with no reason, or awaiting
// confirmation. A corrected week says whether its chain is whole, every version
// from the original read and its signature checked, or names the versions not
// read, the original by that name and each correction by its number; with its
// original read, it shows the original, the version after correction or both,
// each session's state in each; without it, only the latest. Each correction
// comes numbered by its version, with the session it changed, from what to
// what, and its reason when it has one (answer 611), between versions read in a
// row. It says the week is shown as signed, with no reason for a session not
// held and no day of signing, correcting or confirming, and that a demo world
// has no roll call or marks.

import {
  sessionDay,
  sessionSlot,
  weekChanges,
  type ChannelWeek,
  type Day,
  type SessionState,
  type WeekRecord,
  type WeekSession,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { spanText } from '../timetable/grid-text';
import { isolate } from '../week/grid-labels';
import { wholeChain, type CourseRecord } from './records-session';

type Shown = 'original' | 'fixed' | 'both';

export type RecordWeekProps = {
  readonly record: CourseRecord;
  readonly week: ChannelWeek;
  /** The week's dates, written out. */
  readonly dates: string;
  readonly dayText: (day: Day) => string;
  /** Back to the classes' records. */
  readonly onBack: () => void;
};

/** A signed week as the director reads it, and a corrected one with its original, its corrections and its chain. */
export function RecordWeek({ record, week, dates, dayText, onBack }: RecordWeekProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [picked, setShown] = useState<Shown>('fixed');
  const versions = [...week.earlier, week].map((one) => one.week);
  const original = versions[0];
  const hasOriginal = original.version === 0;
  const shown = hasOriginal ? picked : 'fixed';
  const fixed = week.week.version > 0;
  const slot = (one: Omit<WeekSession, 'state'>) =>
    [dayText(sessionDay(week.week.week, one)), spanText(one.start, one.end)]
      .concat(one.group === '' ? [] : [isolate(one.group)])
      .join(' · ');
  const state = (value: SessionState | null) => t(`demo.weekFix.states.${value ?? 'none'}`);
  const stateOf = (version: WeekRecord, one: Omit<WeekSession, 'state'>) =>
    version.sessions.find((each) => sessionSlot(each) === sessionSlot(one))?.state ?? null;
  const all = [...original.sessions, ...week.week.sessions.filter((one) => stateOf(original, one) === null)].sort(
    (a, b) => a.day - b.day || a.start - b.start,
  );
  const line = (one: Omit<WeekSession, 'state'>) => {
    if (!fixed || shown !== 'both')
      return t('demo.records.line', {
        session: slot(one),
        state: state(stateOf(shown === 'original' ? original : week.week, one)),
      });
    return t('demo.records.both', {
      session: slot(one),
      before: state(stateOf(original, one)),
      after: state(stateOf(week.week, one)),
    });
  };
  const sessions = !fixed || shown === 'both' ? all : (shown === 'original' ? original : week.week).sessions;
  const fixes = versions.slice(1).flatMap((version, at) =>
    (version.version === versions[at].version + 1 ? weekChanges(versions[at], version) : []).map((change) => {
      const text = t('demo.records.fix', {
        number: version.version,
        session: slot(change.slot),
        before: state(change.before),
        after: state(change.after),
      });
      return version.reason === undefined
        ? text
        : t('demo.weekFix.because', { change: text, reason: t(`demo.weekFix.reasons.${version.reason}`) });
    }),
  );
  const versionName = (version: number) =>
    version === 0 ? t('demo.records.originalName') : t('demo.records.fixNumber', { number: version });
  const missing = Array.from({ length: week.week.version }, (_, at) => at).filter(
    (at) => !week.earlier.some((one) => one.week.version === at),
  );
  return (
    <View testID="record-week" style={styles.page}>
      <Button testID="record-back" variant="line" label={t('demo.records.back')} onPress={onBack} />
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t(fixed ? 'demo.records.weekFixed' : 'demo.records.week', { class: isolate(week.week.class) })}
      </Text>
      <Text style={[styles.small, align]}>
        {[isolate(week.week.subject), isolate(record.teacher), dates].join(' · ')}
      </Text>
      <Text style={[styles.body, align]}>
        {fixed ? t('demo.records.signedFixed', { count: week.week.version }) : t('demo.records.signed')}
      </Text>
      {fixed && (
        <Text testID="record-chain" style={[styles.body, align]}>
          {wholeChain(week)
            ? t('demo.records.chainWhole')
            : t('demo.records.chainGap', { versions: missing.map(versionName).join(t('demo.weekSign.listJoin')) })}
        </Text>
      )}
      {fixed && hasOriginal && (
        <SegmentedControl
          testID="record-shown"
          label={t('demo.records.shown')}
          choices={[
            { value: 'original', label: t('demo.records.original') },
            { value: 'fixed', label: t('demo.records.fixed') },
            { value: 'both', label: t('demo.records.bothLabel') },
          ]}
          selected={shown}
          onSelect={setShown}
        />
      )}
      <View style={styles.card}>
        {sessions.map((one) => (
          <Text key={sessionSlot(one)} testID="record-session" style={[styles.body, align]}>
            {line(one)}
          </Text>
        ))}
      </View>
      {fixes.length > 0 && (
        <View testID="record-fixes" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.records.fixes')}
          </Text>
          {fixes.map((text, at) => (
            <Text key={`${at}`} style={[styles.small, align]}>
              {text}
            </Text>
          ))}
        </View>
      )}
      <Text style={[styles.small, align]}>{t('demo.records.asSigned')}</Text>
      <Text style={[styles.small, align]}>{t('demo.records.noRoll')}</Text>
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
  title: { ...typography.h3, color: colors.ink },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
