// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A refused update (Import-refused board, R-4.8-05): why, what was checked
// and how far the checks went, where it came from, that nothing changed,
// and what to do; reporting it opens Help, which says what to send by hand
// (answer 307).

import type { TrustedKey } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import type { UpdateProblem } from './read-update';

type Check = 'format' | 'key' | 'signature' | 'content';
type Outcome = 'passed' | 'failed' | 'skipped';

/** How far the checks went: each passed until the one that failed, and none after it was made. */
export function checksFor(problem: UpdateProblem): Record<Check, Outcome> {
  const failed: Check =
    problem === 'invalid' || problem === 'version'
      ? 'format'
      : problem === 'unknown-key'
        ? 'key'
        : problem === 'signature'
          ? 'signature'
          : 'content';
  const order: Check[] = ['format', 'key', 'signature', 'content'];
  const at = order.indexOf(failed);
  return Object.fromEntries(
    order.map((check, index) => [check, index < at ? 'passed' : index === at ? 'failed' : 'skipped']),
  ) as Record<Check, Outcome>;
}

export function UpdateRefused({
  problem,
  signer,
  via,
  onReport,
}: {
  problem: UpdateProblem;
  signer?: TrustedKey;
  via: string;
  onReport: () => void;
}) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const checks = checksFor(problem);
  const label = (check: Check) =>
    check === 'key' && signer !== undefined
      ? t('calendarView.update.checks.keyOf', { holder: isolate(localized(signer.holder)) })
      : t(`calendarView.update.checks.${check}`);
  return (
    <View testID="update-refused" style={styles.card}>
      <Badge testID="update-refused-badge" variant="warning" label={t('calendarView.update.refused')} />
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t(`calendarView.update.problems.${problem}.title`)}
      </Text>
      <Text style={[styles.body, align]}>{t(`calendarView.update.problems.${problem}.body`)}</Text>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.update.checked')}
      </Text>
      {(Object.keys(checks) as Check[]).map((check) => (
        <Text key={check} testID={`update-check-${check}`} style={[styles.body, align]}>
          {t(`calendarView.update.check.${checks[check]}`, { check: label(check) })}
        </Text>
      ))}
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.update.source')}
      </Text>
      <Text style={[styles.body, align]}>{via}</Text>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.update.unchanged')}
      </Text>
      <Text style={[styles.body, align]}>{t('calendarView.update.unchangedBody')}</Text>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.update.whatNow')}
      </Text>
      <Text style={[styles.body, align]}>{t('calendarView.update.whatNowBody')}</Text>
      <Button
        testID="update-report"
        variant="line"
        label={t('calendarView.update.report')}
        accessibilityHint={t('calendarView.update.reportHint')}
        onPress={onReport}
      />
      <Text style={[styles.body, align]}>{t('calendarView.update.reportHint')}</Text>
      <Text style={[styles.body, align]}>{t('calendarView.update.everyUpdate')}</Text>
    </View>
  );
}
