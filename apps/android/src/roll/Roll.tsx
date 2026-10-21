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
  compareDays,
  pendingDeparture,
  planOf,
  pupilsFor,
  seatedRoll,
  takeRollCall,
  rotationRosterReady,
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
import { Notice } from '../components/Notice';
import { RollCallRow } from '../components/RollCallRow';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayAndMonth, dayName } from '../today/DayMark';
import { unitTime } from './roll-labels';
import { RollHead, type RollView } from './RollHead';
import { RollSeats } from './RollSeats';
import {
  counts,
  cycleMark,
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
  onDone: (first: boolean) => void;
  onCorrect?: (unit: RollCallUnit, pupilId: string) => void;
  onRules?: () => void;
  onMove?: (classId: string) => void;
  onSeats?: (classId: string, groupId: string) => void;
};

/**
 * The roll call of the unit a session belongs to; `onDone` goes back once it
 * is saved, saying whether it was taken for the first time. Once taken and
 * with no change pending, a pupil's name opens `onCorrect`; the list starts
 * again from each new version recorded.
 */
export function Roll(props: RollProps) {
  const { state, profile, year, calendar, calendarRelease, packs } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
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
  onSeats,
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
  const plan = unit === null ? null : planOf(context, unit.classId, unit.groupId);
  const [view, setView] = useState<RollView>(() => (plan === null ? 'list' : 'seats'));
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
  const groupsReady = rotationRosterReady(context, unit);
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
    <RollHead
      unit={unit}
      title={[schoolClass?.name, dayName(t, unit.day, language, profile), timeText].filter(Boolean).join(' · ')}
      past={past}
      recorded={recorded !== null}
      taken={taken}
      today={today()}
      reason={reason}
      onReason={setReason}
      figures={figures}
      view={plan === null ? 'list' : view}
      onView={(next) => {
        if (next === 'seats' && plan === null) onSeats?.(unit.classId, unit.groupId);
        else setView(next);
      }}
      {...(onMove !== undefined && { onMove })}
      {...(onSeats !== undefined && { onSeats })}
      {...(onRules !== undefined && { onRules })}
    />
  );
  const seated = plan === null ? null : seatedRoll(context, unit);
  return (
    <View style={[styles.screen, { direction }]}>
      {view === 'seats' && plan !== null && seated !== null ? (
        <RollSeats
          head={head}
          seated={seated}
          rows={plan.rows}
          columns={plan.columns}
          aisleEvery={plan.aisleEvery ?? 0}
          numbers={numbers}
          absent={absent}
          late={late}
          onSeat={(pupilId) => setMarks((was) => cycleMark(was, pupilId))}
          onMark={onMark}
        />
      ) : (
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
      )}
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Notice icon={controlIcon('never')} message={t('roll.official')} />
        {!groupsReady && (
          <Notice
            testID="roll-groups-missing"
            icon={controlIcon('info')}
            message={t('calendarView.groups.missingRoster')}
          />
        )}
        <Button
          testID="roll-save"
          label={label}
          icon={controlIcon('check')}
          disabled={!groupsReady || pupils.length === 0 || unchanged || (recorded !== null && reason === null)}
          onPress={() => {
            record(takeRollCall(context, unit, marks, recorded === null || reason === null ? undefined : reason));
            keepMarks(unit.key, null);
            onDone(recorded === null);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: spacing['space-16'] },
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
