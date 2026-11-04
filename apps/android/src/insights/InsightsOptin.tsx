// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights in a teachers' world, before and after the teacher opts in
// (#622, R-1.6-01, R-1.6-02, answers 696 and 697), as Insights-optin draws it:
// the switch to take part, off until the teacher turns it on, saying what it
// does, and a choice that could not be kept; while on, how the sending stands,
// with a way to try again after a failure (use-insights-sending.ts); and
// exactly what is sent for each class, for the latest term the world's date has
// ended, chosen among the world's teacher's classes; a class that pins no pack
// says it makes no sending. While the sendings are worked out that is said, and
// so is a working out that failed. WorldOptin works them out as it opens
// (use-teacher-sendings.ts).

import { NO_PACK, type InsightsChoice } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Switch } from '../components/Switch';
import type { TermReference } from '../director/seeded-fill';
import { useDeviceText } from '../text/device-text';
import { insightsStyles as styles } from './insights-styles';
import { PayloadCard } from './PayloadCard';
import type { SendingStatus } from './use-insights-sending';
import {
  useTeacherSendings,
  type ClassShown,
  type TeacherSendings,
  type TeacherSendingsInput,
} from './use-teacher-sendings';

/** Taking part: the teacher's choice, how the sending stands, and the ways to change either. */
export type InsightsTaking = {
  readonly choice: InsightsChoice;
  readonly status: SendingStatus;
  readonly onChoose: (on: boolean) => void;
  readonly onRetry: () => void;
  /** Whether the last choice could not be kept. */
  readonly unkept: boolean;
};

export type InsightsOptinProps = InsightsTaking & {
  readonly sendings: TeacherSendings;
  readonly reference: TermReference;
};

/** The switch to take part, how the sending stands, and each class's exact sending. */
export function InsightsOptin(props: InsightsOptinProps) {
  const { sendings, reference, choice, status, onChoose, onRetry, unkept } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [chosen, setChosen] = useState<string | null>(null);
  const classes = sendings.kind === 'shown' ? sendings.classes : [];
  const term = sendings.kind === 'shown' ? sendings.term : null;
  const shown: ClassShown | undefined = classes.find((one) => one.classId === chosen) ?? classes[0];
  return (
    <>
      <View testID={choice.on ? 'insights-on' : 'insights-off'} style={styles.card}>
        <Switch
          testID="insights-take-part"
          label={t('demo.insights.participation')}
          description={t(choice.on ? 'demo.insights.on' : 'demo.insights.off')}
          value={choice.on}
          onValueChange={onChoose}
        />
        {unkept && (
          <Text testID="insights-unkept" accessibilityLiveRegion="polite" style={[styles.small, align]}>
            {t('demo.insights.unkept')}
          </Text>
        )}
        {status.kind !== 'off' && (
          <Text
            testID={`insights-sending-${status.kind}`}
            accessibilityLiveRegion="polite"
            style={[styles.small, align]}
          >
            {status.kind !== 'done'
              ? t(`demo.insights.sending.${status.kind}`)
              : status.taken > 0
                ? t('demo.insights.sending.done', { count: status.taken })
                : t('demo.insights.sending.upToDate')}
          </Text>
        )}
        {status.kind === 'failed' && (
          <Button testID="insights-retry" variant="line" label={t('demo.insights.sending.retry')} onPress={onRetry} />
        )}
      </View>
      {sendings.kind !== 'shown' && (
        <Text testID={`insights-${sendings.kind}`} accessibilityLiveRegion="polite" style={[styles.small, align]}>
          {t(`demo.insights.preview.${sendings.kind === 'failed' ? 'failedAll' : sendings.kind}`)}
        </Text>
      )}
      {shown !== undefined && term !== null && (
        <>
          <ChipGroup
            testID="insights-class"
            label={t('demo.insights.preview.head', {
              term: t(`demo.insights.payload.terms.${term}`),
            })}
            choices={classes.map((one) => ({
              value: one.classId,
              label: one.schoolClass.name,
              script: 'latin' as const,
            }))}
            selected={shown.classId}
            onSelect={setChosen}
          />
          {typeof shown.sending === 'string' ? (
            <Text testID="insights-no-sending" style={[styles.small, align]}>
              {t(shown.sending === NO_PACK ? 'demo.insights.preview.noPack' : 'demo.insights.preview.failed')}
            </Text>
          ) : (
            <PayloadCard sending={shown.sending} reference={reference} />
          )}
        </>
      )}
    </>
  );
}

/** The opt-in of the world's teacher, its sendings worked out as it opens. */
export function WorldOptin(props: TeacherSendingsInput & InsightsTaking) {
  return <InsightsOptin {...props} sendings={useTeacherSendings(props)} />;
}
