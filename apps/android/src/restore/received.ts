// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the copy here came from (#251, answer 525): a restore notes its
// route, and the history records it as a device event once it opens again,
// so it never leaves this device. A copy taken back records the end of its
// handover instead.

import type { CopyRoute } from '@minhajna/core';
import { useEffect } from 'react';
import { useAppData } from '../storage/AppData';

let pending: CopyRoute | null = null;

/** Notes a restore's route, for the history to record once it opens. */
export function noteReceived(route: CopyRoute): void {
  pending = route;
}

/** Records the route a restore noted, once. */
export function useRecordReceived(): void {
  const { record } = useAppData();
  useEffect(() => {
    if (pending === null) return;
    const from = pending;
    pending = null;
    record({ kind: 'copy.received', received: { from } });
  }, [record]);
}
