// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words a screen shows on this device (#250, answer 509). A PC reads a
// text's PC wording where the catalogue has one in the interface's own
// language, under the same key with `pc` before its last part, as
// `settings.transfer.pc.sub` for `settings.transfer.sub`; any other text,
// and any key given as a list, reads as on the phone. Each part of #250
// words the screens it brings to the PC; the phone is unchanged.

import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { currentLanguage, i18n, useText } from './i18n';

/** Whether the app runs in a PC's browser, read when asked so tests can set it. */
export function onPc(): boolean {
  return Platform.OS === 'web';
}

/** The key of a text's PC wording. */
export function pcKey(key: string): string {
  const last = key.lastIndexOf('.') + 1;
  return `${key.slice(0, last)}pc.${key.slice(last)}`;
}

/** The text function of this device: the PC's wording first on a PC, else the phone's. */
export function useDeviceText(): TFunction {
  const t = useText();
  const pc = onPc();
  return useMemo(() => {
    if (!pc) return t;
    const lookup = t as unknown as (key: unknown, options?: object) => string;
    const read = (key: unknown, options?: object) => {
      const own = typeof key === 'string' ? pcKey(key) : null;
      const found = own !== null && i18n.exists(own, { ...options, lngs: [currentLanguage()] });
      return lookup(found ? own : key, options);
    };
    return read as unknown as TFunction;
  }, [t, pc]);
}
