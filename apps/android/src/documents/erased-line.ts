// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The line under a class's roll-call book and mark sheets once a pupil's
// data was erased (#248, Pupil-erase, answer 473): «حُذفت بيانات تلميذ واحد»,
// on the books of every period that began before the pupil left (answer
// 474), where their line no longer shows. The erasure keeps the class but not
// the level group, so on a joint class each group's book says it.

import { erasedFrom, type Day, type State } from '@minhajna/core';
import type { Translate } from './document-data';

/** The line for the class's book of a period from `from`, or '' when none of its erased pupils could be on it. */
export function erasedLine(t: Translate, state: Pick<State, 'erasedPupils'>, classId: string, from: Day): string {
  const count = erasedFrom(state.erasedPupils, classId, from);
  return count === 0 ? '' : t('documents.erased', { count });
}
