// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { PlannedNotification, Spec } from '../src/native/NativeMinhajnaNotify';

/**
 * The notification module for Jest, in memory: what the app last planned,
 * whether Android lets it notify, how many times its settings were opened,
 * and the screen a tapped notification asks for.
 */
export class FakeNotify {
  planned: PlannedNotification[] = [];
  plans = 0;
  allowed = true;
  settingsOpened = 0;
  opened: string | null = null;

  asSpec(): Spec {
    return {
      plan: (items) => {
        this.planned = [...items];
        this.plans += 1;
      },
      enabled: () => this.allowed,
      openSettings: () => {
        this.settingsOpened += 1;
      },
      takeOpened: () => {
        const open = this.opened;
        this.opened = null;
        return open;
      },
    };
  }
}

export const fakeNotify = new FakeNotify();
