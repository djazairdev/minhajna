// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A TD session's list on Today (#231, L-Today, answer 387): in place of the
// proposal, «قائمة الأعمال الموجهة لهذا القسم» with the next three items of the
// pack's TD queue the group takes, with the session each starts at when it
// takes more than one, «اليوم», «الحصة القادمة» and «بعدها», or «بعد الفرض» on
// a row a test of the class comes before; then that TD never moves the main
// plan, and where the main plan stands. The day's lists are worked out once,
// walking each course once.

import { tdLists, type Context, type Day, type TdList as TdListData, type TodaySession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { LIST_ROWS, ListRows, placesOf } from './ListRows';

/** The lists of the day's TD sessions awaiting confirmation with a TD proposal, by session key. */
export function useTdLists(context: Context, items: readonly TodaySession[]): Map<string, TdListData> {
  return useMemo(() => {
    const sessions = items.flatMap((item) =>
      item.status === 'awaiting' && item.proposal?.queue === 'td' ? [item.session] : [],
    );
    const lists = tdLists(context, sessions, LIST_ROWS);
    return new Map([...lists].filter(([, list]) => list.rows.length > 0));
  }, [context, items]);
}

export function TdList({ testID, list, day, name }: { testID: string; list: TdListData; day: Day; name: string }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const places = placesOf(
    list.rows.map((row) => row.session.day),
    day,
  );
  const rows = list.rows.map((row, index) => ({
    title:
      row.proposal.budget > 1
        ? t('listToday.tdSession', { title: isolate(row.item.title), n: row.proposal.session, of: row.proposal.budget })
        : row.item.title,
    place: row.afterTest ? ('afterTest' as const) : (places[index] ?? 'after'),
  }));
  const main =
    list.main === null
      ? null
      : t('listToday.tdMain', {
          name: isolate(name),
          title: t('tests.quoted', { title: isolate(list.main.item.title) }),
          n: list.main.session,
          of: list.main.budget,
        });
  return (
    <View testID={testID} style={styles.group}>
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('listToday.heading.td')}
      </Text>
      <ListRows testID={testID} rows={rows} />
      <Text style={[styles.note, align]}>{[t('listToday.note.td'), main].filter(Boolean).join(' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-10'] },
  label: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
