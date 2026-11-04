// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sendings the teacher of a teachers' world would make (#622, answer 696),
// worked out on the device from the world's description and its bundled
// reference data (term-sendings.ts), as every device rebuilds them: for the
// latest term the world's date has ended, each class of the world's teacher
// with its sending or why it makes none, under the draw the world's store
// keeps for the term. Nothing is sent here. A world with no teacher, or a
// working out that fails, says so, and is tried again when the world's date
// moves. The term is read from the bundled calendar, as a teachers' world has
// no Ministry to publish another.

import {
  endedTerm,
  worldTeacher,
  type ClassSending,
  type Day,
  type DemoClass,
  type RandomBytes,
  type RecordBook,
  type WorldMac,
} from '@minhajna/core';
import { useEffect, useMemo, useState } from 'react';
import { seededWorld } from '../director/director-world';
import type { TermReference } from '../director/seeded-fill';
import { termSendings } from './term-sendings';

/** A class of the world's teacher, with its sending for the term or why it makes none. */
export interface ClassShown extends ClassSending {
  readonly schoolClass: DemoClass;
}

/** What the page shows: the term's number and each class, or that the working out failed. */
export type TeacherSendings =
  | { readonly kind: 'working' }
  | { readonly kind: 'none' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'shown'; readonly term: 1 | 2 | 3; readonly classes: readonly ClassShown[] };

export type TeacherSendingsInput = {
  readonly world: string;
  readonly date: Day;
  readonly book: RecordBook;
  readonly reference: TermReference;
  readonly kit: { readonly mac: WorldMac; readonly random: RandomBytes };
  readonly digest: (text: string) => Promise<string>;
};

/** The teacher's classes' sendings for the latest term ended, worked out once for each world and date. */
export function useTeacherSendings({
  world,
  date,
  book,
  reference,
  kit,
  digest,
}: TeacherSendingsInput): TeacherSendings {
  const mine = useMemo(() => worldTeacher(seededWorld(world, reference)), [world, reference]);
  const [shown, setShown] = useState<{ key: string; value: TeacherSendings } | null>(null);
  const key = JSON.stringify([world, date]);
  const term = useMemo(() => endedTerm(reference.calendar.year, date), [reference, date]);
  useEffect(() => {
    if (mine === null || term === null) return;
    let live = true;
    const work = async () => {
      const sent = await termSendings({ world, mine, term, book, date, reference, kit, digest });
      const classes = sent.map((one) => ({
        ...one,
        schoolClass: mine.school.classes.find((each) => each.id === one.classId)!,
      }));
      return { kind: 'shown' as const, term: term.number, classes };
    };
    work().then(
      (value) => live && setShown({ key, value }),
      () => live && setShown({ key, value: { kind: 'failed' } }),
    );
    return () => {
      live = false;
    };
  }, [key, world, date, book, reference, mine, term, kit, digest]);
  if (term === null) return { kind: 'none' };
  if (mine === null) return { kind: 'failed' };
  return shown?.key === key ? shown.value : { kind: 'working' };
}
