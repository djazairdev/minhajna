// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The schools on Setup-2-Teaching, saved as the teacher makes each change
// (PRD §6.8): a chip at once, a name once typing pauses or the field is left.
// A school is saved from its first change, so an added school left empty
// leaves nothing behind. Removing a school erases every version of it.

import type { School } from '@minhajna/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppData } from '../storage/AppData';
import { blankSchool, tidy, withLevels } from './school-rules';

/** How long typing must pause before a name is saved. */
export const NAME_PAUSE = 600;

export interface Schools {
  readonly schools: readonly School[];
  readonly chooseLevels: (id: string, levels: readonly string[]) => void;
  readonly chooseSubjects: (id: string, subjects: readonly string[]) => void;
  readonly rename: (id: string, name: string) => void;
  readonly chooseZone: (id: string, zone: string) => void;
  /** Saves any name still waiting for a pause. */
  readonly flush: () => void;
  /** Adds an empty school in the last one's wilaya, and returns its ID. */
  readonly add: () => string;
  readonly remove: (id: string) => void;
}

/** The schools kept in the history, or one empty school to start with. */
export function useSchools(): Schools {
  const { state, profile, record, erase, newId } = useAppData();
  const [schools, setSchools] = useState<readonly School[]>(() => {
    const kept = [...state.schools.values()];
    return kept.length > 0 ? kept : [blankSchool(newId())];
  });
  const latest = useRef(schools);
  const waiting = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const put = useCallback((next: readonly School[]) => {
    latest.current = next;
    setSchools(next);
  }, []);

  const save = useCallback(
    (id: string) => {
      clearTimeout(waiting.current.get(id));
      waiting.current.delete(id);
      const school = latest.current.find((candidate) => candidate.id === id);
      if (school !== undefined) record({ kind: 'school.set', school: tidy(school) });
    },
    [record],
  );

  const change = useCallback(
    (id: string, edit: (school: School) => School) =>
      put(latest.current.map((school) => (school.id === id ? edit(school) : school))),
    [put],
  );

  const flush = useCallback(() => {
    for (const id of [...waiting.current.keys()]) save(id);
  }, [save]);

  useEffect(() => flush, [flush]);

  return {
    schools,
    chooseLevels: (id, levels) => {
      change(id, (school) => withLevels(profile, school, levels));
      save(id);
    },
    chooseSubjects: (id, subjects) => {
      change(id, (school) => ({ ...school, subjects }));
      save(id);
    },
    rename: (id, name) => {
      change(id, (school) => ({ ...school, name }));
      clearTimeout(waiting.current.get(id));
      waiting.current.set(
        id,
        setTimeout(() => save(id), NAME_PAUSE),
      );
    },
    chooseZone: (id, zone) => {
      change(id, (school) => ({ ...school, zone }));
      save(id);
    },
    flush,
    add: () => {
      const school = blankSchool(newId(), latest.current.at(-1)?.zone);
      put([...latest.current, school]);
      return school.id;
    },
    remove: (id) => {
      clearTimeout(waiting.current.get(id));
      waiting.current.delete(id);
      put(latest.current.filter((school) => school.id !== id));
      erase((event) => event.kind === 'school.set' && event.school.id === id);
    },
  };
}
