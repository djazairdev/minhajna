// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Homework that comes back today, inside a session's card on Today (#214,
// PRD §3.3): «يُسلَّم اليوم» with the homework's own words until the teacher
// counts it, then the two counts, and «إحصاء», which opens the record. It
// shows on the day's first session of the course's group that is held,
// since the homework comes back once. A card's strips are its homework, then its roll
// call.

import { current, homeworkDue, sessionsBetween, type Context, type HomeworkItem, type Session } from '@minhajna/core';
import type { DueStripProps } from '../components/DueStrip';
import { controlIcon } from '../design/Icon';
import type { useText } from '../text/i18n';
import { rollStrip } from '../today/roll-strip';
import { isolate } from '../week/grid-labels';

/** A card's strips: the homework that comes back in its sessions, then the roll call of the first. */
export function dueStrips(
  t: ReturnType<typeof useText>,
  context: Context,
  sessions: readonly Session[],
  onRoll: (session: Session) => void,
  onHomework: (item: HomeworkItem) => void,
): DueStripProps[] {
  const [first] = sessions;
  if (first === undefined) return [];
  return [
    ...sessions.flatMap((session) => homeworkStrips(t, context, session, onHomework)),
    ...rollStrip(t, context, first, onRoll),
  ];
}

/** The strips for the homework that comes back in `session`, or none. */
export function homeworkStrips(
  t: ReturnType<typeof useText>,
  context: Context,
  session: Session,
  onOpen: (item: HomeworkItem) => void,
): DueStripProps[] {
  const due = homeworkDue(context, session.courseId, session.groupId, session.day);
  if (due.length === 0) return [];
  const held = (other: Session) => current(context.state.sessions.get(other.key))?.outcome !== 'not-held';
  const first = sessionsBetween(context, session.day, session.day, new Set([session.courseId])).find(
    (other) => other.groupId === session.groupId && other.calendar === null && held(other),
  );
  if (first?.key !== session.key) return [];
  return due.map((item) => ({
    icon: controlIcon('homework'),
    fact:
      item.count === null
        ? t('homework.dueToday', { text: isolate(item.text) })
        : t('homework.counted', { notDone: item.count.notDone, reliedOn: item.count.reliedOn }),
    action: t('homework.count'),
    onOpen: () => onOpen(item),
    testID: `today-${session.key}-homework-${item.session.key}`,
  }));
}
