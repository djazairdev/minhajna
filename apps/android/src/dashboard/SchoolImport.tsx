// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Importing schools into the Ministry's draft (school-import.ts) in the side
// panel, checked against the newest draft as the file is read: the check's
// figures and refused lines, then applying it to the newest draft.

import type { CountryProfile, DirectorySchool, ReferenceDraft } from '@minhajna/core';
import { useRef } from 'react';
import { useDeviceText } from '../text/device-text';
import { ImportPanel } from './ImportPanel';
import { applySchools, checkSchools, type SchoolCheck } from './school-import';

export type SchoolImportProps = {
  readonly profile: CountryProfile;
  /** The newest draft, read as the file is checked. */
  readonly read: () => ReferenceDraft;
  readonly published: readonly DirectorySchool[];
  readonly onApply: (step: (draft: ReferenceDraft) => ReferenceDraft) => void;
  readonly onClose: () => void;
};

/** The schools' import. */
export function SchoolImport({ profile, read: latest, published, onApply, onClose }: SchoolImportProps) {
  const t = useDeviceText();
  const checked = useRef<SchoolCheck | null>(null);
  return (
    <ImportPanel
      title={t('dashboard.import.schoolsTitle')}
      check={(text) => {
        const read = checkSchools(text, latest(), profile);
        if ('missing' in read) {
          checked.current = null;
          return t('dashboard.import.missing', {
            columns: read.missing.map((one) => t(`dashboard.import.column.${one}`)).join(t('dashboard.listJoin')),
          });
        }
        checked.current = read;
        const count = (kind: string) => read.lines.filter((one) => one.kind === kind).length;
        return {
          figures: [
            { id: 'new', label: t('dashboard.import.schoolsNew'), value: count('new') },
            { id: 'same', label: t('dashboard.import.same'), value: count('same') },
            { id: 'changed', label: t('dashboard.import.schoolsChanged'), value: count('changed') },
            { id: 'refused', label: t('dashboard.import.refused'), value: read.refused.length, warn: true },
          ],
          refused: read.refused.map(({ line, why, cell }) => ({
            line,
            why: t(`dashboard.import.school.${why}`, { cell }),
          })),
          changes: count('new') + count('changed'),
        };
      }}
      onApply={() => {
        const check = checked.current;
        if (check !== null) onApply((current) => applySchools(current, check, published));
      }}
      onClose={onClose}
    />
  );
}
