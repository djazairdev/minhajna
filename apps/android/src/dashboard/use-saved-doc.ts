// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A document of the directory as a dashboard page edits it (answer 809): each
// change shows at once and is saved over the revision read last. Changes made
// while a save is on its way wait, and only the newest goes next. A save that
// fails keeps the change on the page and waits for a retry; when someone else
// saved first it goes no further, and the page says so through its call, with
// the way to read the latest copy. What the server answers replaces the page's
// copy only when nothing newer waits.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DirectoryOptions } from '../network/directory-network';
import type { DirectoryCall } from './use-directory-call';

export type SaveDoc<T> = (
  revision: number,
  doc: T,
  options: DirectoryOptions,
) => Promise<{ readonly revision: number; readonly doc?: T }>;

export interface SavedDoc<T> {
  readonly doc: T;
  readonly revision: number;
  /** True while a change is not yet saved. */
  readonly unsaved: boolean;
  /** Reads the change into the page and saves it. */
  readonly change: (next: T) => void;
  /** Changes the newest copy, as a panel opened earlier does. */
  readonly update: (step: (doc: T) => T) => void;
  /** Sends what waits again, after a failed save. */
  readonly retry: () => void;
  /** Changes the page's copy without saving it, for what the server already holds, as a renewed code. */
  readonly adopt: (step: (doc: T) => T) => void;
  /** Replaces the page's copy with a copy just read, dropping what waits. */
  readonly replace: (doc: T, revision: number) => void;
}

/** A document, starting from a copy just read. */
export function useSavedDoc<T>(
  start: { doc: T; revision: number },
  save: SaveDoc<T>,
  call: DirectoryCall,
): SavedDoc<T> {
  const { run } = call;
  const [doc, setShown] = useState(start.doc);
  const latest = useRef(start.doc);
  const setDoc = useCallback((next: T) => {
    latest.current = next;
    setShown(next);
  }, []);
  const [revision, setRevision] = useState(start.revision);
  const [unsaved, setUnsaved] = useState(false);
  const held = useRef({ revision: start.revision, waiting: null as T | null, sending: false });
  const saver = useRef(save);
  useEffect(() => {
    saver.current = save;
  }, [save]);
  const flush = useCallback(async () => {
    const state = held.current;
    if (state.sending) return;
    state.sending = true;
    for (let sent = state.waiting; sent !== null; sent = state.waiting) {
      const from = state.revision;
      state.waiting = null;
      const answer = await run((options) => saver.current(from, sent, options));
      if (held.current !== state) return;
      if (answer === undefined) {
        state.waiting ??= sent;
        break;
      }
      state.revision = answer.revision;
      setRevision(answer.revision);
      if (state.waiting === null) {
        if (answer.doc !== undefined) setDoc(answer.doc);
        setUnsaved(false);
      }
    }
    state.sending = false;
  }, [run, setDoc]);
  const change = useCallback(
    (next: T) => {
      setDoc(next);
      setUnsaved(true);
      held.current.waiting = next;
      void flush();
    },
    [flush, setDoc],
  );
  const update = useCallback((step: (current: T) => T) => change(step(latest.current)), [change]);
  const retry = useCallback(() => void flush(), [flush]);
  const replace = useCallback(
    (next: T, at: number) => {
      held.current = { revision: at, waiting: null, sending: false };
      setDoc(next);
      setRevision(at);
      setUnsaved(false);
    },
    [setDoc],
  );
  const adopt = useCallback(
    (step: (current: T) => T) => {
      const state = held.current;
      if (state.waiting !== null) state.waiting = step(state.waiting);
      setDoc(step(latest.current));
    },
    [setDoc],
  );
  return { doc, revision, unsaved, change, update, adopt, retry, replace };
}
