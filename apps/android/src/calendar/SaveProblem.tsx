// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { useText } from '../text/i18n';

/** A failed write or an out-of-date preview never appears as a successful save. */
export function SaveProblem({ problem, testID }: { problem: 'failed' | 'changed' | null; testID: string }) {
  const t = useText();
  return problem === null ? null : (
    <Notice testID={testID} icon={controlIcon('info')} message={t(`calendarView.edit.${problem}`)} />
  );
}
