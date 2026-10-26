// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Notifications on the web (#250): none. The phone carries the reminders;
// a PC shows nothing set ahead, and says notifications are off.

import type { Spec } from '../../../android/src/native/NativeMinhajnaNotify';

const Notify: Spec = {
  plan() {
    return;
  },
  enabled: () => false,
  openSettings() {
    return;
  },
  takeOpened: () => null,
};

export default Notify;
