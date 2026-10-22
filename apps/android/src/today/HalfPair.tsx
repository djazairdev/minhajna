// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's half-group pair (#231, L-Today, R-4.7-15, answer 387): a main-plan
// session of one of a class's half-groups shows each half's turn at its item,
// its own first, framed: the day and week letter of the other half's session
// for the same item, still awaiting confirmation when it came first, the whole
// class's session that takes it first, or that it has had it; then that the
// item is done for the class once every half has had it. Each half is named by
// its number among the class's halves, as the focus card's tap names it:
// «تمّت للفوج 1». The day's pairs are worked out once, walking each course
// once.

import { compareDays, halfPairs, type Context, type Day, type HalfTurn, type TodaySession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { currentLanguage, useText, type Language } from '../text/i18n';
import { dayName } from './DayMark';

type Translate = ReturnType<typeof useText>;

export type HalfPairData = {
  /** The session's half, by its place among the class's halves, from 1. */
  readonly number: number;
  readonly turns: readonly { readonly name: string; readonly line: string; readonly own: boolean }[];
  /** True with more than two halves. */
  readonly many: boolean;
};

/** The pairs of the day's sessions awaiting confirmation, by session key, worked out once for the day. */
export function useHalfPairs(context: Context, items: readonly TodaySession[], day: Day): Map<string, HalfPairData> {
  const t = useText();
  const language = currentLanguage();
  return useMemo(() => {
    const awaiting = items.flatMap((item) =>
      item.status === 'awaiting' && item.proposal !== null
        ? [{ item, session: item.session, itemId: item.proposal.item.id }]
        : [],
    );
    const turns = halfPairs(context, awaiting);
    const pairs = new Map<string, HalfPairData>();
    for (const { item, session } of awaiting) {
      const pair = turns.get(session.key);
      if (pair !== undefined) pairs.set(session.key, pairData(t, context, item, pair, day, language));
    }
    return pairs;
  }, [t, context, items, day, language]);
}

/** Each half by its number among the class's halves, as the card's tap names it. */
function pairData(
  t: Translate,
  context: Context,
  item: TodaySession,
  turns: readonly HalfTurn[],
  day: Day,
  language: Language,
): HalfPairData {
  const halves = context.state.classes.get(item.course.classId)?.groups.filter((group) => group.kind === 'half') ?? [];
  const comma = language === 'ar' ? '، ' : ', ';
  const number = (groupId: string) => halves.findIndex((group) => group.id === groupId) + 1;
  return {
    number: number(item.session.groupId),
    many: turns.length > 2,
    turns: turns.map((turn, index) => {
      const past = turn.day !== null && compareDays(turn.day, day) < 0;
      const when =
        turn.day === null
          ? null
          : compareDays(turn.day, day) === 0
            ? t('today.half.today')
            : dayName(t, turn.day, language, context.ref.country);
      const parts = turn.done
        ? [t('today.half.done')]
        : when === null
          ? [t('today.half.none')]
          : [
              ...(turn.withClass ? [t('today.half.withClass')] : []),
              when,
              ...(turn.letter === null ? [] : [t(`week.week${turn.letter}`)]),
              ...(past ? [t('today.half.awaiting')] : []),
            ];
      return { name: t('week.halfName', { n: number(turn.groupId) }), line: parts.join(comma), own: index === 0 };
    }),
  };
}

export function HalfPair({ data, testID }: { data: HalfPairData; testID?: string }) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID={testID} style={styles.group}>
      <View style={[styles.row, { direction }]}>
        {data.turns.map((turn, index) => (
          <View
            key={index}
            testID={testID === undefined ? undefined : `${testID}-${index}`}
            accessible
            accessibilityLabel={t(turn.own ? 'today.half.labelOwn' : 'today.half.label', {
              group: turn.name,
              turn: turn.line,
            })}
            style={[styles.box, turn.own ? styles.own : styles.other]}
          >
            <Text style={[styles.name, align]}>{turn.name}</Text>
            <Text style={[styles.line, align]}>{turn.line}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.note, align]}>{t(data.many ? 'today.half.noteMany' : 'today.half.note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'], marginTop: spacing['space-6'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  box: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 48,
    gap: spacing['space-2'],
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-10'],
    borderRadius: radius['radius-control'],
  },
  own: { borderWidth: 1.5, borderColor: colors.ink },
  other: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line },
  name: { ...typography.label, color: colors.ink },
  line: { ...typography.caption, color: colors.ink2 },
  note: { ...typography.caption, color: colors.ink2 },
});
