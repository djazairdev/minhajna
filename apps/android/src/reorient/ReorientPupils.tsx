// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the old classes' pupils go (#231, Reorient, answer 391): for each
// old class, how many go to each new class or to a class the teacher does not
// teach, by default the first new class that takes their old class's
// history; «تعديل» lists its pupils, each with where they go. An old class
// no new class takes says its plan and book stay with it, archived.

import type { Reorientation } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { SectionHeader } from '../components/SectionHeader';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { pupilMoves } from './reorient-rules';

type Props = {
  readonly plan: Reorientation;
  readonly moves: ReturnType<typeof pupilMoves>;
  readonly onPlan: (plan: Reorientation) => void;
};

export function ReorientPupils({ plan, moves, onPlan }: Props) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [open, setOpen] = useState<readonly string[]>([]);
  const newName = (index: number) => {
    const name = plan.classes[index]?.name.trim() ?? '';
    return isolate(name === '' ? t('reorient.unnamed') : name);
  };
  const choices = [
    ...plan.classes.map((_, index) => ({ value: String(index), label: newName(index) })),
    { value: 'none', label: t('reorient.none') },
  ];
  const move = (pupilId: string, value: string) =>
    onPlan({ ...plan, pupils: new Map([...plan.pupils, [pupilId, value === 'none' ? null : Number(value)]]) });
  return (
    <View style={styles.list}>
      <SectionHeader testID="reorient-pupils" label={t('reorient.pupils')} />
      {moves.map(({ schoolClass, pupils, counts }) => {
        const shown = open.includes(schoolClass.id);
        const summary = [...counts]
          .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
          .map(([to, count]) =>
            to === null ? t('reorient.toNone', { count }) : t('reorient.to', { count, name: newName(to) }),
          )
          .join(' · ');
        return (
          <View key={schoolClass.id} testID={`reorient-old-${schoolClass.id}`} style={styles.list}>
            <Text style={[styles.title, align]}>
              {t('reorient.oldPupils', {
                name: t('reorient.oldName', { name: isolate(schoolClass.name) }),
                pupils: t('setup.pupils', { count: pupils.length }),
              })}
            </Text>
            {summary !== '' && <Text style={[styles.body, align]}>{summary}</Text>}
            {!plan.classes.some((one) => one.takes === schoolClass.id) && (
              <Text testID={`reorient-untaken-${schoolClass.id}`} style={[styles.body, align]}>
                {t('reorient.untaken')}
              </Text>
            )}
            {pupils.length > 0 && (
              <Button
                testID={`reorient-edit-${schoolClass.id}`}
                variant="plain"
                label={t(shown ? 'reorient.hide' : 'reorient.edit')}
                onPress={() => setOpen(shown ? open.filter((id) => id !== schoolClass.id) : [...open, schoolClass.id])}
              />
            )}
            {shown &&
              pupils.map(({ pupil, to }) => (
                <ChipGroup
                  key={pupil.id}
                  testID={`reorient-pupil-${pupil.id}`}
                  label={pupil.name}
                  selected={to === null ? 'none' : String(to)}
                  onSelect={(value) => move(pupil.id, value)}
                  choices={choices}
                />
              ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing['space-10'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
