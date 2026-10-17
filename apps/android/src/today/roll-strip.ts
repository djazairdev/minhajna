// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll call inside a session's card on Today (#38): «لا غياب مسجّل»
// until it is taken, then what it recorded, and «المناداة», which opens it.
// Lessons and the register are joined by the session (PRD §2.5). A session
// recorded as not held has no roll call to take.

import { current, type Context, type Session } from '@minhajna/core';
import type { DueStripProps } from '../components/DueStrip';
import { controlIcon } from '../design/Icon';
import type { useText } from '../text/i18n';
import { recordedMarks, unitOf } from '../roll/roll-rules';

/** The strip for a session's roll call, or none where it has no roll call. */
export function rollStrip(
  t: ReturnType<typeof useText>,
  context: Context,
  session: Session,
  onOpen: (session: Session) => void,
): DueStripProps[] {
  const unit = unitOf(context, session.key, session.day);
  if (unit === null) return [];
  const marks = recordedMarks(context, unit);
  if (marks === null && current(context.state.sessions.get(session.key))?.outcome === 'not-held') return [];
  const fact =
    marks === null
      ? t('roll.none')
      : marks.absent.length + marks.late.length === 0
        ? t('roll.allPresent')
        : t('roll.marked', { absent: marks.absent.length, late: marks.late.length });
  return [
    {
      icon: controlIcon('pupils'),
      fact,
      action: t('roll.title'),
      onOpen: () => onOpen(session),
      testID: `today-${session.key}-roll`,
    },
  ];
}
