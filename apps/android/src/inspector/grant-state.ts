// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// I-Grant's state on the inspector's phone (#594, answer 622): the grants
// relayed to this device (grant-read.ts), read as the page opens and again
// whenever the world's date moves, and each class opened on this page, kept for
// the date it was opened on. Opening a class says it is opening, so a second
// press on it waits; once open it shows what the class's archived weeks give,
// or that no week's archive reads, and a problem is kept on that class alone,
// in I-Grant's words for a grant that has ended or no longer opens and for a
// sheet with notes on more rows than it keeps, and in the catalogue's
// otherwise, with a way to open it again. A problem reading the grants keeps
// those already read. Leaving the page, or the world's date moving, drops a
// slower answer and every class opened for the date before, since a class
// opened again on another day posts that day's uses. A grant's spot-check sheet
// opens the same way (spot-session.ts), its classes shown open once it is;
// saving it says it is saving, so a second press waits, then that it was saved,
// or the problem, keeping the sheet as opened.

import type { DeliveryReading, Grant, SpotSheet } from '@minhajna/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { errorCode } from '../lock/lock-rules';
import { problemOf } from '../school/school-join-session';
import { openGrantClass, readInspectorGrants, type GrantClassRead, type InspectorGrant } from './grant-read';
import { openSpotSheet, saveSpotSheet, type OpenedSheet } from './spot-session';

const GRANT_PROBLEMS = {
  E_GRANT_ENDED: 'demo.inspectorGrant.endedRefused',
  E_GRANT_FORGED: 'demo.inspectorGrant.forged',
  E_SHEET_FULL: 'demo.inspectorGrant.sheetFull',
} as const;

/** I-Grant's words for what went wrong. */
export function inspectorGrantProblem(error: unknown) {
  const code = errorCode(error);
  return code !== undefined && Object.hasOwn(GRANT_PROBLEMS, code)
    ? GRANT_PROBLEMS[code as keyof typeof GRANT_PROBLEMS]
    : problemOf(error);
}

type Problem = ReturnType<typeof inspectorGrantProblem>;

/** A class as this page opened it. */
export type OpenedClass =
  | { readonly state: 'opening' }
  | { readonly state: 'open'; readonly read: GrantClassRead | null }
  | { readonly state: 'problem'; readonly words: Problem };

/** A grant's spot-check sheet as this page opened it, with how its last saving went. */
export type SheetState =
  | { readonly state: 'opening' }
  | {
      readonly state: 'open';
      readonly opened: OpenedSheet;
      readonly saving: boolean;
      /** How many savings went through on this page. */
      readonly saved: number;
      readonly problem: Problem | null;
    }
  | { readonly state: 'problem'; readonly words: Problem };

/** What I-Grant shows, and what it can do. */
export interface InspectorGrants {
  /** The grants relayed to this device, or null until first read. */
  readonly grants: readonly InspectorGrant[] | null;
  readonly reading: boolean;
  readonly problem: Problem | null;
  /** A class of a grant as opened on this page, or undefined before. */
  readonly classOf: (grant: string, course: string) => OpenedClass | undefined;
  readonly open: (grant: Grant, course: string) => void;
  /** A grant's sheet as opened on this page, or undefined before. */
  readonly sheetOf: (grant: string) => SheetState | undefined;
  readonly openSheet: (grant: Grant) => void;
  readonly saveSheet: (sheet: SpotSheet) => void;
}

const classKey = (grant: string, course: string) => `${grant}\n${course}`;

