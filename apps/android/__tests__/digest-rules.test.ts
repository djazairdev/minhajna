// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Digest's plan week for a week pack (#234, Digest-primary, answer
// 409): the week of the class's position beside the plan's, the same as the
// position's when the plan marks none, and nothing when the item has no
// week; and the line that says it.

import type { PlanRow } from '@minhajna/core';
import { planWeek } from '../src/digest/digest-rules';
import { i18n } from '../src/text/i18n';

test('a week pack’s plan week is the position’s, beside the plan’s', () => {
  const row = (week: number | undefined, position: boolean, expected: boolean) =>
    ({ item: { week }, position, expected }) as unknown as PlanRow;
  expect(planWeek([row(2, true, false), row(3, false, true)])).toEqual({ at: 2, expected: 3 });
  expect(planWeek([row(2, true, false)])).toEqual({ at: 2, expected: 2 });
  expect(planWeek([row(undefined, true, true)])).toBeUndefined();
  const t = i18n.t.bind(i18n);
  expect(t('digest.planWeek', { week: 2, expected: 3 })).toBe('في أسبوع المخطط 2، والمخطط اليوم في أسبوعه 3');
});
