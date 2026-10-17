// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Finding a wilaya by part of its name, in any interface language, or by its
// number. Arabic is matched without its short vowels and with the usual
// letter variants folded (أ إ آ to ا, ة to ه, ى to ي), and Latin without
// accents, so «setif» finds «Sétif» and «الشلف» finds «الشلَف».

import type { Zone } from '@minhajna/core';

/** Text folded so that spelling variants compare equal. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[’'`ʼ-]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Whether a zone's number or any of its names holds the query; an empty query holds every zone. */
export function zoneMatches(zone: Zone, query: string): boolean {
  const wanted = fold(query);
  if (wanted === '') return true;
  if (/^\d+$/.test(wanted)) return Number(zone.code) === Number(wanted) || zone.code.startsWith(wanted);
  return Object.values(zone.name).some((name) => fold(name).includes(wanted));
}
