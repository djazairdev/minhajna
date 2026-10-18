// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A navigation preview (#72), not the teacher's feature screens: the design's
// components come with #20, and the interface language and its catalogue with
// #21. The app lock comes first (#210): a fresh install shows the welcome,
// then the first PIN; afterwards the lock asks for the PIN or the phone's
// prompt. Only then does the encrypted history (#19) open, and with
// Algeria's reference data (#87) it must verify before navigation opens. On
// a refusal, the offline welcome page shows, with no record contents. It
// starts from the insets known at launch, so the first frame is drawn at
// once. Once both are open, the screens reach the record book and the
// profile through AppData, and the app opens on Today once setup has been
// finished (#183). Unused for the lock's delay, the app closes the history
// and shows the lock; the screens come back as they were after it.
// Once the lock, the welcome or the history shows, the app tells Android its
// first screen with content is drawn, so a start can be timed on any phone.
// In development every problem in the reference data is logged, for whoever
// keys it; teachers see one short message.

import type { RecordBook } from '@minhajna/core';
import { LocaleDirContext, type InitialState, type NavigationState } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { I18nManager, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { noteUse } from './src/lock/activity';
import { BiometricAsk } from './src/lock/BiometricAsk';
import { CreatePin } from './src/lock/CreatePin';
import { DEFAULT_LOCK_DELAY } from './src/lock/lock-rules';
import { Unlock } from './src/lock/Unlock';
import { useAutoLock } from './src/lock/useAutoLock';
import { useLockPhase, type LockPhase } from './src/lock/useLockPhase';
import NativeInterface from './src/native/NativeMinhajnaInterface';
import NativeStorage, { type Spec as Storage } from './src/native/NativeMinhajnaStorage';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Welcome } from './src/navigation/Welcome';
import { bundledReference, readReference, type ReferenceFiles } from './src/reference';
import { AppDataProvider } from './src/storage/AppData';
import { nativeDeps, openRecordBook } from './src/storage/history';

/** Shows the lock, then verifies the bundled reference data and private history before opening the preview. */
export default function App({
  files = bundledReference,
  storage = NativeStorage,
  reportDrawn = () => NativeInterface.reportFullyDrawn(),
  lockMinutes = DEFAULT_LOCK_DELAY,
}: {
  files?: ReferenceFiles;
  storage?: Storage;
  /** Called once, when the first screen with content is drawn. */
  reportDrawn?: () => void;
  /** The automatic lock's delay, in minutes. */
  lockMinutes?: number;
}) {
  const reference = useMemo(() => {
    const result = readReference(files);
    if (!result.ok && __DEV__) console.warn('Reference data refused', result.problems);
    if (result.ok && result.refusedPacks > 0 && __DEV__) console.warn('Plan packs refused', result.refusedPacks);
    return result;
  }, [files]);
  const lock = useLockPhase(storage);
  const { phase } = lock;
  const { status: history, book } = useHistory(storage, phase.kind === 'open' ? phase.opening : null);
  const random = useMemo(() => nativeDeps(storage).random, [storage]);
  const navigation = useRef<NavigationState | undefined>(undefined);
  const [restore, setRestore] = useState<InitialState | undefined>(undefined);
  const firstState =
    restore ??
    (phase.kind === 'open' && phase.fresh && book?.state.setupFinished === false ? AFTER_FIRST_PIN : undefined);
  const { lockNow } = lock;
  const lockAway = useCallback(() => {
    setRestore(navigation.current ?? firstState);
    lockNow();
  }, [lockNow, firstState]);
  useAutoLock(book !== null, lockMinutes, lockAway);
  const reported = useRef(false);
  const drawn = phase.kind !== 'checking' && !(phase.kind === 'open' && history === 'opening');
  useEffect(() => {
    if (!drawn || reported.current) return;
    reported.current = true;
    reportDrawn();
  }, [drawn, reportDrawn]);
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar barStyle="light-content" />
      <View
        style={styles.root}
        onStartShouldSetResponderCapture={() => {
          noteUse();
          return false;
        }}
      >
        {phase.kind === 'open' && reference.ok && book !== null ? (
          <AppDataProvider
            book={book}
            profile={reference.profile}
            year={reference.calendar.year}
            calendar={reference.calendar.entries}
            bells={reference.bells}
            packs={reference.packs}
            random={random}
          >
            <AppNavigator
              initialRouteName={book.state.setupFinished ? 'Home' : 'Welcome'}
              initialState={firstState}
              onStateChange={(state) => {
                navigation.current = state;
              }}
            />
          </AppDataProvider>
        ) : (
          <LocaleDirContext.Provider value={I18nManager.isRTL ? 'rtl' : 'ltr'}>
            <Gate
              phase={phase}
              storage={storage}
              lock={lock}
              lockMinutes={lockMinutes}
              referenceRefused={!reference.ok}
              historyRefused={phase.kind === 'refused' || history === 'refused'}
            />
          </LocaleDirContext.Provider>
        )}
      </View>
    </SafeAreaProvider>
  );
}

