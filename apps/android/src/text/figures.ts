// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A figure written for reading (#597): rounded to one decimal, as shares are
// shown, and written with that decimal even when it is zero where its column
// holds other figures with one, so they line up; in Latin digits, as Algerian
// schools write them in every language, with a decimal comma in Arabic and
// French and a point in English. It does not lean on Intl, which Hermes lacks
// in part and whose engines write Arabic numbers each their own way.

import type { Language } from './i18n';

/** A count or share rounded to one decimal, as the interface's language writes it. */
export function roundFigure(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A count or share as the interface's language writes it, to one decimal; `fixed` keeps a zero decimal. */
export function formatFigure(value: number, language: Language, fixed = false): string {
  const rounded = roundFigure(value);
  const written = fixed ? rounded.toFixed(1) : String(rounded);
  return language === 'en' ? written : written.replace('.', ',');
}
