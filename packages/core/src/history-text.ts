// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalJson } from './canonical.ts';
import type { Entry } from './history.ts';

/** The existing version-1 content preimage, shared by writing and read-only inspection. */
export function contentText(salt: string, bodyText: string): string {
  return `minhajna/content/1\n${salt}\n${bodyText}`;
}

/** The existing version-1 header preimage; moving this helper changes no stored hash or format. */
export function headerText(entry: Omit<Entry, 'hash' | 'content'>): string {
  const { id, seq, day, layer, kind, digest, previous } = entry;
  return `minhajna/entry/1\n${canonicalJson({ id, seq, day, layer, kind, digest, previous })}`;
}
