// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reference data is public and versioned, and comes from the data repository
// (PRD §4.10, §5.3). Country specifics live here as data, never as code
// (PRD §1.14): the core knows no Algerian rule.

import type { Day, Weekday } from './day.ts';
import type { PlanPack } from './pack.ts';

/** A text in several languages, keyed by language code, such as `ar`, `fr` or `en`. */
export type LocalizedText = Readonly<Record<string, string>>;

/** How a session type moves the plan (PRD §4.7). */
export const QUEUES = [
  /** The main plan. */
  'main',
  /** TD sessions have their own queue, which never advances the main plan. */
  'td',
  /** No plan item is proposed: the teacher records what was done. */
  'none',
] as const;

export type Queue = (typeof QUEUES)[number];

export interface SessionType {
  readonly code: string;
  readonly queue: Queue;
  readonly name: LocalizedText;
}

/** Whether roll call is taken per half-day or per session (PRD §3.4). */
export const ROLL_CALL_UNITS = ['half-day', 'session'] as const;

export type RollCallUnitKind = (typeof ROLL_CALL_UNITS)[number];

/** A year of a level, such as the first year of middle school. Its code is unique in the profile. */
export interface Grade {
  readonly code: string;
  readonly name: LocalizedText;
}

export interface Level {
  readonly code: string;
  readonly rollCallUnit: RollCallUnitKind;
  /** The usual session length, used to turn hour budgets into sessions (PRD §4.7). */
  readonly sessionMinutes: number;
  readonly name: LocalizedText;
  /** In order, from the first year to the last. */
  readonly grades: readonly Grade[];
}

/** A zone the teacher picks at setup, such as one of Algeria's wilayas: it picks the calendar's zone layer. */
export interface Zone {
  /** As the zone layer names it, such as `16`. */
  readonly code: string;
  readonly name: LocalizedText;
}

export interface Subject {
  readonly code: string;
  readonly name: LocalizedText;
  /** The levels that teach it. */
  readonly levels: readonly string[];
  /** The language it is taught in, as a language code such as `fr`, when not the profile's. */
  readonly language?: string;
  /**
   * The levels where a specialist teaches it, so the class teacher's journal leaves it out and the specialist keeps
   * their own; `primary` for French, for example (PRD §3.8, R-3.8-11).
   */
  readonly specialist?: readonly string[];
}

/** A Gregorian month's names in each interface language. */
export type MonthNames = Readonly<Record<'ar' | 'fr' | 'en', string>>;

export interface CountryProfile {
  /** The country code, such as `dz`. */
  readonly code: string;
  /** The profile's release, such as `2026.1`. */
  readonly release: string;
  /** The first day of the school week. The working week is a setting, not an assumption (PRD §1.14). */
  readonly weekStartsOn: Weekday;
  readonly workingDays: readonly Weekday[];
  /** January to December; absent only in older profiles. Named dates require this data. */
  readonly months?: readonly MonthNames[];
  readonly levels: readonly Level[];
  /** The language subjects are taught in, unless a subject names its own; absent only in older profiles. */
  readonly language?: string;
  readonly subjects: readonly Subject[];
  readonly sessionTypes: readonly SessionType[];
  /** In the order the teacher sees them; absent only in older profiles. */
  readonly zones?: readonly Zone[];
}

export interface Term {
  readonly number: number;
  readonly from: Day;
  readonly to: Day;
}

export interface SchoolYear {
  /** Written as the documents print it, such as `2026-2027`. */
  readonly id: string;
  readonly from: Day;
  readonly to: Day;
  readonly terms: readonly Term[];
  /** The texts or notices the dates come from. */
  readonly source: string;
}

/** The four calendar layers, from broadest to narrowest (PRD §4.5). */
export const CALENDAR_LAYERS = ['national', 'zone', 'school', 'teacher'] as const;

export type CalendarLayer = (typeof CALENDAR_LAYERS)[number];

export const CALENDAR_EFFECTS = [
  /** Holidays: no sessions. */
  'no-school',
  /** Closures and suspensions: the sessions are lost, and counted apart. */
  'closure',
  /** Exam windows: the exam replaces the sessions. */
  'exam',
  /** Seminars, councils and other events: marked on Today, sessions unchanged. */
  'marker',
  /** The teaching week that holds the entry's first day is an A week, or a B week. */
  'week-a',
  'week-b',
  /** A make-up, support or revision day: sessions on a weekday's timetable, even on a day off (PRD §4.5, §7.7). */
  'adds-sessions',
  'rotating-groups',
] as const;

export type CalendarEffect = (typeof CALENDAR_EFFECTS)[number];

