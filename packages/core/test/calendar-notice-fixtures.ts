// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** A made-up public closure notice, never a real school's file. */
export const noticeFile = {
  format: 'minhajna.calendar-entry',
  version: { major: 1, minor: 0 },
  country: 'dz',
  year: '2026-2027',
  sender: 'Example school office',
  school: { name: 'Example middle school', zone: '16' },
  entry: {
    id: 'example-received-closure',
    layer: 'school',
    effect: 'closure',
    from: '2026-10-14',
    to: '2026-10-15',
    half: 'morning',
    source: 'Example notice, not an official announcement',
    name: { ar: 'غلق تجريبي', en: 'Example closure' },
    confidence: 'announced',
  },
};
