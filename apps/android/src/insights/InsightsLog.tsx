// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The log of a teachers' world's insights (#622, R-1.6-03, answer 698), as
// Log-insights draws it, opened from the insights page: by the day, newest
// first, each turning on or off of taking part and each sending, the sending
// naming its class and term and opening to its text as it was sent
// (PayloadCard.tsx), with where it went and what it never holds; no clock time
// is kept, in the log or in the sending. With nothing in it, it says so, and a
// failed try at sending is said too, in a live line kept mounted, as the page
// saying so is hidden under it. A sending is opened by its ID, so lines added
// while it is open change nothing, and the log stays mounted under it, keeping
// its place. Going back closes an open sending first, focus returning to its
// row, then returns to the insights page.

import type { Day, InsightsLogLine } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import type { TermReference } from '../director/seeded-fill';
import { controlIcon } from '../design/Icon';
import { useDeviceText } from '../text/device-text';
import { InsightsScreen } from './InsightsScreen';
import { insightsStyles as styles } from './insights-styles';
import { PayloadCard } from './PayloadCard';
import { useReturnFocus } from './use-return-focus';

export type InsightsLogProps = {
  /** The log's lines, newest day first. */
  readonly lines: readonly InsightsLogLine[];
  /** A class's name, by its ID. */
  readonly className: (classId: string) => string;
  readonly reference: TermReference;
  /** The world's date, written out for the band. */
  readonly date: string;
  readonly dayText: (day: Day) => string;
  /** Whether the latest try at sending failed, since the insights page, which says so, is hidden under the log. */
  readonly failed?: boolean;
  /** Back to the insights page. */
  readonly onClose: () => void;
};

/** Each day's lines, the newest first, in the order the log gives them. */
function byDay(lines: readonly InsightsLogLine[]): { day: Day; lines: { line: InsightsLogLine; at: number }[] }[] {
  const days: { day: Day; lines: { line: InsightsLogLine; at: number }[] }[] = [];
  lines.forEach((line, at) => {
    const last = days.at(-1);
    if (last?.day === line.day) last.lines.push({ line, at });
    else days.push({ day: line.day, lines: [{ line, at }] });
  });
  return days;
}

/** The log by the day, a sending opening to its text as sent. */
export function InsightsLog({ lines, className, reference, date, dayText, failed, onClose }: InsightsLogProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [opened, setOpened] = useState<string | null>(null);
  const rowRef = useReturnFocus(opened);
  const shown = lines.find((one) => one.kind === 'sent' && one.sending.id === opened);
  const title = t('demo.insights.links.log.title');
  return (
    <>
      <View style={shown === undefined ? styles.full : styles.gone}>
        <InsightsScreen
          name="insights-log"
          title={title}
          sub={t('demo.insights.log.sub')}
          date={date}
          onClose={onClose}
        >
          <Text style={[styles.note, align]}>{t('demo.insights.log.note')}</Text>
          <Text
            testID="insights-log-failed"
            accessibilityLiveRegion="polite"
            style={failed === true ? [styles.note, align] : styles.hidden}
          >
            {failed === true ? t('demo.insights.log.failed') : ''}
          </Text>
          {lines.length === 0 && (
            <Text testID="insights-log-empty" style={[styles.small, align]}>
              {t('demo.insights.log.empty')}
            </Text>
          )}
          {byDay(lines).map(({ day, lines: those }) => (
            <View key={day} testID={`insights-log-${day}`} style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {dayText(day)}
              </Text>
              {those.map(({ line, at }) =>
                line.kind === 'sent' ? (
                  <RowLink
                    key={line.sending.id}
                    ref={rowRef(line.sending.id)}
                    testID={`insights-log-sent-${line.sending.id}`}
                    icon={controlIcon('check')}
                    title={`${className(line.classId)} · ${t(`demo.insights.payload.reached.${line.sending.term}`)}`}
                    description={t('demo.insights.log.sent')}
                    onPress={() => setOpened(line.sending.id)}
                  />
                ) : (
                  <Text key={at} testID={`insights-log-line-${at}`} style={[styles.label, align]}>
                    {t(`demo.insights.log.${line.kind}`)}
                  </Text>
                ),
              )}
            </View>
          ))}
        </InsightsScreen>
      </View>
      {shown?.kind === 'sent' && (
        <InsightsScreen
          name="insights-sent"
          title={title}
          sub={className(shown.classId)}
          date={date}
          onClose={() => setOpened(null)}
        >
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.insights.log.asSent', {
              term: t(`demo.insights.payload.reached.${shown.sending.term}`),
              day: dayText(shown.day),
            })}
          </Text>
          <PayloadCard sending={shown.sending} text={shown.text} reference={reference} />
          <Text style={[styles.small, align]}>{t('demo.insights.log.where')}</Text>
          <Button
            testID="insights-sent-close"
            variant="line"
            label={t('demo.insights.log.close')}
            onPress={() => setOpened(null)}
          />
        </InsightsScreen>
      )}
    </>
  );
}
