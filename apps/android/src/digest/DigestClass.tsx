// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's card on the Digest screen (#234, Digest, Digest-primary, answer
// 402): its short name and where it stands, as its plan says it, in plan
// weeks for a week pack and with minutes beside when «العدّ بالدقائق» is on;
// this week's sessions lost to the calendar, apart; the item it is on; TD's
// own list before the exams; and «خيارات الاستدراك» while it has used
// buffers or is behind beyond them. Facts only, for the teacher alone.

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
import type { DigestClass as Card, LostGroup } from './digest-rules';

type Translate = ReturnType<typeof useText>;

/** What a lost group was: its calendar entry's name, or the kind of day. */
export function lostWhat(t: Translate, group: LostGroup): string {
  return group.entry !== undefined ? localized(group.entry.name) : t(`today.calendar.${group.cause}`);
}

export type DigestClassProps = {
  readonly context: Context;
  readonly card: Card;
  readonly minutes: boolean;
  readonly onCatchUp: (courseId: string) => void;
};

export function DigestClass({ context, card, minutes, onCatchUp }: DigestClassProps) {
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
        lost: t('daymark.lost', { count }),
        what: isolate(lostWhat(t, group)),
        day: dayName(t, group.day, currentLanguage(), profile),
      }),
    ),
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
