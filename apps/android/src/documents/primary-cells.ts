// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The cells a session fills in both primary journals, the class teacher's
// and a specialist's (#216, R-3.8-09, R-3.8-11), in the journal's language:
// - the activity the slot or the item names, when the app has a name for
//   it, or else the session type when it is not a lesson;
// - the content: the session's resources, how it went unless as proposed,
//   and its remarks;
// - the domain: the item's unit; the lesson note's number is left for the
//   pen until the app keeps lesson notes.
// A session awaiting confirmation gives what confirming it would record.

import {
  courseSetup,
  findPackItem,
  type Context,
  type CourseSetup,
  type PlanPack,
  type TodaySession,
} from '@minhajna/core';
import type { BookLine } from '../entry/book-lines';
import { isolate } from '../week/grid-labels';
import { dayTitle, type DocumentData, type Translate } from './document-data';
import { journalLines, proposedRecord, type JournalNames } from './journal-lines';

/** The activities the app names; another code leaves the activity for the pen. */
const ACTIVITIES = ['reading', 'writing'] as const;

export interface SessionCells {
  readonly setup: CourseSetup;
  readonly activity: string;
  readonly content: readonly BookLine[];
  readonly domain: string;
  readonly awaiting: boolean;
}

function unitOf(pack: PlanPack | null, itemId: string | undefined): string | undefined {
  const unit = itemId === undefined ? undefined : findPackItem(pack, itemId)?.unit;
  return unit === undefined ? undefined : pack?.items.find((one) => one.id === unit)?.title;
}

/** A session's activity, content and domain, with `data` and `t` in the journal's language. */
export function sessionCells(data: DocumentData, t: Translate, context: Context, item: TodaySession): SessionCells {
  const names: JournalNames = {
    type: (code) => data.profile.sessionTypes.find((one) => one.code === code)?.name[data.lang] ?? code,
    day: (day) => dayTitle(data, t, day),
  };
  const setup = courseSetup(context, item.course.id);
  const awaiting = item.record === null;
  const record = item.record ?? proposedRecord(item.session, item.proposal);
  const first = record.coverage[0]?.item;
  const code = item.session.activity ?? findPackItem(setup.pack, first)?.activity;
  const activity = ACTIVITIES.find((one) => one === code);
  const unit = unitOf(setup.pack, first);
  return {
    setup,
    activity:
      activity !== undefined
        ? t(`documents.primaryJournal.activities.${activity}`)
        : record.sessionType === 'lesson'
          ? ''
          : names.type(record.sessionType),
    content: journalLines(t, names, setup.pack, record, awaiting, { heads: true, done: true }),
    domain: unit === undefined ? '' : isolate(unit),
    awaiting,
  };
}
