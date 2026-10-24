// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** A notification set ahead: its time, its channel, its words and the screen it opens. */
export type PlannedNotification = {
  /** Unique among those planned, such as `digest-2026-10-18`. */
  id: string;
  /** Milliseconds since the epoch, in the phone's time. */
  at: number;
  /** `digest`, `preview` or `backup`, with the channel's name in the interface's language. */
  channel: string;
  channelName: string;
  title: string;
  text: string;
  /** The screen a tap opens: `digest` or `today`. */
  open: string;
};

// Notifications set ahead (#234, answer 406): Android shows each at its time
// with the words given here, with no JavaScript running, and sets them again
// after a restart. They are kept on the phone, outside the history.
export interface Spec extends TurboModule {
  /** Replaces every notification still planned with these; those already past are dropped. */
  plan(items: ReadonlyArray<PlannedNotification>): void;
  /** Whether the app may show notifications: its permission and its switch in Android's settings. Synchronous. */
  enabled(): boolean;
  /** Opens the app's notification settings in Android, for a teacher who turned them off there. */
  openSettings(): void;
  /** The screen a tapped notification asked for, given once; null when there is none. Synchronous. */
  takeOpened(): string | null;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaNotify');
