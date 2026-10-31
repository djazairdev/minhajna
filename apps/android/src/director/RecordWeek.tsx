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
// row. The visa (R-7.5-14) is a comment that never changes the week, which the
// teacher sees in their digest: each visa given, by the version it was given on
// and its day, the line that in a world a visa shows as given in the school's
// space, without proof that the director gave it, and a button that gives one
// on the latest version, one press at a time, which then stays, unpressable,
// saying the visa is given, so focus stays on it; it says the visa is given, or
// that one was given meanwhile, or the problem, and reads the records again
// (visa-session.ts); before the week's first day in the world's date it says no
// visa is given yet, in place of the button. It says the week is shown as
// signed, with no reason for a session not held and no day of signing,
// correcting or confirming, and that a demo world has no roll call or marks.

import {
  sessionDay,
  sessionSlot,
  weekChanges,
  type Day,
  type SessionState,
  type WeekRecord,
  type WeekSession,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { spanText } from '../timetable/grid-text';
import { isolate } from '../week/grid-labels';
import { errorCode } from '../lock/lock-rules';
import { problemOf } from '../school/school-join-session';
import { wholeChain, type CourseRecord, type RecordedWeek } from './records-session';

type Shown = 'original' | 'fixed' | 'both';

/** The words for a visa refused for a reason of its own. */
const VISA_WORDS: Readonly<Record<string, 'demo.records.visaAlready' | 'demo.records.visaEarly'>> = {
  E_WEEK_VISAED: 'demo.records.visaAlready',
  E_VISA_EARLY: 'demo.records.visaEarly',
};

export type RecordWeekProps = {
  readonly record: CourseRecord;
  readonly week: RecordedWeek;
  /** The week's dates, written out. */
  readonly dates: string;
  readonly dayText: (day: Day) => string;
  /** Back to the classes' records. */
  readonly onBack: () => void;
  /** Gives the visa on the latest version and reads the records again; a page without it gives none. */
  readonly onVisa?: () => Promise<void>;
  /** Whether the world's date has reached the week's first day, before which no visa is given. */
  readonly started?: boolean;
};

/** A signed week as the director reads it, and a corrected one with its original, its corrections and its chain. */
export function RecordWeek({ record, week, dates, dayText, onBack, onVisa, started = true }: RecordWeekProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [picked, setShown] = useState<Shown>('fixed');
  const [giving, setGiving] = useState(false);
  const going = useRef(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const visaed = week.visas.some((one) => one.value.version === week.week.version);
  const give = () => {
    if (onVisa === undefined || going.current) return;
    going.current = true;
    setGiving(true);
    setOutcome(null);
    onVisa()
      .then(
        () => setOutcome(t('demo.records.visaDone')),
        (error: unknown) => setOutcome(t(VISA_WORDS[errorCode(error) ?? ''] ?? problemOf(error))),
      )
      .finally(() => {
        going.current = false;
        setGiving(false);
      });
  };
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
      <View testID="record-visa" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.records.visa')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.records.visaLead')}</Text>
        {[...week.visas]
          .sort((a, b) => a.value.version - b.value.version)
          .map((one) => (
            <Text key={one.value.version} testID="record-visa-line" style={[styles.body, align]}>
              {t('demo.records.visaLine', { version: versionName(one.value.version), day: dayText(one.value.day) })}
            </Text>
          ))}
        <Text style={[styles.small, align]}>{t('demo.records.visaDemo')}</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
          {giving ? t('demo.records.giving') : (outcome ?? '')}
        </Text>
        {onVisa !== undefined && !started && <Text style={[styles.small, align]}>{t('demo.records.visaEarly')}</Text>}
        {onVisa !== undefined && started && (
          <Button
            testID="record-visa-give"
            variant="primary"
            disabled={giving || visaed}
            label={t(visaed ? 'demo.records.visaGiven' : fixed ? 'demo.records.visaGiveFix' : 'demo.records.visaGive')}
            onPress={give}
          />
        )}
      </View>
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
