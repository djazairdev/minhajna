// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's own list offered for review as a community pack (#227,
// Plan-offer, R-4.2-21, answer 347): the level, grade, subject and school
// year it was typed for, the source «own work», its items in order, the
// licence CC BY-SA 4.0, and the credit, none or a name the teacher types,
// with the day it was offered and each item's ID, which ties a published
// pack back to the list. Nothing from sessions, the class, the school or
// pupils goes, and no day the list began or the class reached. The
// teacher sends the file through the share sheet; the curators read it
// back with `readListOffer`.

import { isOneLine } from './calendar-notice-read.ts';
import { canonicalJson } from './canonical.ts';
import type { Context } from './context.ts';
import { isDay, type Day } from './day.ts';
import { FREE_ITEMS_MAX, freeItemFits, type FreeItem } from './free-list.ts';
import { isFields, type Fields } from './read.ts';
import { utf8Length } from './signed-read.ts';
import type { CountryProfile } from './reference.ts';

export const LIST_OFFER_FORMAT = 'minhajna-list-offer';
export const LIST_OFFER_LICENCE = 'CC-BY-SA-4.0';
export const OFFER_CREDIT_MAX = 80;
/** As large as a file the app reads or shares. */
export const LIST_OFFER_BYTES = 1_048_576;

export interface ListOffer {
  readonly country: string;
  readonly level: string;
  readonly grade: string;
  readonly subject: string;
  /** The school year, such as `2026-2027`. */
  readonly year: string;
  readonly source: 'own-work';
  readonly licence: typeof LIST_OFFER_LICENCE;
  /** The name to credit, or null to credit no one by name. */
  readonly credit: string | null;
  readonly made: Day;
  readonly items: readonly FreeItem[];
}

const YEAR = /^(\d{4})-(\d{4})$/;
const KEYS = ['format', 'version', 'country', 'level', 'grade', 'subject', 'year', 'source', 'licence', 'credit'];

/** The offer of a course's saved list, made on `made`; null without a list, items or a credit that fits. */
export function listOffer(context: Context, courseId: string, credit: string | null, made: Day): ListOffer | null {
  const { ref, state } = context;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  const list = state.lists.get(courseId);
  if (course === undefined || schoolClass === undefined || list === undefined || course.pack !== null) return null;
  if (list.items.length === 0 || (credit !== null && !isOneLine(credit, OFFER_CREDIT_MAX))) return null;
  return {
    country: ref.country.code,
    level: schoolClass.level,
    grade: course.grade ?? schoolClass.grade,
    subject: course.subject,
    year: course.year,
    source: 'own-work',
    licence: LIST_OFFER_LICENCE,
    credit,
    made,
    items: list.items.map(({ id, kind, title, sessions, stages }) => ({
      id,
      kind,
      title,
      ...(sessions !== undefined && { sessions }),
      ...(stages !== undefined && { stages }),
    })),
  };
}

/** The offer as the file the teacher shares, or null when it would not read back. */
export function listOfferFile(offer: ListOffer, profile: CountryProfile): string | null {
  const text = JSON.stringify({ format: LIST_OFFER_FORMAT, version: { major: 1, minor: 0 }, ...offer });
  const read = readListOffer(text, profile);
  return typeof read === 'string' || canonicalJson(read) !== canonicalJson(offer) ? null : text;
}

function itemOf(raw: unknown): FreeItem | undefined {
  if (!isFields(raw)) return undefined;
  const { id, kind, title, sessions, stages } = raw;
  if (typeof id !== 'string' || typeof kind !== 'string' || typeof title !== 'string') return undefined;
  if (sessions !== undefined && typeof sessions !== 'number') return undefined;
  if (stages !== undefined && !(Array.isArray(stages) && stages.every((one) => typeof one === 'string'))) {
    return undefined;
  }
  if (Object.keys(raw).some((key) => !['id', 'kind', 'title', 'sessions', 'stages'].includes(key))) return undefined;
  const item = raw as unknown as FreeItem;
  return freeItemFits(item) ? item : undefined;
}

function codesFit(input: Fields, profile: CountryProfile): boolean {
  const level = profile.levels.find((one) => one.code === input['level']);
  const year = typeof input['year'] === 'string' ? YEAR.exec(input['year']) : null;
  return (
    input['country'] === profile.code &&
    level !== undefined &&
    level.grades.some((one) => one.code === input['grade']) &&
    profile.subjects.some((one) => one.code === input['subject']) &&
    year !== null &&
    Number(year[2]) === Number(year[1]) + 1
  );
}

/** Reads an offer file back, or says why it cannot: `invalid` for any field out of place. */
export function readListOffer(text: string, profile: CountryProfile): ListOffer | 'invalid' | 'version' {
  const bytes = text.length > LIST_OFFER_BYTES ? null : utf8Length(text);
  if (bytes === null || bytes > LIST_OFFER_BYTES) return 'invalid';
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return 'invalid';
  }
  if (!isFields(input) || input['format'] !== LIST_OFFER_FORMAT) return 'invalid';
  const version = input['version'];
  if (!isFields(version) || version['major'] !== 1) return 'version';
  const { credit, made, items } = input;
  if (
    !codesFit(input, profile) ||
    input['source'] !== 'own-work' ||
    input['licence'] !== LIST_OFFER_LICENCE ||
    !(credit === null || isOneLine(credit, OFFER_CREDIT_MAX)) ||
    typeof made !== 'string' ||
    !isDay(made) ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > FREE_ITEMS_MAX ||
    Object.keys(input).some((key) => ![...KEYS, 'made', 'items'].includes(key))
  ) {
    return 'invalid';
  }
  const read = items.map(itemOf);
  const ids = new Set(read.map((item) => item?.id));
  if (read.some((item) => item === undefined) || ids.size !== read.length) return 'invalid';
  return {
    country: profile.code,
    level: input['level'] as string,
    grade: input['grade'] as string,
    subject: input['subject'] as string,
    year: input['year'] as string,
    source: 'own-work',
    licence: LIST_OFFER_LICENCE,
    credit,
    made,
    items: read as FreeItem[],
  };
}
