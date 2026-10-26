// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Wrong passphrases on this PC (#250), counted as the phone counts wrong
// PINs (#210): four are free; from the fifth, each one doubles the wait,
// from 30 seconds up to an hour. A try is counted before the passphrase is
// checked and the count cleared once it opens, so closing the tab during a
// try gives no free guess. A browser has only the wall clock: a clock moved
// back starts the wait again in full, and one moved forward ends it early.
// An unreadable count is the longest wait. The wait slows guessing on this
// screen only; whoever copies the browser's files can guess without it,
// which is why the passphrase is long and slow to try (answer 502).

export const FREE_FAILURES = 4;
export const FIRST_WAIT_SECONDS = 30;
export const MAX_WAIT_SECONDS = 3600;
const MAX_COUNTED = 64;

/** Wrong tries in a row, when the last was counted, and when its wait ends, in epoch milliseconds. */
export interface Attempts {
  readonly failures: number;
  readonly last: number;
  readonly until: number;
}

/** The wait after this many wrong tries in a row, in seconds. */
export function waitFor(failures: number): number {
  if (failures <= FREE_FAILURES) return 0;
  const doublings = Math.min(failures - FREE_FAILURES - 1, 7);
  return Math.min(FIRST_WAIT_SECONDS * 2 ** doublings, MAX_WAIT_SECONDS);
}

function fresh(failures: number, now: number): Attempts {
  return { failures, last: now, until: now + waitFor(failures) * 1000 };
}

/**
 * The count kept on disk, and whether it must be written back: none is
 * no wrong try, an unreadable one the longest wait from now, and one from a
 * clock since moved back its full wait from now.
 */
export function readAttempts(value: unknown, now: number): { attempts: Attempts; carried: boolean } {
  if (value === undefined) return { attempts: fresh(0, now), carried: false };
  const kept = typeof value === 'object' && value !== null ? (value as Partial<Attempts>) : {};
  const { failures, last, until } = kept;
  if (
    !Number.isSafeInteger(failures) ||
    (failures ?? -1) < 0 ||
    typeof last !== 'number' ||
    typeof until !== 'number' ||
    !Number.isFinite(last) ||
    !Number.isFinite(until)
  ) {
    return { attempts: fresh(MAX_COUNTED, now), carried: true };
  }
  const counted = Math.min(failures ?? 0, MAX_COUNTED);
  if (now < last) return { attempts: fresh(counted, now), carried: true };
  return { attempts: { failures: counted, last, until }, carried: false };
}

/** Seconds left before another passphrase may be tried, never more than the count's own wait. */
export function waitLeft(attempts: Attempts, now: number): number {
  const left = Math.min(attempts.until - now, waitFor(attempts.failures) * 1000);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/** The count after one more wrong try. */
export function failed(attempts: Attempts, now: number): Attempts {
  return fresh(Math.min(attempts.failures + 1, MAX_COUNTED), now);
}
