// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One line of the assessment setup (#238, Marks-setup): its name, how its
// marks are gathered, or «عمود مضاف» for the teacher's own, and a stepper
// that stops at its range, said under it. A column has a remove button; a
// preset component has none and can only go down to its minimum (answer 432).

import type { SetupLine } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/IconButton';
import { Stepper } from '../components/Stepper';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { captionOf, lineName } from './marks-rules';

export type SetupRowProps = {
  readonly line: SetupLine;
  readonly rollCall: boolean;
  readonly onPoints: (points: number) => void;
  /** Removes a column; none for a preset component. */
  readonly onRemove?: () => void;
};

export function SetupRow({ line, rollCall, onPoints, onRemove }: SetupRowProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const name = lineName(line);
  return (
    <View testID={`setup-line-${line.id}`} style={styles.row}>
      <View style={styles.grow}>
        <Text style={[styles.title, align]}>{name}</Text>
        <Text style={[styles.note, align]}>{captionOf(t, line, rollCall)}</Text>
        {onRemove !== undefined && (
          <IconButton
            testID={`setup-remove-${line.id}`}
            icon={controlIcon('cross')}
            accessibilityLabel={t('marks.removeColumn', { name: isolate(name) })}
            onPress={onRemove}
          />
        )}
      </View>
      <Stepper
        testID={`setup-points-${line.id}`}
        label={name}
        unit={t('marks.range', { min: line.min, max: line.max })}
        value={line.points}
        min={line.min}
        max={line.max}
        onValueChange={onPoints}
        decreaseLabel={t('marks.fewer', { name: isolate(name) })}
        increaseLabel={t('marks.more', { name: isolate(name) })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-12'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  grow: { flexGrow: 1, flexBasis: 160, gap: spacing['space-4'], alignItems: 'flex-start' },
  title: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
