// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference's schools tab (answers 804, 805 and 809): how many wilayas and
// communes the country has, how many schools the draft lists and how many
// communes have none; the schools filtered by wilaya, commune and cycle, each
// with its code, to edit or hide; adding a school in the side panel, or
// importing a file of them. A long list shows its first rows and says so.

import type { CountryProfile, DirectorySchool, ReferenceDraft } from '@minhajna/core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { COMMUNE_COUNT, communesOf } from './communes';
import { Figure, Figures, Quiet, RowLink } from './page-parts';
import { PickField } from './PickField';
import { placeLabel } from './place-rules';
import { withoutSchool } from './reference-rules';
import { SchoolForm } from './SchoolForm';
import { SchoolImport } from './SchoolImport';
import { Table } from './Table';

/** The most rows the table draws at once. */
export const MOST_ROWS = 200;
const ALL = 'all';

export type SchoolsTabProps = {
  readonly profile: CountryProfile;
  readonly draft: ReferenceDraft;
  readonly onChange: (draft: ReferenceDraft) => void;
  readonly onUpdate: (step: (draft: ReferenceDraft) => ReferenceDraft) => void;
  readonly onAside: (aside: ReactNode) => void;
};

/** The draft's schools. */
export function SchoolsTab({ profile, draft, onChange, onUpdate, onAside }: SchoolsTabProps) {
  const t = useDeviceText();
  const [wilaya, setWilaya] = useState(ALL);
  const [commune, setCommune] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const zones = profile.zones ?? [];
  const levelName = (code: string) => {
    const known = profile.levels.find((one) => one.code === code);
    return known === undefined ? code : localized(known.name);
  };
  const shown = draft.schools
    .filter(
      (school) =>
        (wilaya === ALL || school.wilaya === wilaya) &&
        (commune === ALL || school.commune.code === commune) &&
        (level === ALL || school.level === level),
    )
    .sort((one, other) => one.id.localeCompare(other.id));
  const done = (step: ((current: ReferenceDraft) => ReferenceDraft) | null) => {
    if (step !== null) onUpdate(step);
    onAside(null);
  };
  const form = (editing?: DirectorySchool) =>
    onAside(
      <SchoolForm
        key={editing?.id ?? 'new'}
        profile={profile}
        editing={editing}
        start={{ wilaya: wilaya === ALL ? null : wilaya, commune: commune === ALL ? null : commune }}
        onDone={done}
      />,
    );
  const served = new Set(draft.schools.map((school) => school.commune.code));
  return (
    <View style={styles.tab}>
      <Figures>
        <Figure value={zones.length} label={t('dashboard.schools.wilayas')} />
        <Figure value={COMMUNE_COUNT} label={t('dashboard.schools.communes')} />
        <Figure testID="schools-count" value={draft.schools.length} label={t('dashboard.schools.schools')} />
        <Figure value={COMMUNE_COUNT - served.size} label={t('dashboard.schools.empty')} />
      </Figures>
      <View style={styles.row}>
        <PickField
          testID="schools-wilaya"
          label={t('dashboard.place.wilaya')}
          choices={[
            { value: ALL, label: t('dashboard.schools.allWilayas') },
            ...zones.map((zone) => ({ value: zone.code, label: placeLabel(zone.code, zone.name) })),
          ]}
          value={wilaya}
          onChange={(value) => {
            setWilaya(value);
            setCommune(ALL);
          }}
        />
        <PickField
          testID="schools-commune"
          label={t('dashboard.place.commune')}
          choices={[
            { value: ALL, label: t('dashboard.schools.allCommunes') },
            ...communesOf(wilaya === ALL ? null : wilaya).map((one) => ({
              value: one.code,
              label: placeLabel(one.code, one.name),
            })),
          ]}
          value={commune}
          disabled={wilaya === ALL}
          onChange={setCommune}
        />
        <PickField
          testID="schools-level"
          label={t('dashboard.schools.level')}
          choices={[
            { value: ALL, label: t('dashboard.schools.allLevels') },
            ...profile.levels.map((one) => ({ value: one.code, label: localized(one.name) })),
          ]}
          value={level}
          onChange={setLevel}
        />
        <View style={styles.grow} />
        <Button
          testID="schools-import"
          variant="line"
          icon={controlIcon('tune')}
          label={t('dashboard.importFile')}
          onPress={() =>
            onAside(
              <SchoolImport
                key="import"
                profile={profile}
                draft={draft}
                onApply={onUpdate}
                onClose={() => onAside(null)}
              />,
            )
          }
        />
        <Button
          testID="schools-add"
          variant="line"
          icon={controlIcon('plus')}
          label={t('dashboard.schools.add')}
          onPress={() => form()}
        />
      </View>
      <Table
        testID="schools-table"
        label={t('dashboard.reference.tab.schools')}
        columns={[
          { id: 'code', label: t('dashboard.schools.column.code'), width: 90 },
          { id: 'name', label: t('dashboard.schools.column.name'), grow: 2 },
          { id: 'level', label: t('dashboard.schools.level'), width: 170 },
          { id: 'edit', label: '', width: 100 },
          { id: 'hide', label: '', width: 100 },
        ]}
        rows={shown.slice(0, MOST_ROWS).map((school) => ({
          key: school.id,
          cells: [
            school.id,
            school.name,
            levelName(school.level),
            <RowLink
              key="edit"
              testID={`school-edit-${school.id}`}
              label={t('dashboard.edit')}
              name={`${t('dashboard.edit')}: ${school.name}`}
              onPress={() => form(school)}
            />,
            <RowLink
              key="hide"
              testID={`school-hide-${school.id}`}
              label={t('dashboard.hide')}
              name={`${t('dashboard.hide')}: ${school.name}`}
              onPress={() => onChange(withoutSchool(draft, school.id))}
            />,
          ],
        }))}
      />
      <Quiet testID="schools-shown">
        {t('dashboard.schools.shown', { shown: Math.min(shown.length, MOST_ROWS), total: shown.length })}
      </Quiet>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: spacing['space-12'] },
  row: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: spacing['space-8'] },
  grow: { flex: 1 },
});
