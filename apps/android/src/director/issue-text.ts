// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's words for a teacher's row (#570, answers 596 and 598): how they
// work, by phone or by security key, and where their current code or key
// stands: no code yet, a code issued on a day and waiting to be scanned until
// its last valid day, a key waiting by its number, a code expired on its last
// day, or joined on a day, with the key's number when it was by key. The days
// are written as the world's band writes them.

import type { Day, IssueRow } from '@minhajna/core';
import type { TFunction } from 'i18next';

/** How the teacher works, in the screen's language. */
export const accessText = (t: TFunction, row: IssueRow): string =>
  t(row.access === 'key' ? 'demo.issue.access.key' : 'demo.issue.access.phone');

/** Where the teacher's current code or key stands. */
export function statusText(t: TFunction, row: IssueRow, dayText: (day: Day) => string): string {
  const { status, issue, keyNumber } = row;
  switch (status.kind) {
    case 'none':
      return t('demo.issue.status.none');
    case 'joined':
      return keyNumber === null
        ? t('demo.issue.status.joined', { day: dayText(status.on) })
        : t('demo.issue.status.keyJoined', { day: dayText(status.on), number: keyNumber });
    case 'expired':
      return t('demo.issue.status.expired', { until: dayText(status.until) });
    case 'waiting':
      return status.until === null || issue === null
        ? t('demo.issue.status.keyWaiting', { number: keyNumber ?? '' })
        : t('demo.issue.status.waiting', { day: dayText(issue.day), until: dayText(status.until) });
  }
}
