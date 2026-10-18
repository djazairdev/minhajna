// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Unsupported/denied APIs are reported, never converted to zero or success.

/** Browser-reported estimates are origin-wide and approximate, not disk limits. */
export interface StorageStatus {
  readonly usage: number | null;
  readonly quota: number | null;
  readonly persisted: boolean | 'unsupported' | 'error';
  readonly estimate: 'available' | 'unsupported' | 'error';
}

/** Feature availability is independent of whether permission will be granted. */
export function capabilities(): Record<string, boolean> {
  return {
    secureContext: isSecureContext,
    indexedDB: typeof indexedDB !== 'undefined',
    webCrypto: typeof crypto !== 'undefined' && crypto.subtle !== undefined,
    persistence: typeof navigator.storage?.persist === 'function',
    serviceWorker: 'serviceWorker' in navigator,
    standalone: matchMedia('(display-mode: standalone)').matches,
  };
}

/** The optional grant is requested only from the explicit persistence button. */
export async function storageStatus(request = false): Promise<StorageStatus> {
  const storage = navigator.storage;
  let persisted: StorageStatus['persisted'] = 'unsupported';
  let estimate: StorageStatus['estimate'] = 'unsupported';
  let usage: number | null = null;
  let quota: number | null = null;
  try {
    if (typeof storage?.persisted === 'function') persisted = await storage.persisted();
    if (request && typeof storage?.persist === 'function') persisted = await storage.persist();
  } catch {
    persisted = 'error';
  }
  try {
    if (typeof storage?.estimate === 'function') {
      const result = await storage.estimate();
      usage = result.usage ?? null;
      quota = result.quota ?? null;
      estimate = 'available';
    }
  } catch {
    estimate = 'error';
  }
  return { usage, quota, persisted, estimate };
}
