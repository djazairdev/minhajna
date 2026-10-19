// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The day a document of a day is made for (#216, Journal): the day before
// and the day after, within the school year, so any day of the year can be
// printed (R-3.8-01), or, given a list of days, such as a class's session
// days for Roll-print's blank sheet (#217), the one before and after in it.
// TalkBack reads the new day out as it changes.

import { addDays, type CountryProfile, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { colors, radius, typography } from '../design/tokens';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';

export type DayStepProps = {
  readonly day: Day;
  readonly first: Day;
  readonly last: Day;
  readonly disabled: boolean;
  readonly profile: Pick<CountryProfile, 'months'>;
  readonly onDay: (day: Day) => void;
  /** The step's test ID, and its buttons' with «-before» and «-after»; `output-day` when not given. */
  readonly testID?: string;
  /** The only days to step through, in order; every day from `first` to `last` when not given. */
  readonly days?: readonly Day[];
};

export function DayStep({ day, first, last, disabled, profile, onDay, testID = 'output-day', days }: DayStepProps) {
  const t = useText();
  const { direction } = useLocale();
  const name = dayName(t, day, currentLanguage(), profile);
  const before =
    days === undefined ? (day <= first ? null : addDays(day, -1)) : (days.filter((one) => one < day).at(-1) ?? null);
  const after = days === undefined ? (day >= last ? null : addDays(day, 1)) : (days.find((one) => one > day) ?? null);
  return (
    <View testID={testID} style={[styles.box, { direction }]}>
      <View style={styles.flip}>
        <IconButton
          testID={`${testID}-before`}
          icon={controlIcon('chevron')}
          accessibilityLabel={t('documents.output.dayBefore')}
          disabled={disabled || before === null}
          onPress={() => before !== null && onDay(before)}
        />
      </View>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.day}>
        {name}
      </Text>
      <IconButton
        testID={`${testID}-after`}
        icon={controlIcon('chevron')}
        accessibilityLabel={t('documents.output.dayAfter')}
        disabled={disabled || after === null}
        onPress={() => after !== null && onDay(after)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  flip: { transform: [{ scaleX: -1 }] },
  day: { ...typography.label, color: colors.ink, flex: 1, textAlign: 'center' },
});
