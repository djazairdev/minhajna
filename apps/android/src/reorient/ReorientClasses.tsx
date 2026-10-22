// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The new classes of a reorientation (#231, Reorient, answer 391): each with
// its name, the old class whose history it takes, and what it would be: its
// pupils and where they come from, then, for each subject, the plan item and
// the TD item it goes on with, and its texts book. A second class taking the
// same history starts with no sessions in the timetable, to draw.

import type { Context, Reorientation } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { SectionHeader } from '../components/SectionHeader';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { frontDate } from '../documents/front-tables';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { removeClasses, type NewClassPreview, type SubjectPreview } from './reorient-rules';

type Props = {
  readonly context: Context;
  readonly plan: Reorientation;
  readonly previews: readonly NewClassPreview[];
  readonly onPlan: (plan: Reorientation) => void;
};

export function ReorientClasses({ context, plan, previews, onPlan }: Props) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { profile } = useAppData();
  const { state } = context;
  const oldName = (id: string) => t('reorient.oldName', { name: isolate(state.classes.get(id)?.name ?? '') });
  const quoted = (title: string) => t('tests.quoted', { title: isolate(title) });
  const change = (index: number, part: Partial<Reorientation['classes'][number]>) =>
    onPlan({ ...plan, classes: plan.classes.map((one, at) => (at === index ? { ...one, ...part } : one)) });
  const subjectLines = (one: SubjectPreview, many: boolean): string[] => {
    const subject = profile.subjects.find((each) => each.code === one.subject);
    const prefix = many ? `${subject === undefined ? one.subject : localized(subject.name)}: ` : '';
    const main =
      one.main === null
        ? t('reorient.positionNone')
        : one.main.covered === 0
          ? t('reorient.position', { title: quoted(one.main.item.title) })
          : t('reorient.positionStage', {
              title: quoted(one.main.item.title),
              stage: one.main.covered + 1,
              stages: one.main.stages,
            });
    return [prefix + main, ...(one.td === null ? [] : [prefix + t('reorient.td', { title: quoted(one.td.title) })])];
  };
  return (
    <View style={styles.list}>
      <SectionHeader testID="reorient-news" label={t('reorient.news')} />
      {plan.classes.map((one, index) => {
        const preview = previews[index];
        if (preview === undefined) return null;
        const from = preview.from
          .map((part) => t('reorient.fromPart', { count: part.pupils, name: oldName(part.schoolClass.id) }))
          .join(t('reorient.and'));
        const lines = [
          preview.from.length === 0 ? t('reorient.fromNone') : t('reorient.from', { list: from }),
          ...preview.subjects.flatMap((subject) => subjectLines(subject, preview.subjects.length > 1)),
          preview.first
            ? t('reorient.book', { name: oldName(one.takes), day: isolate(frontDate(plan.day)) })
            : t('reorient.second'),
        ];
        return (
          <View key={index} testID={`reorient-class-${index}`} style={styles.card}>
            <Text style={[styles.title, align]}>
              {t('reorient.newName', {
                name: isolate(one.name.trim() === '' ? t('reorient.unnamed') : one.name.trim()),
                pupils: t('setup.pupils', { count: preview.pupils }),
              })}
            </Text>
            <TextField
              testID={`reorient-name-${index}`}
              label={t('reorient.name')}
              placeholder={t('reorient.namePlaceholder')}
              value={one.name}
              onChangeText={(name) => change(index, { name })}
            />
            <ChipGroup
              testID={`reorient-takes-${index}`}
              label={t('reorient.takes')}
              selected={one.takes}
              onSelect={(takes) => change(index, { takes })}
              choices={plan.olds.map((id) => ({ value: id, label: oldName(id) }))}
            />
            {lines.map((line) => (
              <Text key={line} style={[styles.body, align]}>
                {line}
              </Text>
            ))}
            {plan.classes.length > 1 && (
              <Button
                testID={`reorient-remove-${index}`}
                variant="plain"
                label={t('reorient.remove')}
                onPress={() => onPlan(removeClasses(plan, [index]))}
              />
            )}
          </View>
        );
      })}
      {plan.olds.length > 0 && (
        <Button
          testID="reorient-add"
          variant="line"
          label={t('reorient.add')}
          onPress={() => onPlan({ ...plan, classes: [...plan.classes, { name: '', takes: plan.olds[0] }] })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing['space-12'] },
  card: {
    gap: spacing['space-10'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
  },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
