// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A pupil's absences, late arrivals and change log in the roll-call book (#217,
// Pupil). Each half-day missed shows its day, the time of each roll call that
// marked it, and its half, with a «مبرر / غير مبرر» toggle that records the
// change at once (answers 254 and 259); the cause is never typed. Each late
// arrival shows its day and time, and the log says when each mark was recorded,
// then each change with its reason, newest first.

import { ROLL_CALL_REASONS, formatDay, type RollCallReason } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radius, spacing, typography } from '../design/tokens';
import { unitTime } from '../roll/roll-labels';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayAndMonth, dayName } from '../today/DayMark';
import type { LogEntry, PupilAbsence, PupilView } from './pupil-rules';

const isReason = (reason: string | undefined): reason is RollCallReason =>
  (ROLL_CALL_REASONS as readonly string[]).includes(reason ?? '');

export function PupilAbsences(props: {
  readonly view: PupilView;
  readonly busy: boolean;
  readonly onJustify: (absence: PupilAbsence, justified: boolean) => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const { state, bells, calendar, profile } = useAppData();
  const language = currentLanguage();
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  const when = (absence: PupilAbsence) => {
    const times = absence.units.flatMap((unit) => unitTime({ state, bells, calendar }, unit, direction) ?? []);
    const half = t(`rollBook.spoken.${absence.mark.half}`);
    return times.length === 0 ? half : `${times.join('، ')} · ${half}`;
  };
  return (
    <>
      <SectionHeader testID="pupil-absences" label={t('pupilPage.absences')} />
      {props.view.absences.length === 0 ? (
        <Text style={[styles.note, align]}>{t('pupilPage.absencesNone')}</Text>
      ) : (
        <View style={styles.card}>
          {props.view.absences.map((absence, index) => {
            const day = dayName(t, absence.mark.day, language, profile);
            return (
              <View
                key={`${absence.mark.day}/${absence.mark.half}`}
                style={[styles.absence, index > 0 && styles.rule, { direction }]}
              >
                <View style={styles.when}>
                  <Text style={[styles.day, align]}>{day}</Text>
                  <Text style={[styles.time, align]}>{when(absence)}</Text>
                </View>
                <SegmentedControl
                  testID={`pupil-justify-${absence.mark.day}-${absence.mark.half}`}
                  label={t('pupilPage.justification', { day })}
                  choices={[
                    { value: 'justified', label: t('pupilPage.justified') },
                    { value: 'unjustified', label: t('pupilPage.unjustified') },
                  ]}
                  selected={absence.mark.justified ? 'justified' : 'unjustified'}
                  disabled={props.busy || absence.units.length === 0}
                  onSelect={(value) => {
                    if ((value === 'justified') !== absence.mark.justified) {
                      props.onJustify(absence, value === 'justified');
                    }
                  }}
                />
              </View>
            );
          })}
        </View>
      )}
      <Text style={[styles.note, align]}>{t('pupilPage.lock')}</Text>
    </>
  );
}

export function PupilLates(props: { readonly view: PupilView }) {
  const t = useText();
  const { direction } = useLocale();
  const { state, bells, calendar, profile } = useAppData();
  const language = currentLanguage();
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  return (
    <>
      <SectionHeader testID="pupil-lates" label={t('pupilPage.late')} />
      {props.view.lates.length === 0 ? (
        <Text style={[styles.note, align]}>{t('pupilPage.lateNone')}</Text>
      ) : (
        <View style={styles.card}>
          {props.view.lates.map((unit, index) => {
            const time = unitTime({ state, bells, calendar }, unit, direction);
            return (
              <View key={unit.key} accessible style={[styles.late, index > 0 && styles.rule]}>
                <Text style={[styles.day, align]}>{dayName(t, unit.day, language, profile)}</Text>
                <Text style={[styles.time, align]}>
                  {[time, t('pupilPage.lateLine')].filter((part) => part !== null).join(' · ')}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

export function PupilLog(props: { readonly view: PupilView }) {
  const t = useText();
  const { direction } = useLocale();
  const { profile } = useAppData();
  const language = currentLanguage();
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  const line = (entry: LogEntry) => {
    const changed = `\u2066${formatDay(entry.changed)}\u2069`;
    const day = dayAndMonth(entry.day, language, profile);
    if (entry.kind === 'recorded') {
      return t('pupilPage.recorded', { changed, day, mark: t(`pupilPage.marks.${entry.mark}`) });
    }
    const text = t('pupilPage.changed', {
      changed,
      day,
      from: t(`pupilPage.markNames.${entry.from}`),
      to: t(`pupilPage.markNames.${entry.to}`),
      reason: isReason(entry.reason) ? t(`roll.reasons.${entry.reason}`) : '',
    });
    return isReason(entry.reason) ? text : text.replace(/ · $/, '');
  };
  return (
    <>
      <SectionHeader testID="pupil-log" label={t('pupilPage.log')} />
      {props.view.log.length === 0 ? (
        <Text style={[styles.note, align]}>{t('pupilPage.logNone')}</Text>
      ) : (
        props.view.log.map((entry, index) => (
          <Text key={`${index}/${entry.kind}/${entry.unit}`} style={[styles.log, align]}>
            {line(entry)}
          </Text>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    paddingHorizontal: spacing['space-16'],
  },
  absence: { paddingVertical: spacing['space-12'], gap: spacing['space-10'] },
  late: { paddingVertical: spacing['space-12'], gap: spacing['space-4'] },
  rule: { borderTopWidth: 1, borderTopColor: colors.line },
  when: { gap: spacing['space-4'] },
  day: { ...typography.body, color: colors.ink },
  time: { ...typography.caption, color: colors.ink2 },
  note: { ...typography.caption, color: colors.ink2 },
  log: { ...typography.caption, color: colors.ink },
});
