// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's desk once its code opened it (D-Classes, answers 807 and 809):
// for now its title alone, under the sidebar that names the school, locks the
// page and goes back; the classes, pupils, teachers and week follow.

import type { BellData, CountryProfile, DirectorySchool, ReferenceList } from '@minhajna/core';
import { useDeviceText } from '../text/device-text';
import { DashboardFrame } from './DashboardFrame';
import type { SavedBook } from './directory-api';
import { PageTitle } from './page-parts';

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

/** A school's book, as its holder will edit it. */
export function SchoolDesk({ school, onLock, onBack }: SchoolDeskProps) {
  const t = useDeviceText();
  return (
    <DashboardFrame who={school.name} whoLine={t('dashboard.who.school')} onLock={onLock} onBack={onBack}>
      <PageTitle>{t('dashboard.home.school')}</PageTitle>
    </DashboardFrame>
  );
}
