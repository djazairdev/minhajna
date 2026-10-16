// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Frozen spellings from the formatter before #94. Keeping the expectations
// separate from the shipped JSON catches accidental changes while moving them.

/** The pre-change month names, from January to December. */
export const monthNames = [
  { ar: 'جانفي', fr: 'janvier', en: 'January' },
  { ar: 'فيفري', fr: 'février', en: 'February' },
  { ar: 'مارس', fr: 'mars', en: 'March' },
  { ar: 'أفريل', fr: 'avril', en: 'April' },
  { ar: 'ماي', fr: 'mai', en: 'May' },
  { ar: 'جوان', fr: 'juin', en: 'June' },
  { ar: 'جويلية', fr: 'juillet', en: 'July' },
  { ar: 'أوت', fr: 'août', en: 'August' },
  { ar: 'سبتمبر', fr: 'septembre', en: 'September' },
  { ar: 'أكتوبر', fr: 'octobre', en: 'October' },
  { ar: 'نوفمبر', fr: 'novembre', en: 'November' },
  { ar: 'ديسمبر', fr: 'décembre', en: 'December' },
] as const;