/** I-Grant's grants for the inspector of a directorate in an open world. */
export function useInspectorGrants(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  directorate: string,
  reading: DeliveryReading,
  kit: WorldKit,
  send?: Send,
): InspectorGrants {
  const key = `${world.world}:${world.date}`;
  const [grants, setGrants] = useState<readonly InspectorGrant[] | null>(null);
  const [readFor, setReadFor] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ key: string; words: Problem } | null>(null);
  const [classes, setClasses] = useState<{ key: string; found: ReadonlyMap<string, OpenedClass> } | null>(null);
  const [sheets, setSheets] = useState<{ key: string; found: ReadonlyMap<string, SheetState> } | null>(null);
  const live = useRef(key);
  const opening = useRef(new Set<string>());
  const sheetGoing = useRef(new Set<string>());
  const saving = useRef(new Set<string>());
  const refresh = useCallback(
    async (at: string) => {
      const found = await readInspectorGrants(world, directorate, kit, send);
      if (live.current === at) setGrants(found);
    },
    [world, directorate, kit, send],
  );
  useEffect(() => {
    live.current = key;
    opening.current = new Set();
    sheetGoing.current = new Set();
    refresh(key)
      .catch((error: unknown) => live.current === key && setProblem({ key, words: inspectorGrantProblem(error) }))
      .finally(() => live.current === key && setReadFor(key));
    return () => {
      live.current = '';
    };
  }, [key, refresh]);
  const put = (at: string, name: string, one: OpenedClass) =>
    setClasses((before) => {
      const found = new Map(before?.key === at ? before.found : []);
      found.set(name, one);
      return { key: at, found };
    });
  const open = (grant: Grant, course: string) => {
    const name = classKey(grant.id, course);
    if (opening.current.has(name)) return;
    opening.current.add(name);
    const at = live.current;
    put(at, name, { state: 'opening' });
    void openGrantClass(world, grant, course, reading, kit, send).then(
      (read) => live.current === at && put(at, name, { state: 'open', read }),
      (error: unknown) => {
        if (live.current !== at) return;
        opening.current.delete(name);
        put(at, name, { state: 'problem', words: inspectorGrantProblem(error) });
      },
    );
  };
  const putSheet = (at: string, grant: string, one: (before: SheetState | undefined) => SheetState) =>
    setSheets((before) => {
      const found = new Map(before?.key === at ? before.found : []);
      found.set(grant, one(found.get(grant)));
      return { key: at, found };
    });
  const openSheet = (grant: Grant) => {
    if (sheetGoing.current.has(grant.id)) return;
    sheetGoing.current.add(grant.id);
    const at = live.current;
    putSheet(at, grant.id, () => ({ state: 'opening' }));
    void openSpotSheet(world, grant, reading, kit, send).then(
      (opened) => {
        if (live.current !== at) return;
        for (const [course, read] of opened.classes) {
          opening.current.add(classKey(grant.id, course));
          put(at, classKey(grant.id, course), { state: 'open', read });
        }
        putSheet(at, grant.id, () => ({ state: 'open', opened, saving: false, saved: 0, problem: null }));
      },
      (error: unknown) => {
        if (live.current !== at) return;
        sheetGoing.current.delete(grant.id);
        putSheet(at, grant.id, () => ({ state: 'problem', words: inspectorGrantProblem(error) }));
      },
    );
  };
  const saveSheet = (sheet: SpotSheet) => {
    const at = live.current;
    const now = sheets?.key === at ? sheets.found.get(sheet.grant) : undefined;
    if (now?.state !== 'open' || saving.current.has(sheet.grant)) return;
    saving.current.add(sheet.grant);
    const step = (change: (open: Extract<SheetState, { state: 'open' }>) => SheetState) =>
      putSheet(at, sheet.grant, (before) => (before?.state === 'open' ? change(before) : (before ?? now)));
    step((open) => ({ ...open, saving: true, problem: null }));
    void saveSpotSheet(world, sheet)
      .finally(() => saving.current.delete(sheet.grant))
      .then(
        (kept) =>
          live.current === at &&
          step((open) => ({ ...open, opened: { ...open.opened, sheet: kept }, saving: false, saved: open.saved + 1 })),
        (error: unknown) =>
          live.current === at && step((open) => ({ ...open, saving: false, problem: inspectorGrantProblem(error) })),
      );
  };
  return {
    grants,
    reading: readFor !== key,
    problem: problem?.key === key ? problem.words : null,
    classOf: (grant, course) => (classes?.key === key ? classes.found.get(classKey(grant, course)) : undefined),
    open,
    sheetOf: (grant) => (sheets?.key === key ? sheets.found.get(grant) : undefined),
    openSheet,
    saveSheet,
  };
}
