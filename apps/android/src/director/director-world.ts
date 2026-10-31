// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's school in a national demo world (#569, answer 591): every
// device rebuilds the seeded world (#547) from the world's own ID and the
// bundled reference data, so the same world gives the same school everywhere
// and nothing is uploaded for it; the director runs its first CEM. A teachers'
// world, or one entered without the reference data, has no director's school.

import { directorSchool, seedNationalWorld, type DemoSchool } from '@minhajna/core';
import { useMemo } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { ReferenceResult } from '../reference';

/** The director's school in an open world, made once for each world, or null. */
export function useDirectorSchool(
  open: Pick<OpenWorld, 'world' | 'kind'> | null,
  reference: Extract<ReferenceResult, { ok: true }> | undefined,
): DemoSchool | null {
  const id = open?.kind === 'national' ? open.world : null;
  return useMemo(() => {
    if (id === null || reference === undefined) return null;
    const { zones = [], workingDays } = reference.profile;
    return directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs));
  }, [id, reference]);
}
