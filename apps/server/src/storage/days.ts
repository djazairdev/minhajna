// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Days as the stores keep them in PostgreSQL's date columns: a day's UTC
// midnight, and back.

/** The UTC midnight of a day written YYYY-MM-DD. */
export const toDate = (day: string): Date => new Date(`${day}T00:00:00Z`);

/** The day of a date column, written YYYY-MM-DD. */
export const toDay = (date: Date): string => date.toISOString().slice(0, 10);
