// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which screens the screen guard leaves open to screenshots and the
// recent-apps preview (R-6.4-07, #210). It fails closed: every screen of the
// record book is guarded, unless the teacher allowed screenshots, and only
// the screens named here, which hold no records, are not. A new screen is
// guarded until it is added. The PIN pads are guarded always, whatever the
// teacher allowed, so no screen recording shows a PIN being typed. While
// the app locks or opens the history, records stay guarded.

import type { RootStackParamList } from '../navigation/AppNavigator';
import type { LockPhase } from './useLockPhase';

/** What the guard is told: no records and no PIN pad, records, or a PIN pad. */
export type ScreenKind = 'open' | 'records' | 'pin';

/** Screens with no pupil records and no PIN pad. */
export const OPEN_SCREENS: ReadonlySet<string> = new Set<keyof RootStackParamList>([
  'Welcome',
  'Privacy',
  'PrivacyNotice',
  'Help',
  'Connections',
  'Licences',
  'LicenceNotice',
  'Security',
  'NavigationPreview',
  'Gallery',
  'StorageCheck',
]);

/** Screens inside the navigator with a PIN pad. */
const PIN_SCREENS: ReadonlySet<string> = new Set<keyof RootStackParamList>(['LockPin']);

/** The kind of a navigator screen; a screen not yet known holds records. */
export function screenKind(route: string | undefined): ScreenKind {
  if (route !== undefined && PIN_SCREENS.has(route)) return 'pin';
  return route !== undefined && OPEN_SCREENS.has(route) ? 'open' : 'records';
}

/**
 * The kind of what shows before the navigator: a refusal, the welcome and
 * the fingerprint question are open; the PIN pads are PIN pads; and while
 * the app checks the lock or opens the history, which happens as it locks
 * and unlocks, records may still be on the screen or about to come.
 */
export function gateKind(phase: LockPhase, refused: boolean): ScreenKind {
  if (refused || phase.kind === 'welcome' || phase.kind === 'ask') return 'open';
  if (phase.kind === 'create' || phase.kind === 'locked') return 'pin';
  return 'records';
}

type Routes = {
  readonly index?: number;
  readonly routes: readonly { readonly name: string; readonly state?: Routes }[];
};

/** The innermost route in front, such as a tab inside Home, from a navigation state or an initial one. */
export function focusedRoute(state: Routes | undefined): string | undefined {
  if (state === undefined || state.routes.length === 0) return undefined;
  const route = state.routes[state.index ?? state.routes.length - 1];
  if (route === undefined) return undefined;
  return focusedRoute(route.state) ?? route.name;
}
