// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard app's home (answers 805, 807, 809 and 855), which needs no
// passphrase: the Ministry's reference data, and the school's classes, pupils
// and teachers. Each page goes back to it; the home itself is the app's first
// page, with nothing behind it, and offers the interface's languages, as the
// teacher app's welcome does, since this app keeps its own choice. Reading a
// teacher's statement opens reader mode, under its own passphrase (answer
// 856), which comes back here once its history is locked. A tab that has just
// erased this PC from reader mode says so here first, for as long as the page
// lasts, as the teacher app's welcome does.

import type { BellData, CountryProfile } from '@minhajna/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Notice } from '../../android/src/components/Notice';
import { RowLink } from '../../android/src/components/RowLink';
import { controlIcon } from '../../android/src/design/Icon';
import { spacing } from '../../android/src/design/tokens';
import browser from '../../android/src/native/NativeMinhajnaBrowser';
import { LanguageChoice } from '../../android/src/navigation/LanguageChoice';
import { useDashboardText } from './text';
import { DashboardFrame } from './DashboardFrame';
import { PageTitle } from './page-parts';
import { ReaderApp } from './ReaderApp';
import { ReferencePage } from './ReferencePage';
import { SchoolPage } from './SchoolPage';

export type DashboardRootProps = {
  readonly profile: CountryProfile;
  readonly bells: BellData;
};

/** The dashboard's rows and the pages they open. */
export function DashboardRoot({ profile, bells }: DashboardRootProps) {
  const t = useDashboardText();
  const [page, setPage] = useState<'home' | 'reference' | 'school' | 'reader'>('home');
  const home = () => setPage('home');
  if (page === 'reference') return <ReferencePage profile={profile} onBack={home} />;
  if (page === 'school') return <SchoolPage profile={profile} bells={bells} onBack={home} />;
  if (page === 'reader') return <ReaderApp onLeave={home} />;
  return (
    <DashboardFrame who={t('dashboard.name')}>
      <PageTitle>{t('dashboard.name')}</PageTitle>
      {browser?.erasedHere() === true && (
        <Notice
          testID="dashboard-erased"
          variant="notice"
          badge={t('welcome.erased.badge')}
          title={t('dashboard.reader.erasedTitle')}
          message={t('dashboard.reader.erased')}
        />
      )}
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
          icon={controlIcon('lock')}
          title={t('dashboard.home.reader')}
          onPress={() => setPage('reader')}
        />
      </View>
      <View style={styles.rows}>
        <LanguageChoice />
      </View>
    </DashboardFrame>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing['space-8'], maxWidth: 560 },
});
