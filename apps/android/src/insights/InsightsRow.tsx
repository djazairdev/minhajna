// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights' row on the teacher's world home (#624, answer 695), as
// Settings' sharing section draws it in Settings-school and Settings-retired:
// its name, and under it whether they are off until the teacher turns them on,
// or on (#622), stopped for the school space's classes, or retired, the
// national system's totals replacing them. It opens the insights page.

import type { InsightsState } from '@minhajna/core';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { useDeviceText } from '../text/device-text';

export type InsightsRowProps = {
  readonly state: InsightsState;
  /** Whether the teacher of a teachers' world has turned them on. */
  readonly on: boolean;
  readonly onPress: () => void;
};

/** The insights' name and state, opening their page. */
export function InsightsRow({ state, on, onPress }: InsightsRowProps) {
  const t = useDeviceText();
  return (
    <RowLink
      testID="world-insights-open"
      icon={controlIcon('no_tracking')}
      title={t('demo.insights.title')}
      description={t(state.kind === 'teacher' && on ? 'demo.insights.row.on' : `demo.insights.row.${state.kind}`)}
      onPress={onPress}
    />
  );
}
