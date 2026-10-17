// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «المناداة» (#38, Roll and Roll-past): the session's roll call on the class
// list. Everyone is present by default; a tap marks an absence or a lateness,
// and the figures above the list follow (PRD §3.4). The unit is the session
// in CEM and lycée and the half-day in primary. Taken in class or after it;
// a past session's roll call is entered from the paper sheet and recorded on
// the session's date. «حفظ المناداة» records it in one step. A roll call
// already taken opens with its marks and is saved as a correction with a
// reason, never a detail about a pupil; both versions stay in the history.
// There, a pupil's name opens their own correction (#39).
// Nothing is sent anywhere: the official absence system stays as it is.

import {
  ROLL_CALL_REASONS,
  compareDays,
  formatDay,
  pendingDeparture,
  pupilsFor,
  takeRollCall,
  type Day,
  type Pupil,
  type RollCallReason,
  type RollCallUnit,
  type Context,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { RollCallRow } from '../components/RollCallRow';
import { Stats } from '../components/Stats';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayAndMonth, dayName } from '../today/DayMark';
import { unitTime } from './roll-labels';
import {
  counts,
  keepMarks,
  listNumbers,
  mark,
  noMarks,
  recordedMarks,
  sameMarks,
  startedMarks,
  takenOn,
  unitOf,
} from './roll-rules';

type OnMark = (pupilId: string, kind: 'absent' | 'late', on: boolean) => void;

/** One row, redrawn only when its own marks change. */
const PupilRow = memo(function PupilRow(props: {
  pupil: Pupil;
  number: number;
  absent: boolean;
  late: boolean;
  onMark: OnMark;
  onName: ((pupilId: string) => void) | null;
  note: string | null;
}) {
  const { pupil, onMark, onName } = props;
  const t = useText();
  return (
    <RollCallRow
      testID={`roll-${props.number}`}
      number={props.number}
      name={pupil.name}
      absent={props.absent}
      late={props.late}
      onAbsent={(on) => onMark(pupil.id, 'absent', on)}
      onLate={(on) => onMark(pupil.id, 'late', on)}
      {...(props.note !== null && { note: props.note })}
      {...(onName !== null && {
        onName: () => onName(pupil.id),
        nameLabel: t('correct.open', { name: pupil.name }),
      })}
    />
  );
});

type RollProps = {
  sessionKey: string;
  day: Day;
  onDone: () => void;
  onCorrect?: (unit: RollCallUnit, pupilId: string) => void;
  onRules?: () => void;
  onMove?: (classId: string) => void;
};

/**
 * The roll call of the unit a session belongs to; `onDone` goes back once it
 * is saved. Once taken and with no change pending, a pupil's name opens
 * `onCorrect`; the list starts again from each new version recorded.
 */
export function Roll(props: RollProps) {
  const { state, profile, year, calendar, packs } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const [unit] = useState(() => unitOf(context, props.sessionKey, props.day));
  const versions = unit === null ? 0 : (state.rollCalls.get(unit.key)?.length ?? 0);
  return <RollList key={versions} {...props} context={context} unit={unit} />;
}

