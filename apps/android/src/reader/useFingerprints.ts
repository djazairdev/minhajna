// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The fingerprints of the keys that signed the statements shown (#246),
// worked out on the phone as the Share screen's own (#437); a key whose
// fingerprint is not known yet is missing from the map, and one that cannot
// be worked out maps to null.

import { useEffect, useState } from 'react';
import { teacherKeyFingerprint } from '../sharing/teacher-key';

export function useFingerprints(spkis: readonly string[]): ReadonlyMap<string, string | null> {
  const [known, setKnown] = useState<ReadonlyMap<string, string | null>>(new Map());
  const wanted = [...new Set(spkis)].sort().join('\n');
  useEffect(() => {
    let live = true;
    const keys = wanted === '' ? [] : wanted.split('\n');
    void Promise.all(
      keys.map((spki) =>
        teacherKeyFingerprint(spki).then(
          (value) => [spki, value] as const,
          () => [spki, null] as const,
        ),
      ),
    ).then((pairs) => {
      if (live) setKnown(new Map(pairs));
    });
    return () => {
      live = false;
    };
  }, [wanted]);
  return known;
}
