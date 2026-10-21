// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصحيح المناداة» (#39, Correct): one pupil in a roll call already taken.
// The session and what was recorded, the mark it becomes (present, late,
// absent justified or not, the cause never typed), one of four coded
// reasons, and what the change log and the month's totals become, under
// the counting rules it links to. Saving
// records a new version of the roll call; both stay in the history, dated
// without the time (PRD §3.4, §5.5).

import {
  ROLL_CALL_REASONS,
  correctPupil,
  current,
  formatDay,
  markOf,
  previewCorrection,
  type Day,
  type PupilCount,
  type PupilMark,
  type RollCallReason,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { OptionRow } from '../components/OptionRow';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayAndMonth, dayName } from '../today/DayMark';
import { markWords, unitTime } from './roll-labels';
import { unitByKey } from './roll-rules';

const MARKS: readonly PupilMark[] = ['present', 'late', 'justified', 'unjustified'];

const percent = (count: PupilCount | null) =>
  count?.rate == null ? '–' : `\u2066${Math.round(count.rate * 1000) / 10}%\u2069`;

/** One pupil's correction in a roll call; `onDone` goes back once it is saved. */
export function Correct(props: {
  unitKey: string;
  day: Day;
  pupilId: string;
  onDone: () => void;
  onRules?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, calendarRelease, packs, bells, today, record } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const unit = useMemo(() => unitByKey(context, props.unitKey, props.day), [context, props.unitKey, props.day]);
  const versions = state.rollCalls.get(props.unitKey);
  const rollCall = current(versions);
  const pupil = state.pupils.get(props.pupilId);
  const [mark, setMark] = useState<PupilMark | null>(null);
  const [reason, setReason] = useState<RollCallReason | null>(null);
  const [refused, setRefused] = useState(false);
  const was = rollCall === null ? null : markOf(rollCall, props.pupilId);
  const previewed = useMemo(
    () => (unit === null || mark === null ? null : previewCorrection(context, unit, props.pupilId, mark)),
    [context, unit, props.pupilId, mark],
  );
  const preview = mark === was ? null : previewed;

  if (unit === null || rollCall === null || was === null || pupil === undefined) {
    return (
      <View style={[styles.screen, { direction }]}>
        <Text style={[styles.body, styles.pad, align]}>{t('correct.unavailable')}</Text>
      </View>
    );
  }
  const language = currentLanguage();
  const schoolClass = state.classes.get(unit.classId);
  const day = dayAndMonth(unit.day, language, profile);
  const month = profile.months?.[Number(unit.day.slice(5, 7)) - 1]?.[language] ?? unit.day.slice(5, 7);
  const changed = mark !== null && mark !== was;
  const late =
    mark === 'late' && was !== 'late'
      ? t('correct.lateAdded')
      : was === 'late' && changed
        ? t('correct.lateRemoved')
        : null;

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Text style={[styles.note, align]}>
          {[pupil.name, schoolClass?.name, year.id]
            .filter(Boolean)
            .map((part) => `\u2068${part}\u2069`)
            .join(' · ')}
        </Text>
        <View testID="correct-session" accessible style={styles.card}>
          <Text style={[styles.label, align]}>
            {[dayName(t, unit.day, language, profile), unitTime({ state, bells, calendar }, unit, direction)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text style={[styles.note, align]}>
            {t('correct.recorded', { mark: markWords(t, was), day: formatDay(versions?.at(-1)?.day ?? unit.day) })}
          </Text>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('correct.becomes')} style={styles.group}>
          <Text style={[styles.label, align]}>{t('correct.becomes')}</Text>
          {MARKS.map((one) => (
            <OptionRow
              key={one}
              testID={`correct-${one}`}
              label={one === was ? t('correct.asRecorded', { mark: markWords(t, one) }) : markWords(t, one)}
              selected={(mark ?? was) === one}
              onPress={() => {
                setMark(one);
                setRefused(false);
              }}
            />
          ))}
          <Text style={[styles.note, align]}>{t('correct.justifyNote')}</Text>
        </View>
        <ChipGroup
          testID="correct-reason"
          label={t('roll.reason')}
          choices={ROLL_CALL_REASONS.map((value) => ({ value, label: t(`roll.reasons.${value}`) }))}
          selected={reason}
          onSelect={setReason}
        />
        {changed && (
          <View testID="correct-log" accessible style={styles.log}>
            <Text style={[styles.label, align]}>{t('correct.logTitle')}</Text>
            <Text style={[styles.body, align]}>
              {t('correct.logLine', {
                today: formatDay(today()),
                day,
                from: markWords(t, was),
                to: markWords(t, mark),
                reason: reason === null ? '…' : t(`roll.reasons.${reason}`),
              })}
            </Text>
            {preview !== null && (
              <Text style={[styles.note, align]}>
                {[
                  t('correct.monthLine', {
                    month,
                    before: preview.before?.absent ?? 0,
                    after: preview.after?.absent ?? 0,
                    rateBefore: percent(preview.before),
                    rateAfter: percent(preview.after),
                  }),
                  late,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
            {props.onRules !== undefined && (
              <View style={styles.start}>
                <Button testID="correct-rules" variant="plain" label={t('rules.open')} onPress={props.onRules} />
              </View>
            )}
          </View>
        )}
        <Text style={[styles.note, align]}>{t('correct.both')}</Text>
        {refused && <Text style={[styles.note, align]}>{t('correct.refused')}</Text>}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button
          testID="correct-save"
          label={t('roll.saveFix')}
          icon={controlIcon('check')}
          disabled={!changed || reason === null}
          onPress={() => {
            if (mark === null || reason === null) return;
            let event;
            try {
              event = correctPupil(context, unit, props.pupilId, mark, reason);
            } catch {
              setRefused(true);
              return;
            }
            record(event);
            props.onDone();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], padding: spacing['space-16'] },
  pad: { padding: spacing['space-16'] },
  start: { alignItems: 'flex-start' },
  group: { gap: spacing['space-8'] },
  card: {
    gap: spacing['space-4'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  log: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.soft,
  },
  body: { ...typography.body, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  foot: { paddingHorizontal: spacing['space-16'], paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
