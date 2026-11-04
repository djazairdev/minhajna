// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Obs-Report's way to the IGP (#627, §1.6, §8.4, answer 680), by the world's
// date, never the clock: the draft went to the IGP on the term's last day,
// which has 30 days after it to comment; until they end, no comment yet and the
// publish control disabled with its date; after them, published by the method,
// in coarse figures. No comment flow is built in the demo, so nothing here can
// be pressed, and it says all this is an example. Then the uses the figures may
// never serve, with the IGP asked to commit in writing.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { obsStyles as styles } from './obs-styles';
import { commentsEnd, commentsOver } from './report-closures';

const USES = ['scope', 'rank', 'staff'] as const;

export type ObsReportStepsProps = {
  /** The term's last day. */
  readonly termEnd: Day;
  /** The world's date. */
  readonly date: Day;
  /** A day written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

/** The IGP's 30 days and the uses the figures may never serve. */
export function ObsReportSteps({ termEnd, date, dayText }: ObsReportStepsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const end = isolate(dayText(commentsEnd(termEnd)));
  const over = commentsOver(termEnd, date);
  return (
    <View testID="obs-steps" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.obsReport.igp')}
      </Text>
      <Text testID="obs-step-example" style={[styles.small, align]}>
        {t('demo.obsReport.example')}
      </Text>
      <Text testID="obs-step-sent" style={[styles.body, align]}>
        {t('demo.obsReport.sent', { day: isolate(dayText(termEnd)) })}
      </Text>
      <Text testID="obs-step-comment" style={[styles.body, align]}>
        {t(over ? 'demo.obsReport.commentEnded' : 'demo.obsReport.commentOpen', { day: end })}
      </Text>
      <Text testID="obs-step-publish" style={[styles.body, align]}>
        {t(over ? 'demo.obsReport.published' : 'demo.obsReport.publishLater')}
      </Text>
      {!over && (
        <Button
          testID="obs-publish"
          variant="line"
          disabled
          label={t('demo.obsReport.publishAfter', { day: end })}
          onPress={() => undefined}
        />
      )}
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.obsReport.never')}
      </Text>
      {USES.map((use) => (
        <Text key={use} testID={`obs-never-${use}`} style={[styles.small, align]}>
          {t(`demo.obsReport.uses.${use}`)}
        </Text>
      ))}
      <Text style={[styles.small, align]}>{t('demo.obsReport.writing')}</Text>
    </View>
  );
}
