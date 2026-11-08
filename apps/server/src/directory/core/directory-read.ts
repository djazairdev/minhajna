// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the directory's readers share (directory.ts, directory-book.ts).

const MAX_NAME = 120;

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isText = (value: unknown, max = MAX_NAME): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max;
export const isCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_+-]{1,64}$/u.test(value);