/**
 * What a day that adds sessions is for. Make-up sessions are plan sessions
 * and move the plan; support and revision sessions do not, and go on the
 * texts book's page for supervised or additional lessons (R-3.3-18, R-4.5-08).
 */
export const ADDED_KINDS = ['make-up', 'support', 'revision'] as const;

export type AddedKind = (typeof ADDED_KINDS)[number];

/** Whose bell times apply on an entry's days, when not the usual ones: Ramadan's (PRD §4.5). */
export const CALENDAR_TIMES = ['ramadan'] as const;

export type CalendarTimes = (typeof CALENDAR_TIMES)[number];

/** Announced, expected (such as lunar dates, give or take a day) or projected (PRD §4.5). */
export const CONFIDENCES = ['announced', 'expected', 'projected'] as const;

export type Confidence = (typeof CONFIDENCES)[number];

export interface CalendarEntry {
  readonly id: string;
  readonly layer: CalendarLayer;
  /** For the zone layer: the zone or wilaya it covers. */
  readonly zone?: string;
  /** For the school layer: the school it covers. */
  readonly schoolId?: string;
  readonly from: Day;
  /** The last day, included. */
  readonly to: Day;
  /** Local entries only: the same half of every included day; omitted means the whole day. */
  readonly half?: 'morning' | 'afternoon';
  readonly effect: CalendarEffect;
  /** Local class rule; pupil identities and membership never belong in the calendar. */
  readonly rotation?: { readonly classId: string; readonly groups: readonly [string, string] };
  /** Only these levels, if set. */
  readonly levels?: readonly string[];
  /** Only these grades, if set. */
  readonly grades?: readonly string[];
  /** For an exam window: the term it closes. */
  readonly term?: number;
  /** Ramadan: its days take Ramadan's bell times, and keep their sessions. */
  readonly times?: CalendarTimes;
  /** For a day that adds sessions: what they are for. */
  readonly adds?: AddedKind;
  /** For a day that adds sessions: the weekday whose timetable it follows. */
  readonly follows?: Weekday;
  /**
   * For a day that adds sessions: the weekday's sessions it takes, as the
   * teacher chose them, each as `takeKey` gives it, so a redrawn week keeps
   * them; all of the weekday's for the week otherwise.
   */
  readonly takes?: readonly string[];
  /** For a make-up day: the closure whose sessions it makes up for. */
  readonly replaces?: string;
  readonly name: LocalizedText;
  /** The text or notice it comes from. */
  readonly source: string;
  readonly confidence: Confidence;
  /** For an entry an update moved: the dates it had before, and why it moved (R-7.10-06). */
  readonly moved?: { readonly from: Day; readonly to: Day; readonly reason: string };
  /** A lunar holiday whose date is fixed by a sighting, not merely any expected entry. */
  readonly lunar?: true;
  /** Local confirmation only: the exact canonical reference entry it confirms, never a signature. */
  readonly confirmedFrom?: string;
  /** Unverified claims retained from an explicitly accepted single-entry notice, never a signature. */
  readonly received?: {
    readonly sender: string;
    readonly school?: { readonly name: string; readonly zone: string; readonly code?: string };
  };
}

/** A school year and its calendar entries, as one release of reference data (PRD §4.5, §4.8). */
export interface SchoolCalendar {
  readonly country: string;
  readonly release: string;
  readonly year: SchoolYear;
  readonly entries: readonly CalendarEntry[];
}

/** Everything the app receives as reference data, rather than records the teacher keeps. */
export interface Reference {
  readonly country: CountryProfile;
  readonly year: SchoolYear;
  /** The national, zone and school layers, as received. */
  readonly calendar: readonly CalendarEntry[];
  /** The release of the calendar the app was built with, which signed updates follow (#223). */
  readonly calendarRelease?: string;
  /** The IDs of the entries applied updates replaced or took out: a received copy of one no longer applies. */
  readonly updatedIds?: readonly string[];
  /** Keyed by `packKey(id, release)`. */
  readonly packs: ReadonlyMap<string, PlanPack>;
}

export function packKey(id: string, release: string): string {
  return `${id}@${release}`;
}

export function findLevel(country: CountryProfile, code: string): Level {
  const level = country.levels.find((candidate) => candidate.code === code);
  if (level === undefined) throw new Error(`Unknown level: ${code}`);
  return level;
}

export function findSessionType(country: CountryProfile, code: string): SessionType {
  const type = country.sessionTypes.find((candidate) => candidate.code === code);
  if (type === undefined) throw new Error(`Unknown session type: ${code}`);
  return type;
}
