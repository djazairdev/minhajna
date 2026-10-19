// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The print screen's choices, kept on this phone and out of the history
// (#215, answer 252): one or two sides, binding margins, the blank copy and
// each journal's layout. The first time, it prints on two sides with
// binding margins. A setting kept by another version, or damaged, gives
// way to the defaults, a field at a time. Each change builds on the one
// before, and is kept at once.

import { useCallback, useState } from 'react';
import face from '../native/NativeMinhajnaInterface';

export interface PrintSettings {
  readonly twoSided: boolean;
  readonly binding: boolean;
  readonly blank: boolean;
  /** Each journal's layout, by document. */
  readonly layouts: Readonly<Record<string, string>>;
}

const KEY = 'print-week';

export const PRINT_DEFAULTS: PrintSettings = { twoSided: true, binding: true, blank: false, layouts: {} };

/** The choices kept on this phone, or the defaults. */
export function loadPrintSettings(): PrintSettings {
  let kept: unknown;
  try {
    kept = JSON.parse(face.setting(KEY) ?? 'null');
  } catch {
    return PRINT_DEFAULTS;
  }
  if (typeof kept !== 'object' || kept === null) return PRINT_DEFAULTS;
  const one = kept as Record<string, unknown>;
  const flag = (name: 'twoSided' | 'binding' | 'blank') =>
    typeof one[name] === 'boolean' ? one[name] : PRINT_DEFAULTS[name];
  const layouts =
    typeof one.layouts === 'object' && one.layouts !== null
      ? Object.fromEntries(
          Object.entries(one.layouts).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        )
      : {};
  return { twoSided: flag('twoSided'), binding: flag('binding'), blank: flag('blank'), layouts };
}

/** Keeps the choices on this phone. */
export function savePrintSettings(settings: PrintSettings): void {
  face.setSetting(KEY, JSON.stringify(settings));
}

/** A change to the choices: some of them, or some made from the current ones. */
export type PrintSettingsChange = Partial<PrintSettings> | ((old: PrintSettings) => Partial<PrintSettings>);

/** The choices, and a change that keeps them on this phone. */
export function usePrintSettings(): [PrintSettings, (change: PrintSettingsChange) => void] {
  const [settings, setSettings] = useState<PrintSettings>(loadPrintSettings);
  const update = useCallback((change: PrintSettingsChange) => {
    setSettings((old) => {
      const kept = { ...old, ...(typeof change === 'function' ? change(old) : change) };
      savePrintSettings(kept);
      return kept;
    });
  }, []);
  return [settings, update];
}
