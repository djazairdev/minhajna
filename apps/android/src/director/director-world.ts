// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's school in a national demo world (#569, answer 591): every
// device rebuilds the seeded world (#547) from the world's own ID and the
// bundled reference data, so the same world gives the same school everywhere
// and nothing named is uploaded for it, the starting device uploading only its
// staff's keys and joins (world-seed.ts, #548); the director runs its first
// CEM. A teachers' world, or one entered without the reference data, has no
// director's school. The directorate's grants page seeds the same world for its
// schools (#593).

import { directorSchool, seedNationalWorld, type DemoSchool, type DemoWorld } from '@minhajna/core';
import { useMemo } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { ReferenceResult } from '../reference';

/** A national world as every device seeds it from its ID and the bundled reference. */
export function seededWorld(id: string, reference: Extract<ReferenceResult, { ok: true }>): DemoWorld {
  const { zones = [], workingDays } = reference.profile;
  return seedNationalWorld(id, zones, workingDays, reference.packs);
}

/** The director's school in an open world, made once for each world, or null. */
export function useDirectorSchool(
  open: Pick<OpenWorld, 'world' | 'kind'> | null,
  reference: Extract<ReferenceResult, { ok: true }> | undefined,
): DemoSchool | null {
  const id = open?.kind === 'national' ? open.world : null;
  return useMemo(() => {
    if (id === null || reference === undefined) return null;
    return directorSchool(seededWorld(id, reference));
  }, [id, reference]);
}
