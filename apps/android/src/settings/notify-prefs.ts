// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's notification choices (#234, Notif, answers 402 and 403),
// kept on this phone only, outside the history: the weekly digest, on by
// default; the daily preview, off by default; and «العمل يوم السبت», which
// moves the digest to Saturday morning and shortens the weekend's quiet
// hours. A value that cannot be read falls back to the defaults.

import type { NotifyChoices } from '@minhajna/core';
import { useSyncExternalStore } from 'react';
import face from '../native/NativeMinhajnaInterface';

const KEY = 'notify';
const DEFAULTS: NotifyChoices = { digest: true, preview: false, saturday: false };
const listeners = new Set<() => void>();
let cached: NotifyChoices | undefined;

/** The saved choices, each falling back to its default. */
export function notifyPrefs(): NotifyChoices {
  if (cached !== undefined) return cached;
  let saved: Partial<Record<keyof NotifyChoices, unknown>> = {};
  try {
    const value: unknown = JSON.parse(face.setting(KEY) ?? '{}');
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) saved = value;
  } catch {
    saved = {};
  }
  const pick = (key: keyof NotifyChoices) => (typeof saved[key] === 'boolean' ? saved[key] : DEFAULTS[key]);
  cached = { digest: pick('digest'), preview: pick('preview'), saturday: pick('saturday') };
  return cached;
}

/** Keeps the change first, then notifies every mounted view; a failed write leaves the choices unchanged. */
export function setNotifyPrefs(change: Partial<NotifyChoices>): void {
  const next = { ...notifyPrefs(), ...change };
  face.setSetting(KEY, JSON.stringify(next));
  cached = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The saved choices, including a change made while this view stays mounted. */
export function useNotifyPrefs(): NotifyChoices {
  return useSyncExternalStore(subscribe, notifyPrefs);
}
