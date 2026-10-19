// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The day a document of a day is made for (#216, Journal): the day before
// and the day after, within the school year, so any day of the year can be
// printed (R-3.8-01). TalkBack reads the new day out as it changes.

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
};

export function DayStep({ day, first, last, disabled, profile, onDay, testID = 'output-day' }: DayStepProps) {
  const t = useText();
  const { direction } = useLocale();
  const name = dayName(t, day, currentLanguage(), profile);
  return (
    <View testID={testID} style={[styles.box, { direction }]}>
      <View style={styles.flip}>
        <IconButton
          testID={`${testID}-before`}
          icon={controlIcon('chevron')}
          accessibilityLabel={t('documents.output.dayBefore')}
          disabled={disabled || day <= first}
          onPress={() => onDay(addDays(day, -1))}
        />
      </View>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.day}>
        {name}
      </Text>
      <IconButton
        testID={`${testID}-after`}
        icon={controlIcon('chevron')}
        accessibilityLabel={t('documents.output.dayAfter')}
        disabled={disabled || day >= last}
        onPress={() => onDay(addDays(day, 1))}
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
