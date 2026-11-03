// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's calendar page's state on its PC (#607, §4.5, R-4.5-18, answer
// 623): the world's calendar, its national and wilaya entries as the latest
// release the world holds gives them (#608), and the draft kept last in the
// world's store, or none, or none and set aside when it no longer reads against
// that calendar. Saving reads the draft as a calendar update first, so a change
// that could not be published is refused in the page's words, apart for a draft
// too heavy to sign, before anything is kept; it then keeps it in the world's
// store under the world's date and shows it, and says so, telling the caller
// whether it was kept. Saving says it is saving, so a second press waits; a
// problem keeping it is said in the catalogue's words, and the draft shown
// stays as it was. Each problem is counted, so the same one twice is said
// twice.

import {
  keptCalendarDraft,
  readCalendarDraft,
  type CalendarDraft,
  type CalendarEntry,
  type SchoolCalendar,
} from '@minhajna/core';
import { useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { ReferenceResult } from '../reference';
import { problemOf } from '../school/school-join-session';

type Reference = Extract<ReferenceResult, { ok: true }>;

/** The entries of the world's calendar the Ministry keys: the national and wilaya ones. */
export function ministryBase(calendar: SchoolCalendar): CalendarEntry[] {
  return calendar.entries.filter((entry) => entry.layer === 'national' || entry.layer === 'zone');
}

/** What the page's words say went wrong. */
export type DeskProblem =
  'demo.ministryCalendar.refused' | 'demo.ministryCalendar.tooBig' | ReturnType<typeof problemOf>;

/** What the Ministry's calendar page shows, and what it can do. */
export interface CalendarDesk {
  readonly base: readonly CalendarEntry[];
  readonly draft: CalendarDraft;
  /** The draft kept last no longer read against the world's calendar, and was set aside. */
  readonly setAside: boolean;
  readonly saving: boolean;
  readonly problem: DeskProblem | null;
  /** How many problems this page said, so the same problem twice is said twice. */
  readonly problems: number;
  /** How many savings this page made. */
  readonly saved: number;
  /** Keeps the draft; true once kept, false when refused, failed or already saving. */
  readonly save: (draft: CalendarDraft) => Promise<boolean>;
}

/** The Ministry's draft of the world's calendar, kept on this PC. */
export function useCalendarDesk(world: Pick<OpenWorld, 'book' | 'date'>, reference: Reference): CalendarDesk {
  const { profile, calendar } = reference;
  const [base] = useState(() => ministryBase(calendar));
  const [kept, setKept] = useState(() => keptCalendarDraft(world.book.entries, base, profile, calendar.year));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ words: DeskProblem; count: number } | null>(null);
  const [saved, setSaved] = useState(0);
  const working = useRef(false);
  const said = useRef(0);
  const say = (words: DeskProblem) => {
    said.current += 1;
    setProblem({ words, count: said.current });
  };
  const save = async (next: CalendarDraft) => {
    if (working.current) return false;
    const read = readCalendarDraft(next, base, profile, calendar.year);
    if ('problems' in read) {
      const heavy = read.problems.some((one) => one.path === 'size');
      say(heavy ? 'demo.ministryCalendar.tooBig' : 'demo.ministryCalendar.refused');
      return false;
    }
    working.current = true;
    setSaving(true);
    setProblem(null);
    try {
      await world.book.record(world.date, { kind: 'ministry.calendar', draft: read.draft });
      setKept({ draft: read.draft, setAside: false });
      setSaved((count) => count + 1);
      return true;
    } catch (error) {
      say(problemOf(error));
      return false;
    } finally {
      working.current = false;
      setSaving(false);
    }
  };
  return {
    base,
    draft: kept.draft,
    setAside: kept.setAside,
    saving,
    problem: problem?.words ?? null,
    problems: problem?.count ?? 0,
    saved,
    save,
  };
}
