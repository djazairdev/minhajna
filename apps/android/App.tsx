// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A navigation preview (#72), not the teacher's feature screens: the design's
// components come with #20, and the interface language and its catalogue with
// #21. The app lock comes first (#210): a fresh install shows the welcome, then
// the first PIN, then setup or, for a teacher with a copy from another phone,
// the restore (#247), after which the history is read again; afterwards the
// lock asks for the PIN or the phone's prompt. Only then does the encrypted
// history (#19) open, and with Algeria's reference data (#87) it must verify
// before navigation opens. On a refusal, the offline welcome page shows, with
// no record contents; a history whose chain breaks shows, read-only, what still
// checks (#235). It starts from the insets known at launch, so the first frame
// is drawn at once. Once both are open, the screens reach the record book and
// the profile through AppData, and the app opens on Today once setup has been
// finished (#183), or on reader mode's home for a reader who kept a statement
// and never set up teaching (#246). Unused for the lock's delay, the app closes
// the history and shows the lock; the screens come back as they were after it.
// The screen guard follows the screen in front: records stay out of screenshots
// and the recent-apps preview unless the teacher allows them, and PIN pads
// always. Each navigation action raises it before the next screen is drawn.
// Once the lock, the welcome or the history shows, the app tells Android its
// first screen with content is drawn, so a start can be timed on any phone. In
// development every problem in the reference data is logged, for whoever keys
// it; teachers see one short message. The lock, the history, the guard and
// the providers are the shell the dashboard's reader mode shares (answer 856);
// this is the teacher's use of it. Given the cryptography for demo worlds,
// as each platform's start gives it, Help leads to the demo worlds, and on a
// PC the welcome and the lock page too; they take the lock's place until a
// world is left and the lock checks again (#560, #561).

import { useCallback, useMemo, useState } from 'react';
import { PILOT_BUILD } from './src/pilot/pilot-build';
import { PilotTimings, timingStore } from './src/pilot/timing-store';
import { ReopenHistory } from './src/restore/reopen';
import NativeInterface from './src/native/NativeMinhajnaInterface';
import NativeStorage, { type Spec as Storage } from './src/native/NativeMinhajnaStorage';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AFTER_FIRST_PIN, startRoute, type Begin } from './src/navigation/start-route';
import { Welcome } from './src/navigation/Welcome';
import { bundledReference, type ReferenceFiles } from './src/reference';
import { GateDirection, ShellFrame, ShellGate, ShellProviders } from './src/shell/ShellParts';
import { useShell } from './src/shell/use-shell';
import { DemoDoor, HelpDoor } from './src/demo/demo-door';
import { DemoRoot } from './src/demo/DemoRoot';
import { useDemoDoors } from './src/demo/use-demo-doors';
import type { WorldKit } from './src/demo/world-session';

/** Shows the lock, then verifies the bundled reference data and private history before opening the preview. */
export default function App({
  files = bundledReference,
  storage = NativeStorage,
  reportDrawn = () => NativeInterface.reportFullyDrawn(),
  worldKit = null,
}: {
  files?: ReferenceFiles;
  storage?: Storage;
  /** Called once, when the first screen with content is drawn. */
  reportDrawn?: () => void;
  /** The platform's cryptography for demo worlds, which each platform's start gives (#560, #561); none offers none. */
  worldKit?: WorldKit | null;
}) {
  const [next, setNext] = useState<Begin>('setup');
  const shell = useShell({
    files,
    storage,
    reportDrawn,
    startRoute,
    opening: (book, fresh) => (fresh && book.state.setupFinished === false ? AFTER_FIRST_PIN[next] : undefined),
  });
  const { reference, lock, lockAway, opened } = shell;
  const weekStartsOn = reference.ok ? reference.profile.weekStartsOn : null;
  const pilot = useMemo(
    () => (PILOT_BUILD && weekStartsOn !== null ? timingStore(storage, weekStartsOn) : null),
    [storage, weekStartsOn],
  );
  const { lockNow, start } = lock;
  const begin = useCallback(
    (choice: Begin) => {
      setNext(choice);
      start();
    },
    [start],
  );
  const doors = useDemoDoors(worldKit !== null && reference.ok, lockAway, lockNow);
  return (
    <ShellFrame>
      {opened !== null ? (
        <ShellProviders opened={opened} shell={shell} storage={storage}>
          <PilotTimings.Provider value={pilot}>
            <ReopenHistory.Provider value={shell.reopen}>
              <HelpDoor.Provider value={doors.help}>
                <AppNavigator
                  initialRouteName={startRoute(opened.book)}
                  initialState={shell.firstState}
                  onAction={shell.raiseGuard}
                  onStateChange={shell.onStateChange}
                />
              </HelpDoor.Provider>
            </ReopenHistory.Provider>
          </PilotTimings.Provider>
        </ShellProviders>
      ) : (
        <GateDirection>
          {doors.shown && worldKit !== null && reference.ok ? (
            <DemoRoot
              kit={worldKit}
              calendar={reference.calendar}
              profile={reference.profile}
              storage={storage}
              onBack={doors.back}
              onLeft={doors.left}
              reference={reference}
            />
          ) : (
            <DemoDoor.Provider value={doors.gate}>
              <ShellGate
                shell={shell}
                storage={storage}
                welcome={<Welcome onStart={() => begin('setup')} onRestore={() => begin('restore')} />}
                idle={({ referenceRefused, historyRefused }) => (
                  <Welcome referenceRefused={referenceRefused} historyRefused={historyRefused} />
                )}
                onCreateBack={lock.back}
              />
            </DemoDoor.Provider>
          )}
        </GateDirection>
      )}
    </ShellFrame>
  );
}
