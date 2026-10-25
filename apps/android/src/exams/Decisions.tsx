// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher decided for a class's exam windows (#221, answer 268):
// each item left out, each merge and each postponement, in the order made,
// with a button that takes it back, so a decision never stays for good once
// the «تراجع» of the moment has gone. On the catch-up options, the class's
// newest re-pace too (#229, answer 366). Nothing shows without a decision.
// A decision carried to a new release's parts shows once, naming each part
// it now leaves out, and takes back what was recorded (#322).

import {
  type Context,
  courseDecisions,
  courseSetup,
  decisionsFor,
  type ExamDecision,
  findPackItem,
  recordedId,
  type Repace,
  repacesOf,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { currentLanguage, useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { dayName } from '../today/DayMark';
import { termName } from './course-label';

export type DecisionsProps = {
  readonly context: Context;
  readonly courseId: string;
  readonly className: string;
  readonly onTakeBack: (decision: ExamDecision) => void;
  /** Takes back the class's newest re-pace, which then shows in the list (#229). */
  readonly onTakeBackRepace?: (repace: Repace) => void;
};

export function Decisions({ context, courseId, className, onTakeBack, onTakeBackRepace }: DecisionsProps) {
  const t = useText();
  const { direction } = useLocale();
  const language = currentLanguage();
  const comma = language === 'ar' ? '، ' : ', ';
  const carried = decisionsFor(courseDecisions(context, courseId), courseId);
  const decisions = carried.filter((one) => one.id === recordedId(one.id));
  const leftOut = (decision: ExamDecision) =>
    carried.flatMap((one) => (one.kind === 'leave-out' && recordedId(one.id) === decision.id ? [one.item] : []));
  const repace = onTakeBackRepace === undefined ? undefined : repacesOf(context.state, courseId).at(-1);
  if (decisions.length === 0 && repace === undefined) return null;
  const pack = courseSetup(context, courseId).pack;
  const quoted = (id: string) => t('tests.quoted', { title: isolate(findPackItem(pack, id)?.title ?? id) });
  const said = (decision: ExamDecision): string => {
    switch (decision.kind) {
      case 'leave-out':
        return t('examWindow.leftOut', { item: leftOut(decision).map(quoted).join(comma) });
      case 'merge':
        return t('examWindow.merged', { first: quoted(decision.items[0]), second: quoted(decision.items[1]) });
      case 'postpone':
        return t('examWindow.postponedAfter', {
          term: termName(t, decision.term),
          items: decision.items.map(quoted).join(comma),
        });
    }
  };
  const repaced = (one: Repace) =>
    t('repace.decision', {
      on: dayName(t, one.on, language, context.ref.country),
      to: dayName(t, one.to, language, context.ref.country),
    });
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="exam-decisions" style={styles.group}>
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('examWindow.made', { class: className })}
      </Text>
      {decisions.map((decision) => (
        <View key={decision.id} style={styles.row}>
          <Text style={[styles.body, styles.grow, align]}>{said(decision)}</Text>
          <IconButton
            testID={`exam-decision-${decision.id}`}
            icon={controlIcon('cross')}
            accessibilityLabel={t('examWindow.takeBack', { decision: said(decision) })}
            onPress={() => onTakeBack(decision)}
          />
        </View>
      ))}
      {repace !== undefined && onTakeBackRepace !== undefined && (
        <View style={styles.row}>
          <Text style={[styles.body, styles.grow, align]}>{repaced(repace)}</Text>
          <IconButton
            testID={`exam-decision-${repace.id}`}
            icon={controlIcon('cross')}
            accessibilityLabel={t('examWindow.takeBack', { decision: repaced(repace) })}
            onPress={() => onTakeBackRepace(repace)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-6'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    paddingVertical: spacing['space-6'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  grow: { flex: 1 },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