function RollList({
  onDone,
  onCorrect,
  onRules,
  onMove,
  context,
  unit,
}: RollProps & { context: Context; unit: RollCallUnit | null }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, bells, calendar, today, record } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const pupils = useMemo(() => (unit === null ? [] : pupilsFor(context, unit)), [context, unit]);
  const numbers = useMemo(
    () => (unit === null ? new Map<string, number>() : listNumbers(context, unit.classId)),
    [context, unit],
  );
  const [recorded] = useState(() => (unit === null ? null : recordedMarks(context, unit)));
  const [marks, setMarks] = useState(() => (unit === null ? noMarks : (startedMarks(unit.key) ?? recorded ?? noMarks)));
  const [reason, setReason] = useState<RollCallReason | null>(null);
  const onMark = useCallback<OnMark>((pupilId, kind, on) => setMarks((was) => mark(was, pupilId, kind, on)), []);

  useEffect(() => {
    if (unit !== null) keepMarks(unit.key, sameMarks(marks, recorded ?? noMarks) ? null : marks);
  }, [unit, marks, recorded]);

  const opens = recorded !== null && onCorrect !== undefined && unit !== null && sameMarks(marks, recorded);
  const onName = useMemo(
    () => (opens ? (pupilId: string) => onCorrect(unit, pupilId) : null),
    [opens, onCorrect, unit],
  );

  if (unit === null) {
    return (
      <View style={[styles.screen, { direction }]}>
        <Text style={[styles.body, styles.pad, align]}>{t('roll.unavailable')}</Text>
      </View>
    );
  }
  const language = currentLanguage();
  const schoolClass = state.classes.get(unit.classId);
  const timeText = unitTime({ state, bells, calendar }, unit, direction);
  const past = compareDays(unit.day, today()) < 0;
  const taken = recorded === null ? null : takenOn(context, unit);
  const figures = counts(context, unit, marks);
  const absent = new Set(marks.absent.map((absence) => absence.pupilId));
  const late = new Set(marks.late);
  const unchanged = recorded !== null && sameMarks(marks, recorded);
  const leaverNote = (pupil: Pupil) => {
    const left = pendingDeparture(pupil);
    return left === null ? null : t('move.awaiting', { day: dayAndMonth(left.day, language, profile) });
  };
  const label =
    recorded !== null
      ? t('roll.saveFix')
      : past
        ? t('roll.savePast', { day: dayAndMonth(unit.day, language, profile) })
        : t('roll.save');

  const head = (
    <View style={styles.head}>
      <Text style={[styles.note, align]}>
        {[schoolClass?.name, dayName(t, unit.day, language, profile), timeText].filter(Boolean).join(' · ')}
      </Text>
      {past && recorded === null && (
        <Notice
          testID="roll-past"
          variant="notice"
          badge={t('roll.pastBadge')}
          title={t('roll.pastTitle')}
          message={t('roll.pastNote', { day: formatDay(unit.day), today: formatDay(today()) })}
        />
      )}
      {taken !== null && (
        <>
          <Notice
            testID="roll-taken"
            icon={controlIcon('check')}
            message={t('roll.taken', { day: formatDay(taken) })}
          />
          <ChipGroup
            testID="roll-reason"
            label={t('roll.reason')}
            choices={ROLL_CALL_REASONS.map((value) => ({ value, label: t(`roll.reasons.${value}`) }))}
            selected={reason}
            onSelect={setReason}
          />
        </>
      )}
      <Stats
        testID="roll-stats"
        items={[
          { id: 'present', value: figures.present, label: t('roll.present') },
          { id: 'absent', value: figures.absent, label: t('roll.absentStat') },
          { id: 'late', value: figures.late, label: t('roll.lateStat') },
        ]}
      />
      <Notice icon={controlIcon('info')} message={t(past ? 'roll.pastHint' : 'roll.hint')} />
      <View style={styles.links}>
        {onMove !== undefined && (
          <Button testID="roll-move" variant="plain" label={t('move.open')} onPress={() => onMove(unit.classId)} />
        )}
        {onRules !== undefined && (
          <Button testID="roll-rules" variant="plain" label={t('rules.open')} onPress={onRules} />
        )}
      </View>
    </View>
  );
  return (
    <View style={[styles.screen, { direction }]}>
      <FlatList
        testID="roll-list"
        data={pupils}
        keyExtractor={(pupil) => pupil.id}
        renderItem={({ item, index }) => (
          <PupilRow
            pupil={item}
            number={numbers.get(item.id) ?? index + 1}
            absent={absent.has(item.id)}
            late={late.has(item.id)}
            onMark={onMark}
            onName={onName}
            note={leaverNote(item)}
          />
        )}
        ListHeaderComponent={head}
        contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right }}
        initialNumToRender={12}
        windowSize={7}
      />
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Notice icon={controlIcon('never')} message={t('roll.official')} />
        <Button
          testID="roll-save"
          label={label}
          icon={controlIcon('check')}
          disabled={pupils.length === 0 || unchanged || (recorded !== null && reason === null)}
          onPress={() => {
            record(takeRollCall(context, unit, marks, recorded === null || reason === null ? undefined : reason));
            keepMarks(unit.key, null);
            onDone();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: spacing['space-16'] },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  head: { gap: spacing['space-12'], padding: spacing['space-16'] },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  foot: {
    gap: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    paddingTop: spacing['space-12'],
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
});
