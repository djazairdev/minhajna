// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard app (answer 855), apart from the teacher's: its home and
// pages, in the interface's direction, as the teacher app gives it to the
// screens before its navigator. Reference data that does not read leaves the
// app unusable, so that shows alone.

import { LocaleDirContext } from '@react-navigation/native';
import { useMemo } from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../android/src/design/tokens';
import { DashboardRoot } from './DashboardRoot';
import { bundledFiles, readDashboardReference, type DashboardFiles } from './reference';
import { useDashboardText } from './text';

/** The page shown when the reference data does not read. */
function Refused() {
  const t = useDashboardText();
  return (
    <View style={styles.refused}>
      <Text testID="dashboard-refused" accessibilityRole="alert" style={styles.words}>
        {t('dashboard.refused')}
      </Text>
    </View>
  );
}

/** The dashboard, from the bundled reference data or the files given. */
export function DashboardApp({ files = bundledFiles }: { readonly files?: DashboardFiles }) {
  const read = useMemo(() => readDashboardReference(files), [files]);
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <LocaleDirContext.Provider value={I18nManager.isRTL ? 'rtl' : 'ltr'}>
        <View style={styles.root}>
          {read === null ? <Refused /> : <DashboardRoot profile={read.profile} bells={read.bells} />}
        </View>
      </LocaleDirContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  refused: { flex: 1, padding: spacing['space-20'], backgroundColor: colors.paper },
  words: { ...typography.body, color: colors.ink },
});
