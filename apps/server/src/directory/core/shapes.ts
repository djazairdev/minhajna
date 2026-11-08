// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What this folder's copies of the core's directory files import from the rest
// of the core, which the server's image doesn't hold: a day, the week's places,
// and the parts of a country profile startingLevels reads. The copies are the
// core's files, byte for byte but for their imports, which a test checks.

export { isDay } from '../../worlds/world-rules.js';

export type Day = string;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Half = 'morning' | 'afternoon';
export type LocalizedText = Readonly<Record<string, string>>;

export interface Slot {
  readonly half: Half;
  readonly index: number;
}

export interface CountryProfile {
  readonly levels: readonly { readonly code: string }[];
  readonly subjects: readonly {
    readonly code: string;
    readonly levels: readonly string[];
    readonly specialist?: readonly string[];
  }[];
}
