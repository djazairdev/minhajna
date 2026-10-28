// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the PC's week says (#251, Web-week, answer 526), in Today's own words:
// for each session its class, its time, its lesson, recorded, proposed or taken
// by the calendar, its state, a session still to come being proposed and an
// earlier one awaiting confirmation, and where a continued lesson goes on from;
// the week's title, its days, today's named, and each row's time, from the
// first session in it, else the slot's name.

import {
  courseSetup,
  weekday,
  type Context,
  type Day,
  type Slot,
  type TodaySession,
  type TodayView,
  type WeekView,
} from '@minhajna/core';
import { listWritten } from '../../today/ListCard';
import { lessonOf, writtenOf } from '../../today/today-labels';
import { sessionMeta, type MetaData } from '../../today/today-meta';
import { dayAndMonth, takenBy } from '../../today/DayMark';
import type { Language, useText } from '../../text/i18n';

type Translate = ReturnType<typeof useText>;

export type CellKind = 'recorded' | 'pencil' | 'calendar';

export interface SessionText {
  readonly className: string;
  readonly time: string;
  readonly lesson: string;
  /** Where a continued lesson goes on from. */
  readonly note?: string;
  readonly kind: CellKind;
  readonly state: string;
}

export interface WeekWords {
  readonly data: MetaData;
  readonly context: Context;
  readonly t: Translate;
  readonly direction: 'rtl' | 'ltr';
  readonly language: Language;
  readonly today: Day;
}

/** A session as the week shows it. */
export function sessionText(words: WeekWords, view: TodayView, item: TodaySession): SessionText {
  const { data, context, t, direction, language, today } = words;
  const meta = sessionMeta(data, t, direction, item, false);
  const head = { className: meta.className, time: meta.slot };
  if (item.status === 'calendar') {
    return { ...head, lesson: takenBy(t, view, item), kind: 'calendar', state: t('pcWeek.state.calendar') };
  }
  if (item.record !== null) {
    const comma = language === 'ar' ? '\u060c ' : ', ';
    const lesson = listWritten(t, data.state, item.record) ?? writtenOf(t, context, item.record, comma);
    return { ...head, lesson, kind: 'recorded', state: t('pcWeek.state.recorded') };
  }
  const { lesson, note } = lessonOf(t, item, courseSetup(context, item.course.id).pack);
  const state = t(item.session.day > today ? 'pcWeek.state.proposed' : 'pcWeek.state.awaiting');
  return { ...head, lesson, ...(note !== undefined && { note }), kind: 'pencil', state };
}

/** «الأسبوع من 4 إلى 8 أكتوبر 2026», naming both months when the week spans two. */
export function weekTitle(words: WeekWords, week: WeekView): string {
  const { t, language, data } = words;
  const first = week.days[0]?.day ?? week.start;
  const last = week.days[week.days.length - 1]?.day ?? week.start;
  const from =
    first.slice(0, 7) === last.slice(0, 7)
      ? String(Number(first.slice(8)))
      : dayAndMonth(first, language, data.profile);
  return t('pcWeek.title', { from, to: `${dayAndMonth(last, language, data.profile)} ${last.slice(0, 4)}` });
}

/** A day's head: its name and its date in the month, and «اليوم» for today, so it is not marked by colour alone. */
export function dayHead(t: Translate, day: Day, today?: Day): string {
  const head = `${t(`week.days.${weekday(day)}`)} ${Number(day.slice(8))}`;
  return day === today ? `${head} · ${t('navigation.today')}` : head;
}

/** A row's time, from its first session, else the slot's short name. */
export function rowLabel(words: WeekWords, week: WeekView, slot: Slot): string {
  for (const view of week.days) {
    const item = view.sessions.find(
      (one) => one.session.slot.half === slot.half && one.session.slot.index === slot.index,
    );
    if (item !== undefined) return sessionMeta(words.data, words.t, words.direction, item, false).slot;
  }
  return words.t(slot.half === 'morning' ? 'week.slotMorning' : 'week.slotAfternoon', { index: slot.index });
}
