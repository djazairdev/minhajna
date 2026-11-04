// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The quantiles the observatory works with (#626, #628): a value part of the
// way through sorted values, between the two nearest, as a spreadsheet's
// QUARTILE.INC works it out, and as totals/floors.ts works out its own, whose
// code stays the core's byte for byte.

/** The value `at` of the way through sorted values, between the two nearest; the values are never empty. */
export function quantile(sorted: readonly number[], at: number): number {
  const place = (sorted.length - 1) * at;
  const below = Math.floor(place);
  const low = sorted[below]!;
  const high = sorted[Math.min(below + 1, sorted.length - 1)]!;
  return low + (high - low) * (place - below);
}

/** The values in order, smallest first. */
export const sortedOf = (values: readonly number[]): number[] => [...values].sort((one, other) => one - other);
