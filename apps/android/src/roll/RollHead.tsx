// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The head of «المناداة»: the session, the notices of a past or a taken
// roll call with its reason, the figures, the choice of the list or the
// seating plan (#41), and the links to the class's other settings.

import { ROLL_CALL_REASONS, formatDay, type Day, type RollCallReason, type RollCallUnit } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { SegmentedControl } from '../components/SegmentedControl';
import { Stats } from '../components/Stats';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type RollView = 'list' | 'seats';

export type RollHeadProps = {
  unit: RollCallUnit;
  title: string;
  past: boolean;
  recorded: boolean;
  taken: Day | null;
  today: Day;
  reason: RollCallReason | null;
  onReason: (reason: RollCallReason) => void;
  figures: { present: number; absent: number; late: number };
  view: RollView;
  onView: (view: RollView) => void;
  onMove?: (classId: string) => void;
  onSeats?: (classId: string, groupId: string) => void;
  onRules?: () => void;
};

export function RollHead(props: RollHeadProps) {
  const { direction } = useLocale();
  const t = useText();
  const { unit, figures, onMove, onSeats, onRules } = props;
  return (
    <View style={styles.head}>
      <Text style={[styles.note, { writingDirection: direction, textAlign: 'start' }]}>{props.title}</Text>
      {props.past && !props.recorded && (
        <Notice
          testID="roll-past"
          variant="notice"
          badge={t('roll.pastBadge')}
          title={t('roll.pastTitle')}
          message={t('roll.pastNote', { day: formatDay(unit.day), today: formatDay(props.today) })}
        />
      )}
      {props.taken !== null && (
        <>
          <Notice
            testID="roll-taken"
            icon={controlIcon('check')}
            message={t('roll.taken', { day: formatDay(props.taken) })}
          />
          <ChipGroup
            testID="roll-reason"
            label={t('roll.reason')}
            choices={ROLL_CALL_REASONS.map((value) => ({ value, label: t(`roll.reasons.${value}`) }))}
            selected={props.reason}
            onSelect={props.onReason}
          />
        </>
      )}
      <SegmentedControl
        testID="roll-view"
        label={t('seats.view')}
        choices={[
          { value: 'list', label: t('seats.list') },
          { value: 'seats', label: t('seats.title') },
        ]}
        selected={props.view}
        onSelect={props.onView}
      />
      <Stats
        testID="roll-stats"
        items={[
          { id: 'present', value: figures.present, label: t('roll.present') },
          { id: 'absent', value: figures.absent, label: t('roll.absentStat') },
          { id: 'late', value: figures.late, label: t('roll.lateStat') },
        ]}
      />
      {props.view === 'list' && (
        <Notice icon={controlIcon('info')} message={t(props.past ? 'roll.pastHint' : 'roll.hint')} />
      )}
      <View style={styles.links}>
        {onMove !== undefined && (
          <Button testID="roll-move" variant="plain" label={t('move.open')} onPress={() => onMove(unit.classId)} />
        )}
        {onSeats !== undefined && (
          <Button
            testID="roll-seats"
            variant="plain"
            label={t('seats.open')}
            onPress={() => onSeats(unit.classId, unit.groupId)}
          />
        )}
        {onRules !== undefined && (
          <Button testID="roll-rules" variant="plain" label={t('rules.open')} onPress={onRules} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing['space-12'], padding: spacing['space-16'] },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  note: { ...typography.caption, color: colors.ink2 },
});
