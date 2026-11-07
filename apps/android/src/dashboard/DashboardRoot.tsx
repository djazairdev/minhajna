// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard on a PC (answers 799, 805, 807 and 809), which needs no demo
// world and no passphrase: the Ministry's reference data, the school's classes
// and pupils, and reading a teacher's statement, which is reader mode through
// its notice. It shows in the lock's place, as the demo worlds' entry does.

import type { CountryProfile } from '@minhajna/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { DashboardFrame } from './DashboardFrame';
import { PageTitle } from './page-parts';
import { ReferencePage } from './ReferencePage';
import { SchoolPage } from './SchoolPage';

export type DashboardRootProps = {
  readonly profile: CountryProfile;
  readonly onBack: () => void;
  /** Leaves for reader mode, through its notice. */
  readonly onReader: () => void;
};

/** The dashboard's three rows and the pages they open. */
export function DashboardRoot({ profile, onBack, onReader }: DashboardRootProps) {
  const t = useDeviceText();
  const [page, setPage] = useState<'home' | 'reference' | 'school'>('home');
  const home = () => setPage('home');
  if (page === 'reference') return <ReferencePage profile={profile} onBack={home} />;
  if (page === 'school') return <SchoolPage profile={profile} onBack={home} />;
  return (
    <DashboardFrame who={t('dashboard.door')} onBack={onBack}>
      <PageTitle>{t('dashboard.door')}</PageTitle>
      <View style={styles.rows}>
        <RowLink
          testID="dashboard-reference"
          icon={controlIcon('globe')}
          title={t('dashboard.home.reference')}
          onPress={() => setPage('reference')}
        />
        <RowLink
          testID="dashboard-school"
          icon={controlIcon('pupils')}
          title={t('dashboard.home.school')}
          onPress={() => setPage('school')}
        />
        <RowLink
          testID="dashboard-reader"
          icon={controlIcon('school')}
          title={t('dashboard.home.reader')}
          onPress={onReader}
        />
      </View>
    </DashboardFrame>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing['space-8'], maxWidth: 560 },
});
