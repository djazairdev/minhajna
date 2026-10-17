// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// node:assert/strict for the storage check in debug builds (#19). Hermes has
// no Node modules, so Metro gives this file to the core's shared storage
// checks instead. It has only what those checks use, ok, equal and deepEqual,
// with Node's strict rules for the values they compare: primitives, arrays
// and plain objects. Any other kind of value fails the check, so that a value
// it does not understand can never pass. A test holds it to Node's own
// results.

export class AssertionError extends Error {
  override name = 'AssertionError';
}

type Kind = 'array' | 'object' | 'null-prototype';

function kindOf(value: object, path: string): Kind {
  if (Object.getOwnPropertySymbols(value).length > 0) throw new AssertionError(`Unsupported symbol keys at ${path}`);
  if (Array.isArray(value)) return 'array';
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype === Object.prototype) return 'object';
  if (prototype === null) return 'null-prototype';
  throw new AssertionError(`Unsupported value at ${path}`);
}

/** The path of the first difference, or null when the two are deeply and strictly equal. */
function difference(actual: unknown, expected: unknown, path: string): string | null {
  if (typeof actual !== 'object' || actual === null || typeof expected !== 'object' || expected === null) {
    return Object.is(actual, expected) ? null : path;
  }
  const kind = kindOf(actual, path);
  if (kind !== kindOf(expected, path)) return path;
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  if (actualKeys.length !== expectedKeys.length) return path;
  if (kind === 'array' && (actual as unknown[]).length !== (expected as unknown[]).length) return path;
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) return `${path}.${key}`;
    const inner = difference(
      (actual as Record<string, unknown>)[key],
      (expected as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (inner !== null) return inner;
  }
  return null;
}

function ok(value: unknown, message?: string): asserts value {
  if (!value) throw new AssertionError(message ?? 'Expected a truthy value');
}

function equal(actual: unknown, expected: unknown, message?: string): void {
  if (!Object.is(actual, expected)) throw new AssertionError(message ?? 'Expected the same value');
}

function deepEqual(actual: unknown, expected: unknown, message?: string): void {
  const path = difference(actual, expected, '$');
  if (path !== null) throw new AssertionError(message ?? `Values differ at ${path}`);
}

const assert = { AssertionError, ok, equal, deepEqual, strictEqual: equal, deepStrictEqual: deepEqual };

export default assert;
