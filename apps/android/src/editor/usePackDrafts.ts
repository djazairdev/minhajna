// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Only source releases cross this boundary; the hook has no teacher store.
// An edit keeps its opening revision. Failed or stale writes leave it open.
// An old world's late response cannot replace the current page's state. A
// stale write, a moved day or a damaged read reads the stream again, so the
// open draft can offer the latest revision; saving before a read has finished
// starts one too. A read starting during a write leaves that write alone: its
// result still counts unless the world, keys or service itself were replaced,
// and the stream is read again after it, as that read may have missed it.

import { packReleaseKey, type Day, type PackRelease, type PlanPack } from '@minhajna/core';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { changePackRelease, readPackEditor, type PackEditor } from './pack-release-session';

type DraftProblem = 'saveError' | 'packSize' | 'packHistory' | 'packDate' | 'packChanged' | 'worldErased';

/** Whether the curator can edit this release: their own, still a draft or under review. */
export function isCuratorDraft(one: PackRelease) {
  return one.actor === 'curator' && (one.stage === 'draft' || one.stage === 'under-review');
}

function problemOf(error: unknown): DraftProblem {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'E_PACK_SIZE') return 'packSize';
  if (code === 'E_PACK_HISTORY') return 'packHistory';
  if (code === 'E_PACK_DATE') return 'packDate';
  if (code === 'E_PACK_CHANGED') return 'packChanged';
  if (code === 'E_NO_SUCH_WORLD') return 'worldErased';
  return 'saveError';
}

export function usePackDrafts(
  editor: PackEditor,
  reference: readonly PlanPack[],
  send?: Send,
  setOpen?: Dispatch<SetStateAction<OpenWorld | null>>,
) {
  const [records, setRecords] = useState<ReadonlyMap<string, PackRelease>>(new Map());
  const [checked, setChecked] = useState<{ world: string; date: Day; generation: number } | null>(null);
  const [problem, setProblem] = useState<DraftProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(0);
  const generation = useRef(0);
  const context = useRef(0);
  const writing = useRef<number | null>(null);
  const { world, held, profile, kit } = editor;
  const worldId = world?.world;
  const ready = world !== null && checked?.world === world.world && checked.date >= world.date;
  useEffect(
    () => () => {
      context.current += 1;
    },
    [worldId, held, profile, kit, send],
  );
  useEffect(() => {
    const current = ++generation.current;
    const abandon = () => {
      if (writing.current === null || writing.current === context.current) return;
      writing.current = null;
      setBusy(false);
    };
    void readPackEditor({ world, held, profile, kit }, send)
      .then(({ date, records: all, damaged }) => {
        if (generation.current !== current || world === null) return;
        setRecords(all);
        setChecked(damaged ? null : { world: world.world, date, generation: current });
        setProblem((old) => (damaged ? 'packHistory' : old === 'packDate' || old === 'packChanged' ? old : null));
        if (date > world.date)
          setOpen?.((open) => (open?.world === world.world && date > open.date ? { ...open, date } : open));
        abandon();
      })
      .catch((error: unknown) => {
        if (generation.current === current) {
          setChecked(null);
          setProblem(problemOf(error));
          abandon();
        }
      });
    return () => {
      generation.current += 1;
    };
  }, [world, held, profile, kit, send, reading, setOpen]);
  const save = async (pack: PlanPack, revision: number) => {
    if (writing.current !== null) return null;
    if (!ready || checked.generation !== generation.current) {
      setReading((old) => old + 1);
      return null;
    }
    const current = context.current;
    const reads = generation.current;
    writing.current = current;
    setBusy(true);
    setProblem(null);
    try {
      if (revision === 0 && reference.some((one) => one.id === pack.id && one.release === pack.release))
        throw new Error('E_PACK_SOURCE');
      const saved = await changePackRelease(
        { ...editor, world: { ...world, date: checked.date } },
        'curator',
        { id: pack.id, release: pack.release, revision },
        { stage: 'draft', pack },
        send,
      );
      if (context.current !== current) return null;
      setRecords((old) => new Map(old).set(packReleaseKey(pack.id, pack.release), saved));
      if (generation.current !== reads) {
        setProblem((old) => (old === 'saveError' ? null : old));
        setReading((old) => old + 1);
      }
      return saved;
    } catch (error) {
      if (context.current === current) {
        const next = problemOf(error);
        setProblem(next);
        if (next !== 'saveError' && next !== 'packSize') {
          setChecked(null);
          setReading((old) => old + 1);
        }
      }
      return null;
    } finally {
      if (context.current === current) {
        writing.current = null;
        setBusy(false);
      }
    }
  };
  return {
    records,
    ready,
    problem,
    busy,
    save,
    dismiss: () =>
      setProblem((old) => (old === 'packDate' || old === 'packChanged' || old === 'packSize' ? null : old)),
    reload: () => {
      setChecked(null);
      setProblem(null);
      setReading((old) => old + 1);
    },
  };
}
