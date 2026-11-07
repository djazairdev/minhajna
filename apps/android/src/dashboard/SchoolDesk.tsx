// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's desk once its code opened it (D-Classes, answers 807 to 809):
// the sidebar names the school and leads to its classes and pupils or to its
// teachers and their joining codes; each change is saved to the book as it is
// made, over the revision read last, and the server's answer brings each new
// teacher's joining code. When someone else saved first, the page says so and
// offers the latest copy.

import type { BellData, CountryProfile, DirectorySchool, ReferenceList, SchoolBook } from '@minhajna/core';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useDeviceText } from '../text/device-text';
import { ClassesView } from './ClassesView';
import { DeskBookContext } from './desk-book';
import { DashboardFrame } from './DashboardFrame';
import { saveBook, schoolBook, type SavedBook } from './directory-api';
import { DirectoryStatus } from './DirectoryStatus';
import { TeachersView } from './TeachersView';
import { useDirectoryCall } from './use-directory-call';
import { useSavedDoc } from './use-saved-doc';

export type SchoolDeskProps = {
  readonly profile: CountryProfile;
  readonly bells: BellData;
  readonly list: ReferenceList;
  readonly school: DirectorySchool;
  readonly code: string;
  readonly start: SavedBook;
  readonly onLock: () => void;
  readonly onBack: () => void;
};

/** What every view of the school's desk is given. */
export interface SchoolDeskView {
  readonly profile: CountryProfile;
  readonly bells: BellData;
  readonly list: ReferenceList;
  readonly school: DirectorySchool;
  readonly code: string;
  readonly book: SchoolBook;
  readonly update: (step: (book: SchoolBook) => SchoolBook) => void;
  readonly adopt: (step: (book: SchoolBook) => SchoolBook) => void;
  readonly onAside: (aside: ReactNode) => void;
}

/** A school's classes, pupils, teachers and week. */
export function SchoolDesk({ profile, bells, list, school, code, start, onLock, onBack }: SchoolDeskProps) {
  const t = useDeviceText();
  const call = useDirectoryCall();
  const { run } = call;
  const [view, setView] = useState<'classes' | 'teachers'>('classes');
  const [aside, setAside] = useState<ReactNode>(null);
  const save = useCallback(
    async (revision: number, book: SchoolBook, options: Parameters<typeof saveBook>[4]) => {
      const saved = await saveBook(school.id, code, revision, book, options);
      return { revision: saved.revision, doc: saved.book };
    },
    [school.id, code],
  );
  const saved = useSavedDoc({ doc: start.book, revision: start.revision }, save, call);
  const reload = async () => {
    const read = await run((options) => schoolBook(school.id, code, options));
    if (read === undefined) return;
    saved.replace(read.book, read.revision);
    setAside(null);
  };
  const show = (next: 'classes' | 'teachers') => {
    setView(next);
    setAside(null);
  };
  const shared: SchoolDeskView = {
    profile,
    bells,
    list,
    school,
    code,
    book: saved.doc,
    update: saved.update,
    adopt: saved.adopt,
    onAside: setAside,
  };
  const desk = useMemo(
    () => ({ book: saved.doc, update: saved.update, adopt: saved.adopt }),
    [saved.doc, saved.update, saved.adopt],
  );
  return (
    <DeskBookContext.Provider value={desk}>
      <DashboardFrame
        who={school.name}
        whoLine={t('dashboard.who.school')}
        items={[
          {
            id: 'classes',
            label: t('dashboard.home.school'),
            icon: 'pupils',
            on: view === 'classes',
            onPress: () => show('classes'),
          },
          {
            id: 'teachers',
            label: t('dashboard.teachers.title'),
            icon: 'qr',
            on: view === 'teachers',
            onPress: () => show('teachers'),
          },
        ]}
        onLock={onLock}
        onBack={onBack}
        aside={aside}
      >
        <DirectoryStatus
          call={call}
          retry={
            call.problem === 'stale'
              ? { label: t('dashboard.reload'), onPress: () => void reload() }
              : saved.unsaved
                ? { label: t('dashboard.tryAgain'), onPress: saved.retry }
                : undefined
          }
        />
        {view === 'classes' ? <ClassesView {...shared} /> : <TeachersView {...shared} />}
      </DashboardFrame>
    </DeskBookContext.Provider>
  );
}
