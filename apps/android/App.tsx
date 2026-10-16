// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A navigation preview, not the teacher's feature screens. Reference data and
// the encrypted history must both verify before navigation opens. The same
// offline welcome page holds any refusal message, with no record contents.
// Initial window insets let the first frame draw without waiting for layout.

import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import NativeStorage, { type Spec as Storage } from './src/native/NativeMinhajnaStorage';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Welcome } from './src/navigation/Welcome';
import { bundledReference, readReference, type ReferenceFiles } from './src/reference';
import { openRecordBook } from './src/storage/history';

/** Verifies the bundled reference data and private history before opening the preview. */
export default function App({
  files = bundledReference,
  storage = NativeStorage,
}: {
  files?: ReferenceFiles;
  storage?: Storage;
}) {
  const reference = useMemo(() => {
    const result = readReference(files);
    if (!result.ok && __DEV__) console.warn('Reference data refused', result.problems);
    return result;
  }, [files]);
  const history = useHistory(storage);
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar barStyle="light-content" />
      {reference.ok && history === 'open' ? (
        <AppNavigator />
      ) : (
        <Welcome standalone referenceRefused={!reference.ok} historyRefused={history === 'refused'} />
      )}
    </SafeAreaProvider>
  );
}

type HistoryStatus = 'opening' | 'open' | 'refused';

function useHistory(storage: Storage): HistoryStatus {
  const [status, setStatus] = useState<HistoryStatus>('opening');
  useEffect(() => {
    let current = true;
    openRecordBook(storage).then(
      () => {
        if (current) setStatus('open');
      },
      (error: unknown) => {
        if (__DEV__) console.warn('History refused', error);
        if (current) setStatus('refused');
      },
    );
    return () => {
      current = false;
    };
  }, [storage]);
  return status;
}
