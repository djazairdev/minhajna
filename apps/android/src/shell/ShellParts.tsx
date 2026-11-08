// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The shell's pieces on screen (answer 856). The frame starts from the insets
// known at launch, so the first frame is drawn at once, and counts a touch as
// use of the app for the automatic lock. Once the history is open, the
// providers give the screens the record book, the profile and the reference
// data through AppData, the storage module the lock uses, and the step that
// locks at once. Before it opens, the gate shows the first PIN and the lock,
// in the interface's direction, as the navigator gives it to the screens
// inside; a history whose chain breaks shows, read-only, what still checks
// (#235). The caller gives the welcome, and the page that shows while the app
// waits or on a refusal, with no record contents.

import type { CountryProfile } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { I18nManager, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { noteUse } from '../lock/activity';
import { CreatePin } from '../lock/CreatePin';
import { LockAway } from '../lock/lock-away';
import { LockStorage } from '../lock/lock-storage';
import { Unlock } from '../lock/Unlock';
import { LogBroken } from '../log/LogBroken';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { AppDataProvider } from '../storage/AppData';
import type { BrokenHistory } from '../storage/broken-history';
import type { OpenShell, Shell } from './use-shell';

/** The app's outer frame. */
export function ShellFrame({ children }: { readonly children: ReactNode }) {
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
        {children}
      </View>
    </SafeAreaProvider>
  );
}

/** The screens' providers around the caller's navigator, once the history is open. */
export function ShellProviders({
  opened: { book, reference },
  shell,
  storage,
  children,
}: {
  readonly opened: OpenShell;
  readonly shell: Pick<Shell<string>, 'random' | 'lockAway'>;
  readonly storage: Storage;
  readonly children: ReactNode;
}) {
  return (
    <AppDataProvider
      book={book}
      profile={reference.profile}
      year={reference.calendar.year}
      calendar={reference.calendar.entries}
      calendarRelease={reference.calendar.release}
      bells={reference.bells}
      packs={reference.packs}
      keys={reference.keys}
      random={shell.random}
    >
      <LockStorage.Provider value={storage}>
        <LockAway.Provider value={shell.lockAway}>{children}</LockAway.Provider>
      </LockStorage.Provider>
    </AppDataProvider>
  );
}

/** What the gate shows while the app waits, or on a refusal. */
export type Refusals = { readonly referenceRefused: boolean; readonly historyRefused: boolean };

/** The interface's direction for what shows before the navigator, as the navigator gives it inside. */
export function GateDirection({ children }: { readonly children: ReactNode }) {
  return <LocaleDirContext.Provider value={I18nManager.isRTL ? 'rtl' : 'ltr'}>{children}</LocaleDirContext.Provider>;
}

/**
 * Everything before the record book opens: the welcome, the first PIN and the
 * lock. Reference data that does not verify leaves the app unusable, so that
 * shows first, with no way forward.
 */
export function ShellGate({
  shell: { reference, lock, history, lockMinutes },
  storage,
  welcome,
  idle,
  onCreateBack,
}: {
  readonly shell: Pick<Shell<string>, 'reference' | 'lock' | 'history' | 'lockMinutes'>;
  readonly storage: Storage;
  /** The welcome, before the first PIN. */
  readonly welcome: ReactNode;
  /** The page while the app checks the lock or opens the history, or on a refusal. */
  readonly idle: (refusals: Refusals) => ReactNode;
  /** Back from the first PIN; none when a history from before the lock is upgraded. */
  readonly onCreateBack?: () => void;
}) {
  const { phase } = lock;
  const referenceRefused = !reference.ok;
  const historyRefused = phase.kind === 'refused' || history.status === 'refused' || history.status === 'broken';
  const broken: { history: BrokenHistory; profile: CountryProfile } | null =
    reference.ok && history.broken !== null ? { history: history.broken, profile: reference.profile } : null;
  if (referenceRefused) return idle({ referenceRefused: true, historyRefused });
  switch (phase.kind) {
    case 'welcome':
      return welcome;
    case 'create':
      return (
        <CreatePin
          storage={storage}
          upgrade={phase.upgrade}
          lockMinutes={lockMinutes}
          onCreated={() => lock.created(phase.upgrade)}
          onRefused={lock.refused}
          onFailed={lock.recheck}
          onBack={phase.upgrade ? undefined : onCreateBack}
        />
      );
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
      if (broken !== null) return <LogBroken broken={broken.history} profile={broken.profile} />;
      return idle({ referenceRefused, historyRefused });
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
