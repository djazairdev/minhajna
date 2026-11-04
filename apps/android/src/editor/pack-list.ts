// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curator's catalogue (#611, R-4.2-23) keeps every source release,
// including earlier releases and stale packs. It never reads a teacher's
// state or offers their own lists. Status is the source status stored on
// that release, not a lifecycle state inferred from its release number.

import { compareReleases, parsePackId, type PlanPack } from '@minhajna/core';

export function editorPacks(packs: readonly PlanPack[]) {
  return packs
    .flatMap((pack) => {
      const parts = parsePackId(pack.id);
      return pack.status === 'own' || parts === null ? [] : [{ pack, parts }];
    })
    .sort((a, b) => a.pack.id.localeCompare(b.pack.id) || compareReleases(b.pack.release, a.pack.release));
}
