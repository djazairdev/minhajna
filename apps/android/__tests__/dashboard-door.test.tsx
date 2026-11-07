// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard's door (answer 809): it shows on a PC's welcome and never on
// the phone; the dashboard says its data is made up and goes back; reading a
// teacher's statement leaves for reader mode, through the welcome's way on a
// fresh PC and, once the lock opens, over the app's first screen for that
// opening alone.

import { Platform } from 'react-native';
import { act, has, press, show, texts as shown, unmount } from '../jest/ministry-page';
import { DashboardRoot } from '../src/dashboard/DashboardRoot';
import { DashboardDoor, useDashboardDoors } from '../src/dashboard/door';
import words from '../src/dashboard/text/ar.json';
import { Welcome } from '../src/navigation/Welcome';
import { bundledReference, readReference } from '../src/reference';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const { profile, bells } = read;

const onBack = jest.fn();
const onReader = jest.fn();
const root = () => show(<DashboardRoot profile={profile} bells={bells} onBack={onBack} onReader={onReader} />);

function Door({ onOpen }: { onOpen: () => void }) {
  const doors = useDashboardDoors(true, { kind: 'welcome' }, null);
  return (
    <DashboardDoor.Provider value={doors.open === null ? null : onOpen}>
      <Welcome onStart={() => undefined} />
    </DashboardDoor.Provider>
  );
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  onBack.mockClear();
  onReader.mockClear();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

describe('the door', () => {
  it('shows on a PC and leads to the dashboard', async () => {
    const open = jest.fn();
    await show(<Door onOpen={open} />);
    await press('welcome-dashboard');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('never shows on the phone', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await show(<Door onOpen={() => undefined} />);
    expect(has('welcome-dashboard')).toBe(false);
  });
});

describe('reader mode from the dashboard', () => {
  type Phase = Parameters<typeof useDashboardDoors>[1];
  const seen: (unknown[] | undefined)[] = [];
  const leaving: ((fromWelcome: (() => void) | null) => void)[] = [];
  const leave = (fromWelcome: (() => void) | null) => leaving.at(-1)?.(fromWelcome);
  const book = { state: { setupFinished: true }, entries: [] };
  function Probe({ phase }: { phase: Phase }) {
    const doors = useDashboardDoors(true, phase, phase.kind === 'open' ? book : null);
    leaving.push(doors.toReader);
    seen.push(doors.readerState?.routes.map((route) => route.name));
    return null;
  }

  it('opens the notice over the app’s first screen once, after the lock', async () => {
    await show(<Probe phase={{ kind: 'locked', biometric: false, waitSeconds: 0 }} />);
    await act(() => leave(null));
    await show(<Probe phase={{ kind: 'open', fresh: false, opening: 1 }} />);
    expect(seen.at(-1)).toEqual(['Home', 'Privacy']);
    await show(<Probe phase={{ kind: 'locked', biometric: false, waitSeconds: 0 }} />);
    await show(<Probe phase={{ kind: 'open', fresh: false, opening: 2 }} />);
    expect(seen.at(-1)).toBeUndefined();
  });

  it('goes the welcome’s way on a fresh PC', async () => {
    const begin = jest.fn();
    await show(<Probe phase={{ kind: 'welcome' }} />);
    await act(() => leave(begin));
    expect(begin).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)).toBeUndefined();
  });
});

describe('the home', () => {
  it('says its data is made up, and goes back', async () => {
    await root();
    expect(shown()).toContain(words.madeUp);
    await press('dashboard-side-back');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('leads to reader mode', async () => {
    await root();
    await press('dashboard-reader');
    expect(onReader).toHaveBeenCalledTimes(1);
  });
});
