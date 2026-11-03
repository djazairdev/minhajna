// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights in a teachers' world before the teacher opts in (#622, R-1.6-02,
// answer 696), as Insights-optin draws it: taking part is off, and before it
// is turned on, exactly what would be sent for each class, for the latest term
// the world's date has ended, chosen among the world's teacher's classes; a
// class that pins no pack says it makes no sending. While the sendings are
// worked out that is said, and so is a working out that failed. WorldOptin
// works them out as it opens (use-teacher-sendings.ts).

import { NO_PACK } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import type { TermReference } from '../director/seeded-fill';
import { useDeviceText } from '../text/device-text';
import { insightsStyles as styles } from './insights-styles';
import { PayloadCard } from './PayloadCard';
import {
  useTeacherSendings,
  type ClassShown,
  type TeacherSendings,
  type TeacherSendingsInput,
} from './use-teacher-sendings';

export type InsightsOptinProps = {
  readonly sendings: TeacherSendings;
  readonly reference: TermReference;
};

/** Taking part, off, and each class's exact sending. */
export function InsightsOptin({ sendings, reference }: InsightsOptinProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [chosen, setChosen] = useState<string | null>(null);
  const classes = sendings.kind === 'shown' ? sendings.classes : [];
  const term = sendings.kind === 'shown' ? sendings.term : null;
  const shown: ClassShown | undefined = classes.find((one) => one.classId === chosen) ?? classes[0];
  return (
    <>
      <View testID="insights-off" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.insights.participation')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.insights.off')}</Text>
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
export function WorldOptin(props: TeacherSendingsInput) {
  return <InsightsOptin sendings={useTeacherSendings(props)} reference={props.reference} />;
}
