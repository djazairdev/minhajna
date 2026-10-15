// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The history is chained by hashes, so the same record must always give the
// same text, whatever order its fields were written in. Quoting also escapes
// lone surrogates on engines predating well-formed JSON.stringify. The Unicode
// regex leaves valid pairs intact by matching code points, not code units.

function quoteString(value: string): string {
  return JSON.stringify(value).replace(
    /[\ud800-\udfff]/gu,
    (unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/** Sorted-key JSON with lone surrogates escaped; refuses values JSON cannot carry exactly. */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return quoteString(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('Numbers must be finite');
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value
          .map((item: unknown) => {
            if (item === undefined) throw new TypeError('Arrays cannot hold undefined');
            return canonicalJson(item);
          })
          .join(',')}]`;
      }
      const prototype: unknown = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('Only plain objects can be written');
      }
      const record = value as Record<string, unknown>;
      const fields = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => `${quoteString(key)}:${canonicalJson(record[key])}`);
      return `{${fields.join(',')}}`;
    }
    default:
      throw new TypeError(`Cannot write a value of type ${typeof value}`);
  }
}
