// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Plan packs and reference data travel as files, from the data repository
// or from a colleague's phone, so every one is read as untrusted (PRD §5.9).
// A reader checks each field against the format, reports every problem
// rather than the first, and keeps only the format's fields. No text may
// carry a bidi control or a line or paragraph separator: isolating a value
// on screen cannot hold against one that closes the isolate itself.

import { compareDays, isDay, type Day } from './day.ts';

export type ParseProblemKind = 'required' | 'invalid' | 'duplicate' | 'unknown-reference';

export interface ParseProblem {
  readonly path: string;
  readonly problem: ParseProblemKind;
}

export type ParseResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problems: readonly ParseProblem[] };

/** A release of a pack or of reference data, such as `2026.1`. */
export const RELEASE = /^\d{4}\.\d+$/;
/** A language code, such as `ar` or `fr`. */
export const LANGUAGE = /^[a-z]{2,3}$/;

export type Fields = Readonly<Record<string, unknown>>;

export function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/** Whether a text carries a bidi control (U+061C, U+200E/F, U+202A–E, U+2066–9) or U+2028/9. */
export function hasBidiControl(value: string): boolean {
  return [...value].some((char) => {
    const point = char.codePointAt(0)!;
    return (
      point === 0x061c ||
      point === 0x200e ||
      point === 0x200f ||
      (point >= 0x2028 && point <= 0x202e) ||
      (point >= 0x2066 && point <= 0x2069)
    );
  });
}

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

export function at(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

export class Reader {
  readonly problems: ParseProblem[] = [];

  fail(path: string, problem: ParseProblemKind): void {
    this.problems.push({ path, problem });
  }

  text(fields: Fields, key: string, path: string, pattern?: RegExp): string | undefined {
    const value = fields[key];
    if (value === undefined) return undefined;
    if (
      typeof value !== 'string' ||
      value.trim() === '' ||
      hasBidiControl(value) ||
      (pattern !== undefined && !pattern.test(value))
    ) {
      this.fail(at(path, key), 'invalid');
      return undefined;
    }
    return value;
  }

  requiredText(fields: Fields, key: string, path: string, pattern?: RegExp): string {
    if (fields[key] === undefined) this.fail(at(path, key), 'required');
    return this.text(fields, key, path, pattern) ?? '';
  }

  number(fields: Fields, key: string, path: string, integer: boolean): number | undefined {
    const value = fields[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
      this.fail(at(path, key), 'invalid');
      return undefined;
    }
    return value;
  }

  requiredNumber(fields: Fields, key: string, path: string, integer: boolean): number | undefined {
    if (fields[key] === undefined) {
      this.fail(at(path, key), 'required');
      return undefined;
    }
    return this.number(fields, key, path, integer);
  }

  flag(fields: Fields, key: string, path: string): boolean | undefined {
    const value = fields[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
      this.fail(at(path, key), 'invalid');
      return undefined;
    }
    return value;
  }

  oneOf<T extends string>(fields: Fields, key: string, path: string, list: readonly T[]): T | undefined {
    const value = fields[key];
    if (value === undefined) {
      this.fail(at(path, key), 'required');
      return undefined;
    }
    if (!isOneOf(list, value)) {
      this.fail(at(path, key), 'invalid');
      return undefined;
    }
    return value;
  }

  /** A required day, written YYYY-MM-DD. */
  day(fields: Fields, key: string, path: string): Day | undefined {
    const value = fields[key];
    if (value === undefined) {
      this.fail(at(path, key), 'required');
      return undefined;
    }
    if (typeof value !== 'string' || !isDay(value)) {
      this.fail(at(path, key), 'invalid');
      return undefined;
    }
    return value;
  }

  /** A required span of days, `from` to `to`, both included. */
  span(fields: Fields, path: string): { readonly from: Day; readonly to: Day } | undefined {
    const from = this.day(fields, 'from', path);
    const to = this.day(fields, 'to', path);
    if (from === undefined || to === undefined) return undefined;
    if (compareDays(from, to) > 0) {
      this.fail(at(path, 'to'), 'invalid');
      return undefined;
    }
    return { from, to };
  }

  /** A required list, read item by item. An item the reader rejects is left out, with its problem reported. */
  list<T>(
    fields: Fields,
    key: string,
    path: string,
    read: (raw: unknown, path: string) => T | undefined,
    options: { readonly nonEmpty: boolean },
  ): T[] {
    const value = fields[key];
    if (!Array.isArray(value) || (options.nonEmpty && value.length === 0)) {
      this.fail(at(path, key), value === undefined ? 'required' : 'invalid');
      return [];
    }
    const items: T[] = [];
    value.forEach((raw: unknown, index) => {
      const item = read(raw, `${at(path, key)}[${index}]`);
      if (item !== undefined) items.push(item);
    });
    return items;
  }

  /** A list of distinct codes, each one known. */
  codes(fields: Fields, key: string, path: string, known: readonly string[], required: boolean): string[] | undefined {
    const value = fields[key];
    if (value === undefined) {
      if (required) this.fail(at(path, key), 'required');
      return undefined;
    }
    if (!Array.isArray(value) || value.length === 0 || !value.every(isText) || new Set(value).size !== value.length) {
      this.fail(at(path, key), 'invalid');
      return undefined;
    }
    if (!value.every((code) => known.includes(code))) {
      this.fail(at(path, key), 'unknown-reference');
      return undefined;
    }
    return value;
  }
}
