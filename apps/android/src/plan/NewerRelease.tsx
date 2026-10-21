// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class pinned to a release while a newer one of the same pack is in the
// app, bundled or added from a signed file (#223, R-4.2-12, answer 329): a
// badge names the newer release, and the class stays on its own until it
// is moved, which waits for #322.

import { newerRelease, type PinnedPack, type PlanPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';

export function NewerRelease({
  packs,
  pinned,
  testID,
}: {
  packs: Iterable<PlanPack>;
  pinned: PinnedPack;
  testID: string;
}) {
  const t = useText();
  const { direction } = useLocale();
  const newer = newerRelease(packs, pinned);
  if (newer === null) return null;
  return (
    <View testID={testID} style={{ gap: spacing['space-4'], alignItems: 'flex-start' }}>
      <Badge label={t('plan.newerBadge', { release: newer.release })} />
      <Text style={[styles.sub, { writingDirection: direction, textAlign: 'start' }]}>
        {t('plan.newerStays', { current: pinned.release })}
      </Text>
    </View>
  );
}
