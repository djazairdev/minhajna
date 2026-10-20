// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Portable, made-up closure notice matching withDay's fictional school, not a real announcement. */
export const noticeData = () => ({
  format: 'minhajna.calendar-entry',
  version: { major: 1, minor: 0 },
  country: 'dz',
  year: '2026-2027',
  sender: 'مُرسل تجريبي',
  school: { name: 'متوسطة النجاح', zone: '16' },
  entry: {
    id: 'example-received-closure',
    layer: 'school',
    effect: 'closure',
    from: '2026-10-15',
    to: '2026-10-15',
    source: 'إعلان تجريبي غير رسمي',
    name: { ar: 'غلق تجريبي', en: 'Example closure', fr: 'Fermeture fictive' },
    confidence: 'announced',
    levels: ['cem'],
    grades: ['4am'],
  },
});
