// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Roll-print's day, for the blank sheet and the session slip (#217,
// answers 262 and 264): a label, the day stepped through the days given,
// and, for the slip, chips for the day's taken roll calls when it has more
// than one.

import type { CountryProfile, Day } from '@minhajna/core';
import { StyleSheet, Text } from 'react-native';
import { ChipGroup } from '../components/Chip';
import { colors, spacing, typography } from '../design/tokens';
import { DayStep } from '../documents/DayStep';

export interface RollPrintDayProps {
  readonly testID: string;
  readonly label: string;
  readonly day: Day;
  readonly days: readonly Day[];
  readonly year: { readonly from: Day; readonly to: Day };
  readonly profile: Pick<CountryProfile, 'months'>;
  readonly disabled: boolean;
  readonly onDay: (day: Day) => void;
  /** The day's roll calls to pick from, shown when there are two or more. */
  readonly sessions?: {
    readonly label: string;
    readonly selected: string;
    readonly choices: readonly { readonly value: string; readonly label: string }[];
    readonly onSelect: (value: string) => void;
  };
}

export function RollPrintDay(props: RollPrintDayProps) {
  const { sessions } = props;
  return (
    <>
      <Text style={styles.label}>{props.label}</Text>
      <DayStep
        testID={props.testID}
        day={props.day}
        first={props.year.from}
        last={props.year.to}
        days={props.days}
        disabled={props.disabled}
        profile={props.profile}
        onDay={props.onDay}
      />
      {sessions !== undefined && sessions.choices.length > 1 && (
        <ChipGroup
          testID={`${props.testID}-session`}
          label={sessions.label}
          selected={sessions.selected}
          onSelect={sessions.onSelect}
          choices={sessions.choices}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.ink2, marginBottom: -spacing['space-8'] },
});
