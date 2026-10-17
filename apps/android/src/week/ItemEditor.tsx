// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One item of a slot on Week-slot (#28): a class session, with its class,
// subject, group, weeks and room, or the teacher's own time, with its kind,
// whether it takes the whole half-day, and its weeks. The second item of an
// A/B slot keeps the other week and may be nothing. Half-groups a class does
// not have yet are offered as «الفوج 1» and «الفوج 2», and made on saving.
// The choices use chips until SegmentedControl (#136) exists.

import { BLOCK_KINDS, wholeGroup, type SchoolClass, type Weeks } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { CheckRow } from '../components/CheckRow';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from './grid-labels';
import type { OwnItem, SessionItem, SlotItem } from './slot-rules';

/** The group choices of a class: its whole group, then two half-groups, real or still to make. */
export function groupChoices(schoolClass: SchoolClass) {
  const halves = schoolClass.groups.filter((group) => group.kind === 'half').slice(0, 2);
  return [
    { id: wholeGroup(schoolClass).id, half: null },
    ...[1, 2].map((n) => ({ id: halves[n - 1]?.id ?? `half-${n}`, half: n })),
  ];
}

export type ItemEditorProps = {
  readonly testID: string;
  readonly item: SlotItem | null;
  readonly onChange: (item: SlotItem | null) => void;
  readonly classes: readonly SchoolClass[];
  /** Set for the second item of an A/B slot. */
  readonly week?: 'A' | 'B';
};

/** The fields of one item. */
export function ItemEditor({ testID, item, onChange, classes, week }: ItemEditorProps) {
  const t = useText();
  const { direction } = useLocale();
  const { profile, state } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const weeks: Weeks = week ?? item?.weeks ?? 'every';
  const subjectsOf = (schoolClass: SchoolClass) => state.schools.get(schoolClass.schoolId)?.subjects ?? [];
  const session = (schoolClass: SchoolClass | undefined): SessionItem | null =>
    schoolClass === undefined
      ? null
      : {
          kind: 'class',
          classId: schoolClass.id,
          subject: subjectsOf(schoolClass)[0] ?? '',
          groupId: wholeGroup(schoolClass).id,
          weeks,
          sessionType: 'lesson',
        };
  const own: OwnItem = { kind: 'own', halfDay: false, weeks, label: t('week.ownTime') };
  const kinds = [
    { value: 'class' as const, label: t('week.session') },
    { value: 'own' as const, label: t('week.ownTime') },
    ...(week !== undefined ? [{ value: 'nothing' as const, label: t('week.nothing') }] : []),
  ];
  const weekChips = (
    <ChipGroup
      testID={`${testID}-weeks`}
      label={t('week.weeks')}
      choices={[
        { value: 'every' as const, label: t('week.everyWeek') },
        { value: 'A' as const, label: t('week.weekA') },
        { value: 'B' as const, label: t('week.weekB') },
      ]}
      selected={weeks}
      onSelect={(chosen) => item && onChange({ ...item, weeks: chosen })}
    />
  );
  const schoolClass = item?.kind === 'class' ? classes.find((candidate) => candidate.id === item.classId) : undefined;
  return (
    <View style={styles.group}>
      <ChipGroup
        testID={`${testID}-kind`}
        label={
          week !== undefined
            ? t('week.otherWeek', { week: t(week === 'A' ? 'week.weekA' : 'week.weekB') })
            : t('week.holds')
        }
        choices={kinds}
        selected={item?.kind ?? (week !== undefined ? 'nothing' : null)}
        onSelect={(kind) =>
          onChange(kind === 'class' ? session(schoolClass ?? classes[0]) : kind === 'own' ? own : null)
        }
      />
      {item?.kind === 'class' && schoolClass !== undefined && (
        <>
          <ChipGroup
            testID={`${testID}-class`}
            label={t('week.class')}
            choices={classes.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            selected={item.classId}
            onSelect={(id) => onChange(session(classes.find((candidate) => candidate.id === id)))}
          />
          {subjectsOf(schoolClass).length > 1 && (
            <ChipGroup
              testID={`${testID}-subject`}
              label={t('week.subject')}
              hint={t('week.bivalentNote')}
              choices={subjectsOf(schoolClass).map((code) => {
                const subject = profile.subjects.find((candidate) => candidate.code === code);
                return { value: code, label: subject ? localized(subject.name) : code };
              })}
              selected={item.subject}
              onSelect={(subject) => onChange({ ...item, subject })}
            />
          )}
          <ChipGroup
            testID={`${testID}-group`}
            label={t('week.group')}
            choices={groupChoices(schoolClass).map((choice) => ({
              value: choice.id,
              label: choice.half === null ? t('week.wholeClass') : t('week.halfName', { n: choice.half }),
            }))}
            selected={item.groupId}
            onSelect={(groupId) => onChange({ ...item, groupId })}
          />
          {week === undefined && weekChips}
          <Text style={[styles.summary, align]}>{summary(t, schoolClass, item)}</Text>
          <TextField
            testID={`${testID}-room`}
            label={t('week.room')}
            optionalLabel={t('setup.optional')}
            placeholder={t('week.roomPlaceholder')}
            value={item.room ?? ''}
            onChangeText={(room) => onChange({ ...item, room })}
          />
        </>
      )}
      {item?.kind === 'own' && (
        <>
          <ChipGroup
            testID={`${testID}-own`}
            label={t('week.ownKind')}
            choices={BLOCK_KINDS.map((kind) => ({ value: kind, label: t(`week.kinds.${kind}`) }))}
            selected={item.ownKind ?? null}
            onSelect={(ownKind) => onChange({ ...item, ownKind, label: t(`week.kinds.${ownKind}`) })}
          />
          <CheckRow
            testID={`${testID}-half-day`}
            label={t('week.halfDay')}
            checked={item.halfDay}
            onCheckedChange={(halfDay) => onChange({ ...item, halfDay })}
          />
          {week === undefined && weekChips}
        </>
      )}
    </View>
  );
}

/** «4م1 كله، كل أسبوع.», or with the half-group. */
function summary(t: ReturnType<typeof useText>, schoolClass: SchoolClass, item: SessionItem) {
  const weeks = t(item.weeks === 'every' ? 'week.everyWeek' : item.weeks === 'A' ? 'week.weekA' : 'week.weekB');
  const half = groupChoices(schoolClass).find((choice) => choice.id === item.groupId)?.half ?? null;
  return half === null
    ? t('week.wholeSummary', { name: isolate(schoolClass.name), weeks })
    : t('week.halfSummary', { name: isolate(schoolClass.name), group: t('week.halfName', { n: half }), weeks });
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-12'] },
  summary: { ...typography.body, color: colors.ink },
});
