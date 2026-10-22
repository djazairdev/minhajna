// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// 5 ابتدائي أ with its Arabic pinned to a stale release of the example pack
// (#230, Plan-stale): the release 2022.1, with a made-up reason, or none.

import { parseDay, type PlanPack } from '@minhajna/core';
import type { TestData } from './app-data';
import { withPrimary } from './primary-class';

export const staleReason = {
  ar: 'غيّر قرار لاحق ساعات المادة (مثال)',
  fr: 'Une décision a changé les heures (exemple)',
  en: 'A decision changed the hours (example)',
};

/** The class with its Arabic, `a-1`, on the stale release; `reason` false leaves the pack without one. */
export async function withStale(reason = true): Promise<TestData> {
  const data = await withPrimary();
  const example = data.packs.find((one) => one.id === 'dz.primary.5ap.arabic.example');
  if (example === undefined) throw new Error('No example pack');
  const stale: PlanPack = {
    ...example,
    release: '2022.1',
    status: 'stale',
    ...(reason && { staleReason }),
  };
  const arabic = data.book.state.courses.get('a-1');
  if (arabic !== undefined)
    await data.book.record(parseDay('2026-10-15'), {
      kind: 'course.set',
      course: { ...arabic, pack: { id: stale.id, release: '2022.1' } },
    });
  return { ...data, packs: [...data.packs, stale] };
}
