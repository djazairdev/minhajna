// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A navigation preview (#72), not the teacher's feature screens: the design's
// components come with #20, and the interface language and its catalogue with
// #21. Algeria's reference data (#87) and the teacher's encrypted history (#19)
// must both verify before navigation opens. Until then, or on a refusal, the
// offline welcome page shows, with no record contents. It starts from the
// insets known at launch, so the first frame is drawn at once. Once the history
// is open or refused, the app tells Android its first screen with content is
// drawn, so a start can be timed on any phone. In development every problem in
// the reference data is logged, for whoever keys it; teachers see one short
// message.

import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import NativeInterface from './src/native/NativeMinhajnaInterface';
import NativeStorage, { type Spec as Storage } from './src/native/NativeMinhajnaStorage';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Welcome } from './src/navigation/Welcome';
import { bundledReference, readReference, type ReferenceFiles } from './src/reference';
import { openRecordBook } from './src/storage/history';

/** Verifies the bundled reference data and private history before opening the preview. */
export default function App({
  files = bundledReference,
  storage = NativeStorage,
  reportDrawn = () => NativeInterface.reportFullyDrawn(),
}: {
  files?: ReferenceFiles;
  storage?: Storage;
  /** Called once, when the first screen with content is drawn. */
  reportDrawn?: () => void;
}) {
  const reference = useMemo(() => {
    const result = readReference(files);
    if (!result.ok && __DEV__) console.warn('Reference data refused', result.problems);
    return result;
  }, [files]);
  const history = useHistory(storage);
  const reported = useRef(false);
  useEffect(() => {
    if (history === 'opening' || reported.current) return;
    reported.current = true;
    reportDrawn();
  }, [history, reportDrawn]);
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

/**
 * Opens the history once, at start. A history that does not verify, or whose
 * key is gone, is never opened: the teacher sees one short line, which names
 * no pupil, and nothing from it is used (PRD §5.5).
 */
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
