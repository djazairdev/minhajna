// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a teacher's statement, reader mode, in the dashboard (answers 489
// to 492, 799 and 856): the teacher app's shell, with this origin's own
// lock and encrypted history in the browser, under a passphrase of its own,
// and Algeria's verified reference data and plan packs, as the reader's
// screens read them. First use on this browser asks for the passphrase, with
// no welcome, then shows the privacy notice in reader mode, which leads to
// the reader's home; the notice shows at each opening until a first statement
// is kept, and the home afterwards. Leaving, from the passphrase pages or the
// reader's home, locks the history and goes back to the dashboard's home; a
// lock the storage module refuses stays here, and locks through the shell,
// which shows the refusal if it fails again.

import { receivedStatements, type RecordBook } from '@minhajna/core';
import type { InitialState } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import NativeStorage, { type Spec as Storage } from '../../android/src/native/NativeMinhajnaStorage';
import { bundledReference, type ReferenceFiles } from '../../android/src/reference';
import { GateDirection, ShellFrame, ShellGate, ShellProviders } from '../../android/src/shell/ShellParts';
import { useShell } from '../../android/src/shell/use-shell';
import { ReaderLeave } from './reader-leave';
import { ReaderNavigator } from './ReaderNavigator';
import { ReaderStrip, ReaderWaiting } from './ReaderStrip';

/** The notice in reader mode, alone in the stack. */
export const FIRST_USE: InitialState = { index: 0, routes: [{ name: 'Privacy', params: { reader: true } }] };

const startRoute = () => 'ReaderHome' as const;

/** The notice until a first statement is kept, then the reader's home. */
const opening = (book: RecordBook) => (receivedStatements(book.entries).length > 0 ? undefined : FIRST_USE);

export type ReaderAppProps = {
  /** Back to the dashboard's home, once the history is locked. */
  readonly onLeave: () => void;
  readonly files?: ReferenceFiles;
  readonly storage?: Storage;
};

/** Reader mode, from its passphrase to its screens. */
export function ReaderApp({ onLeave, files = bundledReference, storage = NativeStorage }: ReaderAppProps) {
  const shell = useShell({ files, storage, startRoute, opening });
  const { phase, start, lockNow } = shell.lock;
  useEffect(() => {
    if (phase.kind === 'welcome') start();
  }, [phase.kind, start]);
  const leaving = useRef(false);
  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    storage.lockHistory().then(onLeave, () => {
      leaving.current = false;
      lockNow();
    });
  }, [storage, onLeave, lockNow]);
  return (
    <ShellFrame>
      <ReaderLeave.Provider value={leave}>
        {shell.opened !== null ? (
          <ShellProviders opened={shell.opened} shell={shell} storage={storage}>
            <ReaderNavigator
              initialState={shell.firstState}
              onAction={shell.raiseGuard}
              onStateChange={shell.onStateChange}
            />
          </ShellProviders>
        ) : (
          <GateDirection>
            <View style={styles.gate}>
              <ReaderStrip onLeave={leave} />
              <View style={styles.page}>
                <ShellGate
                  shell={shell}
                  storage={storage}
                  welcome={null}
                  idle={(refusals) => <ReaderWaiting {...refusals} />}
                />
              </View>
            </View>
          </GateDirection>
        )}
      </ReaderLeave.Provider>
    </ShellFrame>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1 },
  page: { flex: 1 },
});
