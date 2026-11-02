// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Only source releases cross this boundary; the hook has no teacher store.
// An edit keeps its opening revision. Failed or stale writes leave it open.
// An old world's late response cannot replace the current page's state.

import { packReleaseKey, type PackRelease, type PlanPack } from '@minhajna/core';
import { useEffect, useRef, useState } from 'react';
import type { Send } from '../demo/world-session';
import { changePackRelease, readPackReleases, type PackEditor } from './pack-release-session';

export function usePackDrafts(editor: PackEditor, reference: readonly PlanPack[], send?: Send) {
  const [records, setRecords] = useState<ReadonlyMap<string, PackRelease>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(0);
  const generation = useRef(0);
  const writing = useRef(false);
  const { world, held, profile, kit } = editor;
  useEffect(() => {
    const current = ++generation.current;
    void readPackReleases({ world, held, profile, kit }, send)
      .then((all) => {
        if (generation.current === current) {
          setRecords(all);
          setReady(true);
          setError(false);
          writing.current = false;
          setBusy(false);
        }
      })
      .catch(() => {
        if (generation.current === current) {
          setReady(false);
          setError(true);
          writing.current = false;
          setBusy(false);
        }
      });
    return () => {
      generation.current += 1;
    };
  }, [world, held, profile, kit, send, reading]);
  const save = async (pack: PlanPack, revision: number) => {
    if (!ready || writing.current) return null;
    const current = generation.current;
    writing.current = true;
    setBusy(true);
    setError(false);
    try {
      if (revision === 0 && reference.some((one) => one.id === pack.id && one.release === pack.release))
        throw new Error('E_PACK_SOURCE');
      const saved = await changePackRelease(
        editor,
        'curator',
        { id: pack.id, release: pack.release, revision },
        { stage: 'draft', pack },
        send,
      );
      if (generation.current !== current) return null;
      setRecords((old) => new Map(old).set(packReleaseKey(pack.id, pack.release), saved));
      return saved;
    } catch {
      if (generation.current === current) setError(true);
      return null;
    } finally {
      if (generation.current === current) {
        writing.current = false;
        setBusy(false);
      }
    }
  };
  return {
    records,
    ready,
    error,
    busy,
    save,
    reload: () => {
      setReady(false);
      setError(false);
      setReading((old) => old + 1);
    },
  };
}
