// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The days of «سجل النشاط» under its tabs (#235, Log, Log-broken, answer
// 425): «الكل», then corrections, files and printing, and deletions, and the
// devices once it lists a backup or a recovery sheet (#247), each day newest
// first with its changes, each change read as one item, its tab then its
// words. An unchecked change shows only under «الكل». The same list serves the
// log and a history changed outside the app.

import type { LogCategory, LogDay } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { SectionHeader } from '../components/SectionHeader';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { itemText, logDay, type LogNames } from './log-text';

type Tab = 'all' | LogCategory;

const TABS: readonly Tab[] = ['all', 'corrections', 'files', 'erasures', 'devices'];

/** Tabs shown even when empty; the devices' shows once it lists something (answer 425). */
const ALWAYS: ReadonlySet<Tab> = new Set(['all', 'corrections', 'files', 'erasures']);

export function LogList({ days, names }: { readonly days: readonly LogDay[]; readonly names: LogNames }) {
  const t = useText();
  const { direction } = useLocale();
  const [tab, setTab] = useState<Tab>('all');
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const listed = new Set<Tab>(days.flatMap((day) => day.items.flatMap((item) => item.category ?? [])));
  const shown = days
    .map((day) => ({ ...day, items: day.items.filter((item) => tab === 'all' || item.category === tab) }))
    .filter((day) => day.items.length > 0);
  return (
    <View style={styles.list}>
      <ChipGroup
        testID="log-tabs"
        label={t('log.tabsLabel')}
        selected={tab}
        onSelect={setTab}
        choices={TABS.filter((value) => ALWAYS.has(value) || listed.has(value)).map((value) => ({
          value,
          label: t(`log.tabs.${value}`),
        }))}
      />
      {shown.length === 0 && (
        <Notice
          testID="log-empty"
          icon={controlIcon('info')}
          message={t(days.length === 0 ? 'log.empty' : 'log.emptyTab')}
        />
      )}
      {shown.map((day) => (
        <View key={day.day} testID={`log-day-${day.day}`} style={styles.day}>
          <SectionHeader label={logDay(day.day)} />
          {day.items.map((item) => {
            const { tag, text } = itemText(t, names, item);
            return (
              <View
                key={item.seq}
                testID={`log-item-${item.seq}`}
                accessible
                accessibilityLabel={`${tag}. ${text}`}
                style={[styles.item, item.category === null && styles.unchecked]}
              >
                <Text style={[styles.tag, align]}>{tag}</Text>
                <Text style={[styles.text, align]}>{text}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing['space-16'] },
  day: { gap: spacing['space-8'] },
  item: {
    gap: spacing['space-4'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
    borderWidth: 1,
    borderColor: colors.line,
  },
  unchecked: { borderStyle: 'dashed', borderColor: colors.pencil },
  tag: { ...typography.label, color: colors.pencil },
  text: { ...typography.body, color: colors.ink },
});
