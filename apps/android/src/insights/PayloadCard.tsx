// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One class's insights sending, exactly as it is sent (#622, R-1.6-02,
// R-8.4-01, answer 696), as Insights-optin and Log-insights draw it: the grade
// and subject, the wilaya, the pack and its release, the sessions spent on each
// item, the items merged, skipped, split or re-taught, and how far the class
// got by the term's end, each in words from the bundled reference data with
// codes kept left to right; then the term's token and the school and term's
// code, and last the text itself, byte for byte as the app sends it, which can
// be selected. Nothing in it names the class, the school or the teacher.

import { CHANGE_LISTS, type InsightsSending } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import type { TermReference } from '../director/seeded-fill';
import { colors, radius, spacing, typography } from '../design/tokens';
import { subjectName } from '../sharing/statement-lines';
import { gradeName, localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';

/** How many items the sessions line names before the rest is left to the text below. */
const NAMED = 4;

export type PayloadCardProps = {
  readonly sending: InsightsSending;
  /** The sending's exact text as it went, when kept; its JSON otherwise, as it would go. */
  readonly text?: string;
  readonly reference: TermReference;
};

/** The sending's fields in words, then its exact text. */
export function PayloadCard({ sending, text, reference }: PayloadCardProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { profile, packs } = reference;
  const pack = packs.find((one) => one.id === sending.pack && one.release === sending.release);
  const title = (item: string) => isolate(pack?.items.find((one) => one.id === item)?.title ?? item);
  const wilaya = profile.zones?.find((one) => one.code === sending.wilaya);
  const items = Object.entries(sending.sessions);
  const sessions = items
    .slice(0, NAMED)
    .map(([item, count]) => t('demo.insights.payload.itemSessions', { item: title(item), count }));
  const changed = CHANGE_LISTS.flatMap((list) =>
    sending.changed[list].map((item) => t(`demo.insights.payload.changes.${list}`, { item: title(item) })),
  );
  const rows: readonly (readonly [string, string, string])[] = [
    [
      'level',
      t('demo.insights.payload.level'),
      `${gradeName(profile, sending.grade)} · ${subjectName(profile, sending.subject)}`,
    ],
    [
      'wilaya',
      t('demo.insights.payload.wilaya'),
      wilaya === undefined ? isolate(sending.wilaya) : `${isolate(sending.wilaya)} · ${localized(wilaya.name)}`,
    ],
    ['pack', t('demo.insights.payload.pack'), `${isolate(sending.pack)} · ${isolate(sending.release)}`],
    [
      'sessions',
      t('demo.insights.payload.sessions'),
      t('demo.insights.payload.sessionsLine', {
        items: t('count.items', { count: items.length }),
        named: sessions.join(t('demo.insights.payload.separator')),
        more: items.length > NAMED ? t('demo.insights.payload.more') : '',
      }),
    ],
    [
      'changed',
      t('demo.insights.payload.changed'),
      changed.length === 0 ? t('demo.insights.payload.unchanged') : changed.join(t('demo.insights.payload.separator')),
    ],
    [
      'reached',
      t(`demo.insights.payload.reached.${sending.term}`),
      t('demo.insights.payload.reachedLine', { percent: Math.floor(sending.reached / 10) }),
    ],
    ['token', t('demo.insights.payload.token'), isolate(sending.token)],
    ['schoolTerm', t('demo.insights.payload.schoolTerm'), isolate(sending.schoolTerm)],
  ];
  return (
    <View testID="insights-payload" style={styles.card}>
      {rows.map(([key, label, value]) => (
        <View
          key={key}
          testID={`insights-payload-${key}`}
          accessible
          accessibilityLabel={`${label}: ${value}`}
          style={styles.row}
        >
          <Text style={[styles.label, align]}>{label}</Text>
          <Text style={[styles.value, align]}>{value}</Text>
        </View>
      ))}
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('demo.insights.payload.text')}
      </Text>
      <Text testID="insights-payload-text" selectable style={styles.text}>
        {text ?? JSON.stringify(sending)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.paper,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  row: { gap: spacing['space-2'] },
  label: { ...typography.small, color: colors.ink2 },
  value: { ...typography.body, color: colors.ink },
  text: {
    ...typography['body-latin'],
    color: colors.ink,
    direction: 'ltr',
    writingDirection: 'ltr',
    textAlign: 'left',
  },
});
