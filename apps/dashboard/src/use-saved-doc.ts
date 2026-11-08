// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A document of the directory as a dashboard page edits it (answer 809): each
// change shows at once and is saved over the revision read last. Changes made
// while a save is on its way wait, and only the newest goes next. A save that
// fails keeps the change on the page and waits for a retry; when someone else
// saved first, nothing more is sent and the page stops taking changes until it
// reads the latest copy, as its call says. What the server answers replaces
// the page's copy only when nothing newer waits, with what the page adopted
// meanwhile, as a renewed code, laid over it again.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DirectoryOptions } from '../../android/src/network/directory-network';
import { problemOf, type DirectoryCall } from './use-directory-call';

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
  /** True once someone else saved first, until the latest copy replaces the page's. */
  readonly stale: boolean;
  /** The newest copy, for a panel that reads it later than it opened. */
  readonly read: () => T;
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
  const [stale, setStale] = useState(false);
  const held = useRef({
    revision: start.revision,
    waiting: null as T | null,
    sending: false,
    stale: false,
    adopted: [] as ((doc: T) => T)[],
  });
  const saver = useRef(save);
  useEffect(() => {
    saver.current = save;
  }, [save]);
  const flush = useCallback(async () => {
    const state = held.current;
    if (state.sending || state.stale) return;
    state.sending = true;
    for (let sent = state.waiting; sent !== null && !state.stale; sent = state.waiting) {
      const from = state.revision;
      const mark = state.adopted.length;
      state.waiting = null;
      const answer = await run(async (options) => {
        try {
          return await saver.current(from, sent, options);
        } catch (error) {
          if (problemOf(error) === 'stale') state.stale = true;
          throw error;
        }
      });
      if (held.current !== state) return;
      if (answer === undefined) {
        state.waiting ??= sent;
        setStale(state.stale);
        break;
      }
      state.revision = answer.revision;
      setRevision(answer.revision);
      if (state.waiting === null) {
        const { doc: saved } = answer;
        if (saved !== undefined) setDoc(state.adopted.slice(mark).reduce<T>((one, step) => step(one), saved));
        state.adopted = [];
        setUnsaved(false);
      }
    }
    state.sending = false;
  }, [run, setDoc]);
  const change = useCallback(
    (next: T) => {
      if (held.current.stale) return;
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
      held.current = { revision: at, waiting: null, sending: false, stale: false, adopted: [] };
      setDoc(next);
      setRevision(at);
      setUnsaved(false);
      setStale(false);
    },
    [setDoc],
  );
  const adopt = useCallback(
    (step: (current: T) => T) => {
      const state = held.current;
      state.adopted.push(step);
      if (state.waiting !== null) state.waiting = step(state.waiting);
      setDoc(step(latest.current));
    },
    [setDoc],
  );
  const read = useCallback(() => latest.current, []);
  return { doc, revision, unsaved, stale, read, change, update, adopt, retry, replace };
}
