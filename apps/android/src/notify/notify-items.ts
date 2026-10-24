// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words and times of the notifications set ahead (#234, answers 403, 405
// and 406), from the core's plan: the digest says only that it is ready, since
// its figures are worked out when it opens; a preview gives the day's sessions,
// the first one's time and its class, «غداً» the evening before or «اليوم» that
// morning after a quiet evening; the backup reminder, on the day it falls due,
// says only that no backup was saved for 30 days (answer 482). No pupil is
// named and no mark given (R-6.4-06).

import {
  notifyPlan,
  parseDay,
  type Context,
  type Day,
  type NotifyChoices,
  type Planned,
  type WallTime,
} from '@minhajna/core';
import { courseLabel } from '../exams/course-label';
import type { PlannedNotification } from '../native/NativeMinhajnaNotify';
import type { AppData } from '../storage/AppData';
import type { useText } from '../text/i18n';
import { sessionTime } from '../times/times-rules';
import { isolate, slotSpoken } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;
type Data = Pick<AppData, 'state' | 'bells' | 'calendar'>;

/** Milliseconds since the epoch of a local time on the phone. */
export function epochOf(at: WallTime): number {
  const [year = 0, month = 1, day = 1] = at.day.split('-').map(Number);
  return new Date(year, month - 1, day, Math.floor(at.minutes / 60), at.minutes % 60).getTime();
}

/** The local time now. */
export function wallNow(date: Date): WallTime {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = parseDay(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  return { day, minutes: date.getHours() * 60 + date.getMinutes() };
}

/** A planned notification's words. */
function item(t: Translate, context: Context, data: Data, planned: Planned): PlannedNotification {
  const at = epochOf(planned.at);
  if (planned.kind === 'digest') {
    const title = t('digest.title');
    const id = `digest-${planned.at.day}`;
    return { id, at, channel: 'digest', channelName: title, title, text: t('notify.digestText'), open: 'digest' };
  }
  if (planned.kind === 'backup') {
    const channelName = t('settings.notify.backup');
    const [id, title, text] = [`backup-${planned.at.day}`, t('notify.backupTitle'), t('notify.backupText')];
    return { id, at, channel: 'backup', channelName, title, text, open: 'today' };
  }
  const [first] = planned.sessions;
  const schoolClass = first && context.state.classes.get(first.classId);
  const school = schoolClass && context.state.schools.get(schoolClass.schoolId);
  const time =
    first === undefined ? '' : (sessionTime(data, school, first.slot, planned.day)?.from ?? slotSpoken(t, first.slot));
  const words = {
    sessions: t('count.sessions', { count: planned.sessions.length }),
    time: isolate(time),
    class: isolate(first === undefined ? '' : courseLabel(t, context.state, context.ref.country, first.courseId)),
  };
  const title = t('notify.previewTitle');
  return {
    id: `preview-${planned.day}`,
    at,
    channel: 'preview',
    channelName: title,
    title,
    text: t(planned.at.day === planned.day ? 'notify.today' : 'notify.tomorrow', words),
    open: 'today',
  };
}

/** The notifications to set ahead from `now`, with their words, and the backup reminder's day if it is on. */
export function notifyItems(
  t: Translate,
  context: Context,
  data: Data,
  now: WallTime,
  choices: NotifyChoices,
  backup: Day | null = null,
): PlannedNotification[] {
  return notifyPlan(context, now, choices, backup).map((planned) => item(t, context, data, planned));
}
