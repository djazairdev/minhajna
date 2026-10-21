// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words of the catch-up options' figures (#228, answer 351): the
// buffers used and left before the next exams, or that none are used, none
// left, all spent or none in the pack, or that an own list has none; and
// TD's own sessions and items left, with none of either. A count never
// stands where a verb needs a number of sessions above zero.

import type { CatchUp } from '@minhajna/core';
import { termName } from '../exams/course-label';
import type { useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

/** Rung 2: the buffers before the next exams, as facts. */
export function buffersLine(t: Translate, options: CatchUp): string {
  const sessions = (count: number) => t('planDetails.sessions', { count });
  if (options.own) return t('catchUp.ownBuffers');
  if (options.term === null) return t('catchUp.noExams');
  const term = termName(t, options.term);
  const { bufferUsed: used, bufferLeft: left } = options;
  if (!options.hasBuffers) return t('catchUp.noBuffers', { term });
  if (used === 0 && left === 0) return t('catchUp.buffersSpent', { term });
  if (used === 0) return t('catchUp.buffersUnused', { left: sessions(left), term });
  if (left === 0) return t('catchUp.buffersAllUsed', { used: sessions(used), term });
  return t('catchUp.buffersLine', { used: sessions(used), left: sessions(left), term });
}

/** TD's own sessions and items left before the next exams. */
export function tdLine(t: Translate, td: NonNullable<CatchUp['td']>): string {
  if (td.items === 0) return t('catchUp.tdDone');
  const items = t('planFree.items', { count: td.items });
  if (td.gives === 0) return t('catchUp.tdNone', { items });
  return t('catchUp.td', { gives: t('planDetails.sessions', { count: td.gives }), items });
}
