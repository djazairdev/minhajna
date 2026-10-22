// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A hybrid plan's weekly targets on the class's plan (#231, Plan-lycee,
// answer 387): the pace card names the last target whose day passed without
// it, and the next one to come, «هدف الأسبوع 6 · نهاية «…»», with whether it
// is reached in time, the main sessions left until its day beside those its
// items still need; and the rows show each target after its item, with its
// day. A target ends the item's unit when it is the unit's last main item.

import { compareDays, queueItems, weekday, type Day, type PlanPack, type WeekTarget } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { dayMonth } from './plan-labels';

type Translate = ReturnType<typeof useText>;

/** «هدف الأسبوع 6» and «نهاية «الأعداد والحساب»»: the unit's title when the item ends its unit, else the item's. */
export function targetWords(t: Translate, pack: PlanPack, target: WeekTarget): { title: string; end: string } {
  const unit = pack.items.find((one) => one.id === target.item.unit);
  const main = queueItems(pack, 'main');
  const ends = unit !== undefined && main.filter((one) => one.unit === unit.id).at(-1)?.id === target.item.id;
  const title = ends ? unit.title : target.item.title;
  return {
    title: t('classPlan.target.title', { week: target.week }),
    end: t('classPlan.target.end', { title: t('tests.quoted', { title: isolate(title) }) }),
  };
}

/** The day a target is due, with its weekday: «الخميس 29/10». */
function dueWords(t: Translate, target: WeekTarget): string {
  return target.due === null ? '' : `${t(`week.days.${weekday(target.due)}`)} ${dayMonth(target.due)}`;
}

/**
 * The pace card's lines: the last target whose day passed without it being reached, and the next one still to come,
 * reached in time or not; nothing for targets reached.
 */
export function TargetLines({ pack, targets, today }: { pack: PlanPack; targets: readonly WeekTarget[]; today: Day }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const open = targets.flatMap((one) => (one.reached || one.due === null ? [] : [{ ...one, due: one.due }]));
  const missed = open.filter((one) => compareDays(one.due, today) < 0).at(-1);
  const next = open.find((one) => compareDays(one.due, today) >= 0);
  const lines = [missed, next].flatMap((target) => {
    if (target === undefined) return [];
    const words = targetWords(t, pack, target);
    const day = dueWords(t, target);
    const needed = Math.ceil(target.needed - 1e-9);
    const sessions = (count: number) => t('count.sessions', { count });
    const count =
      needed === 0
        ? null
        : target.left === 0
          ? t('classPlan.target.countNone', { needed: sessions(needed) })
          : t('classPlan.target.count', { left: sessions(target.left), needed: sessions(needed) });
    const status =
      target === missed
        ? t('classPlan.target.missed', { day })
        : [t(target.left >= needed ? 'classPlan.target.onTime' : 'classPlan.target.late', { day }), count]
            .filter(Boolean)
            .join(' ');
    return [{ week: target.week, head: `${words.title} · ${words.end}`, status }];
  });
  if (lines.length === 0) return null;
  return (
    <View testID="plan-target" style={styles.lines}>
      {lines.map((line) => (
        <View key={line.week} style={styles.lines}>
          <Text style={[styles.label, align]}>{line.head}</Text>
          <Text style={[styles.body, align]}>{line.status}</Text>
        </View>
      ))}
    </View>
  );
}

/** A target's row in the plan, after its item: its day, its title and end, and whether it is reached. */
export function TargetRow({ pack, target }: { pack: PlanPack; target: WeekTarget }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const words = targetWords(t, pack, target);
  const tag = t(target.reached ? 'classPlan.target.reached' : 'classPlan.target.tag');
  return (
    <View
      testID={`plan-target-${target.week}`}
      accessible
      accessibilityLabel={[words.title, words.end, dueWords(t, target), tag].filter(Boolean).join('، ')}
      style={[styles.row, { direction }]}
    >
      <Text style={styles.day}>{target.due === null ? '' : dayMonth(target.due)}</Text>
      <View style={styles.grow}>
        <Text style={[styles.title, align]}>{words.title}</Text>
        <Text style={[styles.note, align]}>{words.end}</Text>
      </View>
      <Text style={styles.tag}>{tag}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: spacing['space-4'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    minHeight: 48,
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-8'],
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
  },
  grow: { flex: 1, gap: spacing['space-2'] },
  day: { ...typography.caption, color: colors.ink, minWidth: 76 },
  label: { ...typography.label, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  tag: {
    ...typography.caption,
    color: colors.ink,
    paddingHorizontal: spacing['space-8'],
    borderRadius: radius['radius-tag'],
    borderWidth: 1,
    borderColor: colors.ink,
  },
});
