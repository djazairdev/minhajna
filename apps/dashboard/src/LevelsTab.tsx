// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference's first tab (answers 803 and 804): a level's options, as a
// teacher picks one in setup, with their kinds; adding a subject, or, outside
// the primary, two subjects as one option, and editing or hiding one in the
// side panel. The primary's class teacher stays, as setup offers it first.

import type { CountryProfile, DirectoryLevel, DirectoryOption, ReferenceDraft } from '@minhajna/core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge } from '../../android/src/components/Badge';
import { Button } from '../../android/src/components/Button';
import { controlIcon } from '../../android/src/design/Icon';
import { spacing } from '../../android/src/design/tokens';
import { localized } from '../../android/src/setup/names';
import { useDashboardText } from './text';
import { OptionForm } from './OptionForm';
import { Chips, RowLink } from './page-parts';
import { optionKind, optionName, withoutOption } from './reference-rules';
import { Table } from './Table';

export type LevelsTabProps = {
  readonly profile: CountryProfile;
  readonly draft: ReferenceDraft;
  /** The published list's levels, or none while nothing is published. */
  readonly published: readonly DirectoryLevel[];
  readonly onChange: (draft: ReferenceDraft) => void;
  readonly onUpdate: (step: (draft: ReferenceDraft) => ReferenceDraft) => void;
  readonly onAside: (aside: ReactNode) => void;
};

/** One level's options at a time. */
export function LevelsTab({ profile, draft, published, onChange, onUpdate, onAside }: LevelsTabProps) {
  const t = useDashboardText();
  const [chosen, setChosen] = useState(draft.levels[0]?.code ?? '');
  const level = draft.levels.find((one) => one.code === chosen) ?? draft.levels[0];
  if (level === undefined) return null;
  const primary = level.options.some((option) => option.classTeacher === true);
  const form = (pair: boolean, editing?: DirectoryOption) =>
    onAside(
      <OptionForm
        key={`${level.code}/${editing?.code ?? (pair ? 'pair' : 'one')}`}
        profile={profile}
        level={level}
        pair={pair}
        editing={editing}
        published={published.find((one) => one.code === level.code)}
        onDone={(step) => {
          if (step !== null) onUpdate(step);
          onAside(null);
        }}
      />,
    );
  return (
    <View style={styles.tab}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Chips
            testID="levels-level"
            label={t('dashboard.levels.level')}
            choices={draft.levels.map((one) => {
              const named = profile.levels.find((known) => known.code === one.code);
              return { value: one.code, label: named === undefined ? one.code : localized(named.name) };
            })}
            value={level.code}
            onChange={(value) => {
              setChosen(value);
              onAside(null);
            }}
          />
        </View>
        <Button
          testID="levels-add"
          variant="line"
          icon={controlIcon('plus')}
          label={t('dashboard.levels.add')}
          onPress={() => form(false)}
        />
        {!primary && (
          <Button
            testID="levels-add-pair"
            variant="line"
            icon={controlIcon('plus')}
            label={t('dashboard.levels.addPair')}
            onPress={() => form(true)}
          />
        )}
      </View>
      <Table
        testID="levels-table"
        label={t('dashboard.reference.tab.levels')}
        columns={[
          { id: 'option', label: t('dashboard.levels.column.option'), grow: 2 },
          { id: 'kind', label: t('dashboard.levels.column.kind'), width: 150 },
          { id: 'edit', label: t('dashboard.edit'), width: 110, quiet: true },
          { id: 'hide', label: t('dashboard.hide'), width: 110, quiet: true },
        ]}
        rows={level.options.map((option) => {
          const name = optionName(t, profile, option);
          const fixed = option.classTeacher === true;
          return {
            key: option.code,
            cells: [
              name,
              <Badge key="kind" label={t(`dashboard.levels.kind.${optionKind(profile, level.code, option)}`)} />,
              fixed ? null : (
                <RowLink
                  key="edit"
                  testID={`option-edit-${option.code}`}
                  label={t('dashboard.edit')}
                  name={`${t('dashboard.edit')}: ${name}`}
                  onPress={() => form(option.subjects.length > 1, option)}
                />
              ),
              fixed ? null : (
                <RowLink
                  key="hide"
                  testID={`option-hide-${option.code}`}
                  label={t('dashboard.hide')}
                  name={`${t('dashboard.hide')}: ${name}`}
                  onPress={() => onChange(withoutOption(draft, level.code, option.code))}
                />
              ),
            ],
          };
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: spacing['space-12'] },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing['space-8'] },
  grow: { flex: 1, minWidth: 200 },
});
