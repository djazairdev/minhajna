// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Only source releases cross this boundary; the hook has no teacher store.
// An edit keeps its opening revision. Failed or stale writes leave it open.
// An old world's late response cannot replace the current page's state.

import { packReleaseKey, type Day, type PackRelease, type PlanPack } from '@minhajna/core';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { changePackRelease, readPackEditor, type PackEditor } from './pack-release-session';

type DraftProblem = 'saveError' | 'packSize' | 'packHistory' | 'packDate' | 'packChanged';

function problemOf(error: unknown): DraftProblem {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'E_PACK_SIZE') return 'packSize';
  if (code === 'E_PACK_HISTORY') return 'packHistory';
  if (code === 'E_PACK_DATE') return 'packDate';
  if (code === 'E_PACK_CHANGED') return 'packChanged';
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
  const writing = useRef(false);
  const { world, held, profile, kit } = editor;
  const ready = world !== null && checked?.world === world.world && checked.date >= world.date;
  useEffect(() => {
    const current = ++generation.current;
    void readPackEditor({ world, held, profile, kit }, send)
      .then(({ date, records: all, damaged }) => {
        if (generation.current !== current || world === null) return;
        setRecords(all);
        setChecked(damaged ? null : { world: world.world, date, generation: current });
        setProblem((old) => (damaged ? 'packHistory' : old === 'packDate' ? old : null));
        if (date > world.date)
          setOpen?.((open) => (open?.world === world.world && date > open.date ? { ...open, date } : open));
        writing.current = false;
        setBusy(false);
      })
      .catch((error: unknown) => {
        if (generation.current === current) {
          setChecked(null);
          setProblem(problemOf(error));
          writing.current = false;
          setBusy(false);
        }
      });
    return () => {
      generation.current += 1;
    };
  }, [world, held, profile, kit, send, reading, setOpen]);
  const save = async (pack: PlanPack, revision: number) => {
    if (!ready || checked.generation !== generation.current || writing.current) return null;
    const current = generation.current;
    writing.current = true;
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
      if (generation.current !== current) return null;
      setRecords((old) => new Map(old).set(packReleaseKey(pack.id, pack.release), saved));
      return saved;
    } catch (error) {
      if (generation.current === current) {
        const next = problemOf(error);
        setProblem(next);
        if (next === 'packDate' || next === 'packHistory') setChecked(null);
        if (next === 'packDate') setReading((old) => old + 1);
      }
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
    problem,
    busy,
    save,
    reload: () => {
      setChecked(null);
      setProblem(null);
      setReading((old) => old + 1);
    },
  };
}
