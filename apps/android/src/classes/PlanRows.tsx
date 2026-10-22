// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's plan rows (#37): each item with the days it was taught or the
// day the plan would reach it, its tags, where the class is, and the
// reference, under its unit. A week pack's rows come by plan week instead
// (#230, Plan-primary, answer 381): «أسبوع المخطط 5» with its days and its
// sequence, and its pace card says the class's plan week and the plan's,
// the sessions the calendar took, counted apart, and the weekly model. A
// hybrid pack's weekly targets each follow their item (#231).

import {
  compareDays,
  type Day,
  type Pace,
  type PackItem,
  type PlanPack,
  type PlanRow,
  type WeekTarget,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { currentLanguage, useText } from '../text/i18n';
import { dayMonth, rowDays, rowSpoken, rowTags } from './plan-labels';
import { TargetRow } from './WeekTargets';

export type PlanRowsProps = {
  readonly rows: readonly PlanRow[];
  /** The units and sequences, in the plan's order. */
  readonly heads: readonly PackItem[];
  /** Items postponed past the next exams. */
  readonly later: ReadonlySet<string>;
  readonly onItem?: (itemId: string) => void;
  /** By unit, by plan week for a week pack, or in one list, as TD items are. */
  readonly by?: 'unit' | 'week' | 'none';
  /** A hybrid pack's weekly targets, each shown after its item. */
  readonly targets?: readonly WeekTarget[];
  readonly pack?: PlanPack;
};

export function PlanRows({ rows, heads, later, onItem, by = 'unit', targets = [], pack }: PlanRowsProps) {
  const weeks = by === 'week';
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const row = (one: PlanRow) => {
    const days = rowDays(one);
    const postponed = later.has(one.item.id);
    return (
      <Pressable
        key={one.item.id}
        testID={`plan-${one.item.id}`}
        accessible
        accessibilityLabel={rowSpoken(t, one, comma, postponed)}
        {...(onItem !== undefined && {
          accessibilityRole: 'button' as const,
          accessibilityHint: t('classPlan.openItem'),
          onPress: () => onItem(one.item.id),
        })}
        style={({ pressed }) => [
          styles.row,
          one.position && styles.here,
          pressed && onItem !== undefined && styles.pressed,
        ]}
      >
        <Text style={[styles.day, days?.ahead === true && styles.ahead]}>{days?.text ?? ''}</Text>
        <View style={styles.grow}>
          <Text style={[styles.title, one.status === 'open' && styles.ahead, align]}>{one.item.title}</Text>
          <View style={styles.tags}>
            {rowTags(t, one, postponed).map((tag) => (
              <Text key={tag.id} style={[styles.tag, tag.id === 'position' && styles.tagHere]}>
                {tag.label}
              </Text>
            ))}
          </View>
        </View>
      </Pressable>
    );
  };
  const unitTitle = (id: string | undefined) => (id === undefined ? '' : (heads.find((u) => u.id === id)?.title ?? id));
  return groupsOf(rows, by).map((group) => {
    const head = weeks
      ? [group.week === undefined ? '' : t('classPlan.weekHead', { week: group.week }), weekDays(group.rows)]
          .concat(unitTitle(group.rows[0]?.item.unit))
          .filter(Boolean)
          .join(' · ')
      : unitTitle(group.key || undefined);
    return (
      <View key={group.key || 'none'} testID={weeks ? `plan-week-${group.key}` : undefined} style={styles.group}>
        {head !== '' && (
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {head}
          </Text>
        )}
        {group.rows.flatMap((one) => {
          const target = pack === undefined ? undefined : targets.find((each) => each.item.id === one.item.id);
          return target === undefined || pack === undefined
            ? [row(one)]
            : [row(one), <TargetRow key={`target-${target.week}`} pack={pack} target={target} />];
        })}
      </View>
    );
  });
}

type Group = { readonly key: string; readonly week?: number; readonly rows: PlanRow[] };

/** The rows by unit, for a week pack by plan week in the plan's order, or in one group. */
function groupsOf(rows: readonly PlanRow[], by: 'unit' | 'week' | 'none'): Group[] {
  if (by === 'none') return [{ key: '', rows: [...rows] }];
  if (by === 'unit') {
    const ids = [...new Set(rows.map((one) => one.item.unit ?? ''))];
    return ids.map((key) => ({ key, rows: rows.filter((one) => (one.item.unit ?? '') === key) }));
  }
  const groups: Group[] = [];
  for (const one of rows) {
    const last = groups.at(-1);
    if (last !== undefined && last.week === one.item.week) last.rows.push(one);
    else
      groups.push({
        key: groups.some((group) => group.week === one.item.week)
          ? `${one.item.week ?? 'none'}-${groups.length}`
          : String(one.item.week ?? `none-${groups.length}`),
        ...(one.item.week !== undefined && { week: one.item.week }),
        rows: [one],
      });
  }
  return groups;
}

/** A plan week's days: from the earliest to the latest day its rows were taught or are projected. */
function weekDays(rows: readonly PlanRow[]): string {
  const days = rows.flatMap((one) => [one.taught?.from, one.taught?.to, one.next ?? undefined]);
  const known = days.filter((one): one is Day => one !== undefined).sort(compareDays);
  const from = known[0];
  const to = known.at(-1);
  if (from === undefined || to === undefined) return '';
  return from === to ? dayMonth(from) : `${dayMonth(from)}–${dayMonth(to)}`;
}

/** A week pack's delay beyond the buffers, in whole plan weeks; null when under one. */
export function weeksBehindLine(t: ReturnType<typeof useText>, paced: Pace | null): string | null {
  const weeks = Math.floor(paced?.weeksBehind ?? 0);
  return weeks > 0 ? t('classPlan.weeksBehind', { weeks: t('count.weeks', { count: weeks }) }) : null;
}

/** Whether the pack paces its items by plan week. */
export function weekPack(pack: PlanPack | null | undefined): boolean {
  return pack?.anchor.kind === 'weeks';
}

/** A week pack's pace lines: the class's plan week and the plan's, the calendar's losses, the weekly model. */
export function PlanWeekLines({ rows, pack, paced }: { rows: readonly PlanRow[]; pack: PlanPack; paced: Pace | null }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const at = rows.find((one) => one.position)?.item.week;
  const expected = rows.find((one) => one.expected)?.item.week ?? at;
  const lost = paced === null ? 0 : paced.lost.holiday + paced.lost.closure;
  const model = (pack.activities ?? []).map((one) => `${localized(one.name)} ${one.sessions}`).join(' · ');
  return (
    <>
      {at !== undefined && (
        <Text testID="plan-week-position" style={[styles.body, align]}>
          {at === expected
            ? t('classPlan.weekPositionSame', { week: at })
            : t('classPlan.weekPosition', { week: at, expected })}
        </Text>
      )}
      {lost > 0 && (
        <Text testID="plan-calendar-lost" style={[styles.note, align]}>
          {t('classPlan.calendarLost', { sessions: t('count.sessions', { count: lost }) })}
        </Text>
      )}
      {model !== '' && (
        <Text testID="plan-week-model" style={[styles.note, align]}>
          {t('classPlan.weekModel', { activities: model })}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-2'] },
  row: {
    flexDirection: 'row',
    gap: spacing['space-12'],
    minHeight: 48,
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-8'],
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.sheet },
  here: { backgroundColor: colors.sheet, borderRadius: radius['radius-control'] },
  grow: { flex: 1, gap: spacing['space-4'] },
  day: { ...typography.caption, color: colors.ink, minWidth: 76 },
  ahead: { color: colors.ink2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-6'] },
  tag: {
    ...typography.caption,
    color: colors.ink2,
    paddingHorizontal: spacing['space-8'],
    borderRadius: radius['radius-tag'],
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tagHere: { color: colors.ink, borderColor: colors.ink },
  label: { ...typography.label, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