/**
 * Everything before the record book opens: the welcome, the first PIN, the
 * fingerprint question and the lock, in the interface's direction, as the
 * navigator gives it to the screens inside. Reference data that does not
 * verify leaves the app unusable, so that shows first, with no way forward.
 */
function Gate({
  phase,
  storage,
  lock,
  lockMinutes,
  referenceRefused,
  historyRefused,
}: {
  phase: LockPhase;
  storage: Storage;
  lock: ReturnType<typeof useLockPhase>;
  lockMinutes: number;
  referenceRefused: boolean;
  historyRefused: boolean;
}) {
  if (referenceRefused) return <Welcome referenceRefused historyRefused={historyRefused} />;
  switch (phase.kind) {
    case 'welcome':
      return <Welcome onStart={lock.start} />;
    case 'create':
      return (
        <CreatePin
          storage={storage}
          upgrade={phase.upgrade}
          lockMinutes={lockMinutes}
          onCreated={(pin) => lock.created(pin, phase.upgrade)}
          onRefused={lock.refused}
          onFailed={lock.recheck}
          onBack={phase.upgrade ? undefined : lock.back}
        />
      );
    case 'ask':
      return <BiometricAsk storage={storage} pin={phase.pin} onDone={() => lock.asked(phase.upgrade)} />;
    case 'locked':
      return (
        <Unlock
          storage={storage}
          biometric={phase.biometric}
          waitSeconds={phase.waitSeconds}
          lockMinutes={lockMinutes}
          onOpened={lock.opened}
          onRefused={lock.refused}
        />
      );
    default:
      return <Welcome referenceRefused={referenceRefused} historyRefused={historyRefused} />;
  }
}

type HistoryStatus = 'opening' | 'open' | 'refused';

/**
 * Opens the history each time the lock opens it, and lets it go when the
 * lock closes it, so no record stays in memory behind the lock. A history
 * that does not verify, or whose key is gone, is never opened: the teacher
 * sees one short line, which names no pupil, and nothing from it is used
 * (PRD §5.5).
 */
function useHistory(storage: Storage, opening: number | null): { status: HistoryStatus; book: RecordBook | null } {
  const [history, setHistory] = useState<{ status: HistoryStatus; book: RecordBook | null; opening: number | null }>({
    status: 'opening',
    book: null,
    opening: null,
  });
  useEffect(() => {
    if (opening === null) return;
    let current = true;
    openRecordBook(storage).then(
      (book) => {
        if (current) setHistory({ status: 'open', book, opening });
      },
      (error: unknown) => {
        if (__DEV__) console.warn('History refused', error);
        if (current) setHistory({ status: 'refused', book: null, opening });
      },
    );
    return () => {
      current = false;
      setHistory({ status: 'opening', book: null, opening: null });
    };
  }, [storage, opening]);
  if (opening === null || history.opening !== opening) return { status: 'opening', book: null };
  return history;
}

/** Setup goes on at the privacy notice after the first PIN, with the welcome under it for Back. */
const AFTER_FIRST_PIN: InitialState = { index: 1, routes: [{ name: 'Welcome' }, { name: 'Privacy' }] };

const styles = StyleSheet.create({
  root: { flex: 1 },
});
