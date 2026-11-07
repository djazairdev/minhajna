// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes' import (answer 807): the pupils' list from a CSV file
// (pupil-import.ts) in the side panel, its check as the board draws it, then
// applying it to the newest book.

import { useRef } from 'react';
import { useDeviceText } from '../text/device-text';
import { useDeskBook } from './desk-book';
import { ImportPanel } from './ImportPanel';
import { applyPupils, checkPupils, type PupilCheck } from './pupil-import';
import type { SchoolDeskView } from './SchoolDesk';

/** The pupils' import. */
export function PupilImport(props: SchoolDeskView & { readonly onClose: () => void }) {
  const t = useDeviceText();
  const { book, update } = useDeskBook(props);
  const checked = useRef<PupilCheck | null>(null);
  return (
    <ImportPanel
      title={t('dashboard.import.pupilsTitle')}
      whereLabel={t('dashboard.classes.column.class')}
      check={(text) => {
        const read = checkPupils(text, book);
        checked.current = 'missing' in read ? null : read;
        if ('missing' in read)
          return t('dashboard.import.missing', {
            columns: read.missing.map((one) => t(`dashboard.import.pupilColumn.${one}`)).join(t('dashboard.listJoin')),
          });
        const count = (kind: string) => read.lines.filter((one) => one.kind === kind).length;
        return {
          figures: [
            { id: 'new', label: t('dashboard.import.pupilsNew'), value: count('new') },
            { id: 'same', label: t('dashboard.import.same'), value: count('same') },
            { id: 'moved', label: t('dashboard.import.pupilsMoved'), value: count('moved') },
            ...(count('changed') > 0
              ? [{ id: 'changed', label: t('dashboard.import.pupilsChanged'), value: count('changed') }]
              : []),
            { id: 'refused', label: t('dashboard.import.refused'), value: read.refused.length, warn: true },
          ],
          refused: read.refused.map(({ line, why, cell }) => ({
            line,
            where: why === 'class' || why === 'full' ? cell : undefined,
            why: t(`dashboard.import.pupil.${why}`, { cell }),
          })),
          changes: count('new') + count('moved') + count('changed'),
        };
      }}
      onApply={() => {
        const check = checked.current;
        if (check !== null) update((current) => applyPupils(current, check));
      }}
      onClose={props.onClose}
    />
  );
}
