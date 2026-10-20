// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher decided for a class's exam windows (#221, answer 268):
// each item left out, each merge and each postponement, in the order made,
// with a button that takes it back, so a decision never stays for good once
// the «تراجع» of the moment has gone. Nothing shows without a decision.

import { courseSetup, decisionsFor, findPackItem, type Context, type ExamDecision } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { currentLanguage, useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { termName } from './course-label';

export type DecisionsProps = {
  readonly context: Context;
  readonly courseId: string;
  readonly className: string;
  readonly onTakeBack: (decision: ExamDecision) => void;
};

export function Decisions({ context, courseId, className, onTakeBack }: DecisionsProps) {
  const t = useText();
  const { direction } = useLocale();
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const decisions = decisionsFor(context.state.decisions, courseId);
  if (decisions.length === 0) return null;
  const pack = courseSetup(context, courseId).pack;
  const quoted = (id: string) => t('tests.quoted', { title: isolate(findPackItem(pack, id)?.title ?? id) });
  const said = (decision: ExamDecision): string => {
    switch (decision.kind) {
      case 'leave-out':
        return t('examWindow.leftOut', { item: quoted(decision.item) });
      case 'merge':
        return t('examWindow.merged', { first: quoted(decision.items[0]), second: quoted(decision.items[1]) });
      case 'postpone':
        return t('examWindow.postponedAfter', {
          term: termName(t, decision.term),
          items: decision.items.map(quoted).join(comma),
        });
    }
  };
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
