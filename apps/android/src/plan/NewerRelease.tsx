// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class pinned to a release while a newer one of the same pack is in the
// app, bundled or added from a signed file (#223, R-4.2-12, answer 329): a
// row names the newer release and its fixes, and that the class stays on its
// own until it is moved; it opens «إصدار جديد للمخطط» to move it (#322).

import type { PinnedPack, PlanPack } from '@minhajna/core';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { useText } from '../text/i18n';
import { newerRow } from './release-rules';

export function NewerRelease({
  packs,
  pinned,
  onOpen,
  testID,
}: {
  packs: Iterable<PlanPack>;
  pinned: PinnedPack;
  onOpen: (release: string) => void;
  testID: string;
}) {
  const t = useText();
  const row = newerRow(t, packs, pinned);
  if (row === null) return null;
  return (
    <RowLink
      testID={testID}
      icon={controlIcon('info')}
      title={t('packRelease.title')}
      description={row.text}
      onPress={() => onOpen(row.release)}
    />
  );
}
