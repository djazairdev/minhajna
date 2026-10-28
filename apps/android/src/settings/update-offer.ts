// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's update, as Today offers it (#250, R-6.6-06, answers 516
// and 517): at each opening, the newer build the server holds, with its
// version, its checksum and its short notes; and once one was installed,
// what it was, recorded in the history with its day before the note of it
// is forgotten, so a reload in between records it once. A phone has no
// update module, so nothing shows there. Installing reloads the app, which
// then asks for the passphrase again.

import { eventOf } from '@minhajna/core';
import { useEffect, useState } from 'react';
import found, { type Spec } from '../native/NativeMinhajnaUpdate';
import { useAppData } from '../storage/AppData';

/** The update module, which a phone does not have. */
const native: Spec | null = found ?? null;

/** Whether this device takes the web app's updates: a PC, not a phone. */
export const takesUpdates = native !== null;

const HASH = /^[0-9a-f]{64}$/u;

export type UpdateOffer = {
  readonly version: string;
  readonly versionCode: number;
  readonly sha256: string;
  /** Each language's short notes; empty when the release has none. */
  readonly notes: Readonly<Record<'ar' | 'fr' | 'en', readonly string[]>>;
};

export type UpdateDone = { readonly from: string; readonly version: string; readonly sha256: string };

/** An update installed before this opening, and whether the history holds it. */
export type Installed = UpdateDone & { readonly logged: boolean };

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 40;

function parsed(json: string | null): Record<string, unknown> | null {
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The offer the update module gives, or null when it is none or malformed. */
export function readOffer(json: string | null): UpdateOffer | null {
  const value = parsed(json);
  if (value === null || !text(value.version) || typeof value.sha256 !== 'string' || !HASH.test(value.sha256)) {
    return null;
  }
  if (!Number.isSafeInteger(value.versionCode)) return null;
  const notes = typeof value.notes === 'object' && value.notes !== null ? (value.notes as Record<string, unknown>) : {};
  const lines = (language: string) => {
    const list = notes[language];
    if (!Array.isArray(list)) return [];
    return list.filter((line): line is string => typeof line === 'string' && line.length <= 160).slice(0, 5);
  };
  return {
    version: value.version,
    versionCode: value.versionCode as number,
    sha256: value.sha256,
    notes: { ar: lines('ar'), fr: lines('fr'), en: lines('en') },
  };
}

/** The update installed before this opening, or null. */
export function readDone(json: string | null): UpdateDone | null {
  const value = parsed(json);
  if (value === null || !text(value.from) || !text(value.version)) return null;
  if (typeof value.sha256 !== 'string' || !HASH.test(value.sha256)) return null;
  return { from: value.from, version: value.version, sha256: value.sha256 };
}

/** What Today shows of the PC's updates, and installing the one offered. */
export function useAppUpdate() {
  const { record, settled, entries } = useAppData();
  const [offer, setOffer] = useState<UpdateOffer | null>(null);
  const [done, setDone] = useState<Installed | null>(null);
  const [state, setState] = useState<'idle' | 'installing' | 'failed'>('idle');
  useEffect(() => {
    if (native === null) return undefined;
    let active = true;
    void native.available().then((json) => {
      if (active) setOffer(readOffer(json));
    });
    void native.installed().then(async (json) => {
      const installed = readDone(json);
      if (installed === null || !active) return;
      const kept = () =>
        entries().some((entry) => {
          const event = eventOf(entry);
          return event?.kind === 'app.updated' && event.updated?.build === installed.sha256;
        });
      if (!kept()) {
        record({ kind: 'app.updated', updated: { version: installed.version, build: installed.sha256 } });
        await settled();
      }
      const logged = kept();
      if (logged) native?.forget();
      if (active) setDone({ ...installed, logged });
    });
    return () => {
      active = false;
    };
  }, [entries, record, settled]);
  const install = (sha256: string) => {
    if (native === null || state === 'installing') return;
    setState('installing');
    native.install(sha256).catch(() => setState('failed'));
  };
  return { offer, done, state, install };
}
