// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference's desk once the code opened it (answers 805 and 809): for now
// its title alone, under the sidebar that locks the page and goes back; the
// levels, the schools and publishing follow.

import type { CountryProfile } from '@minhajna/core';
import { useDeviceText } from '../text/device-text';
import { DashboardFrame } from './DashboardFrame';
import type { ReferenceState } from './directory-api';
import { PageTitle } from './page-parts';

export type ReferenceDeskProps = {
  readonly profile: CountryProfile;
  readonly code: string;
  readonly start: ReferenceState;
  readonly onLock: () => void;
  readonly onBack: () => void;
};

/** The Ministry's list, as its holder will edit and publish it. */
export function ReferenceDesk({ onLock, onBack }: ReferenceDeskProps) {
  const t = useDeviceText();
  return (
    <DashboardFrame who={t('dashboard.who.ministry')} onLock={onLock} onBack={onBack}>
      <PageTitle>{t('dashboard.home.reference')}</PageTitle>
    </DashboardFrame>
  );
}
