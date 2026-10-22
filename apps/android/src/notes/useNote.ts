// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A session's lesson note for the note screens (#237, answers 419 and 420): the
// session, its class, subject and time, the plan's draft and the note kept, and
// a change kept at once. The first change makes the note, with the next number
// of its class. Each change is made from the note as saved after every earlier
// change, so two quick taps never make two notes or lose one.

import {
  courseSetup,
  earlierNote,
  nextNoteNumber,
  noteDraft,
  noteFor,
  todayView,
  weekday,
  formatDay,
  type Day,
  type LessonNote,
  type NoteDraft,
  type TodaySession,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { sessionTime } from '../times/times-rules';
import { noteSubject, sessionItem } from './note-rules';

export interface NoteSession {
  readonly item: TodaySession;
  readonly itemId: string;
  readonly draft: NoteDraft;
  readonly note: LessonNote | undefined;
  /** The note's number, or the one it will take. */
  readonly number: number;
  /** The class, the day and the session's time. */
  readonly scope: string;
  /** An earlier year's written note for the same lesson, to reuse. */
  readonly earlier: LessonNote | undefined;
  /** Keeps the note as `change` makes it from the newest one, or from a new one. */
  readonly keep: (change: (note: LessonNote) => LessonNote) => void;
}

/** The note of the session `sessionKey` on `day`, or null when the session has no lesson from the plan. */
export function useNote(sessionKey: string, day: Day): NoteSession | null {
  const t = useText();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, bells, recordFrom, newId } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  return useMemo(() => {
    const item = todayView(context, day).sessions.find((one) => one.session.key === sessionKey);
    const itemId = item === undefined ? null : sessionItem(item);
    const courseId = item?.session.courseId;
    const draft = courseId === undefined || itemId === null ? null : noteDraft(context, courseId, itemId);
    if (item === undefined || courseId === undefined || itemId === null || draft === null) return null;
    const { schoolClass, course } = courseSetup(context, courseId);
    const school = state.schools.get(schoolClass.schoolId);
    const time = sessionTime({ bells, calendar, state }, school, item.session.slot, day);
    const note = noteFor(state, courseId, itemId);
    const keep = (change: (one: LessonNote) => LessonNote) =>
      recordFrom((newest) => {
        const base = noteFor(newest, courseId, itemId) ?? {
          id: `note-${newId()}`,
          courseId,
          itemId,
          number: nextNoteNumber(newest, courseId),
          paragraphs: [],
        };
        return { kind: 'lesson-note.set', note: change(base) };
      });
    return {
      item,
      itemId,
      draft,
      note,
      number: note?.number ?? nextNoteNumber(state, courseId),
      scope: [
        schoolClass.name,
        noteSubject(t, profile, currentLanguage(), course, schoolClass),
        `${t(`week.days.${weekday(day)}`)} ${formatDay(day)}`,
        time === null ? null : span(time.from, time.to, direction),
      ]
        .filter(Boolean)
        .join(' · '),
      earlier: earlierNote(state, courseId, itemId),
      keep,
    };
  }, [context, day, sessionKey, state, bells, calendar, profile, t, direction, recordFrom, newId]);
}
