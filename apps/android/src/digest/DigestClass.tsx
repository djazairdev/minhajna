// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's card on the Digest screen (#234, Digest, Digest-primary,
// answers 402, 409 and 410): its short name and where it stands, as on the
// Classes tab, in whole plan weeks for a week pack behind beyond its
// buffers; this week's sessions lost to the calendar, apart; a week pack's
// plan week beside the plan's; the item it is on; TD's own list before the
// exams; «المخطط», which opens its plan; and «خيارات الاستدراك» while it is
// behind. With «العدّ بالدقائق» on, minutes go beside the sessions and the
// losses. Facts only, for the teacher alone.

import { courseSetup, type Context } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { paceLine } from '../classes/class-rules';
import { weeksBehindLine } from '../classes/PlanRows';
import { colors, radius, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { tdLine } from '../plan/catch-up-rules';
import { localized } from '../setup/names';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { lostMinutes, type DigestClass as Card, type LostGroup } from './digest-rules';

type Translate = ReturnType<typeof useText>;

/** A count of sessions with its usual minutes beside, when the teacher counts in minutes. */
export function withMinutes(t: Translate, sessions: string, minutes: number | undefined): string {
  return minutes === undefined
    ? sessions
    : t('settings.withMinutes', { sessions, minutes: t('settings.minutes', { count: minutes }) });
}

/** What a lost group was: its calendar entry's name, or the kind of day. */
export function lostWhat(t: Translate, group: LostGroup): string {
  return group.entry !== undefined ? localized(group.entry.name) : t(`today.calendar.${group.cause}`);
}

export type DigestClassProps = {
  readonly context: Context;
  readonly card: Card;
  readonly minutes: boolean;
  readonly onCatchUp: (courseId: string) => void;
  readonly onPlan: (courseId: string) => void;
};

export function DigestClass({ context, card, minutes, onCatchUp, onPlan }: DigestClassProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { row } = card;
  const id = row.course.id;
  const profile = context.ref.country;
  const length = minutes && row.pace !== null ? courseSetup(context, id).sessionMinutes : undefined;
  const status = weeksBehindLine(t, row.pace) ?? paceLine(t, row, length);
  const lines = [
    ...card.lost.map(({ group, count }) =>
      t('digest.classLost', {
        lost: withMinutes(
          t,
          t('daymark.lost', { count }),
          minutes ? lostMinutes(context, new Map([[id, count]])) : undefined,
        ),
        what: isolate(lostWhat(t, group)),
        day: dayName(t, group.day, currentLanguage(), profile),
      }),
    ),
    ...(card.week === undefined
      ? []
      : [
          card.week.at === card.week.expected
            ? t('digest.planWeekSame', { week: card.week.at })
            : t('digest.planWeek', { week: card.week.at, expected: card.week.expected }),
        ]),
    ...(card.at === undefined
      ? []
      : [
          t('digest.position', {
            item: card.at === null ? t('classPlan.driftEnd') : isolate(card.at.title),
          }),
        ]),
    ...(card.td === null ? [] : [tdLine(t, card.td)]),
  ];
  return (
    <View testID={`digest-class-${id}`} style={[styles.card, card.behind && styles.focus]}>
      <View accessible style={styles.text}>
        <Text style={[styles.name, align]}>{courseLabel(t, context.state, profile, id)}</Text>
        <Text style={[styles.status, align]}>{status}</Text>
        {lines.map((line) => (
          <Text key={line} style={[styles.line, align]}>
            {line}
          </Text>
        ))}
      </View>
      <Button testID={`digest-plan-${id}`} variant="plain" label={t('classPlan.open')} onPress={() => onPlan(id)} />
      {card.behind && (
        <Button
          testID={`digest-catchup-${id}`}
          variant="line"
          label={t('catchUp.open')}
          onPress={() => onCatchUp(id)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-10'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  focus: { borderColor: colors.ink2 },
  text: { gap: spacing['space-4'] },
  name: { ...typography.label, color: colors.ink },
  status: { ...typography.body, color: colors.ink },
  line: { ...typography.small, color: colors.ink2 },
});
