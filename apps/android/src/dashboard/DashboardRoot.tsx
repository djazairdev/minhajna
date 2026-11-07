// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard on a PC (answers 799 and 809), which needs no demo world and
// no passphrase: for now reading a teacher's statement, which is reader mode
// through its notice; the Ministry's reference data and the school's classes
// and pupils follow. It shows in the lock's place, as the demo worlds' entry
// does.

import type { BellData, CountryProfile } from '@minhajna/core';
import { StyleSheet, View } from 'react-native';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { DashboardFrame } from './DashboardFrame';
import { PageTitle } from './page-parts';

export type DashboardRootProps = {
  readonly profile: CountryProfile;
  readonly bells: BellData;
  readonly onBack: () => void;
  /** Leaves for reader mode, through its notice. */
  readonly onReader: () => void;
};

/** The dashboard's rows. */
export function DashboardRoot({ onBack, onReader }: DashboardRootProps) {
  const t = useDeviceText();
  return (
    <DashboardFrame who={t('dashboard.door')} onBack={onBack}>
      <PageTitle>{t('dashboard.door')}</PageTitle>
      <View style={styles.rows}>
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
