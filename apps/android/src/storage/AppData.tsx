// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's record book and the country's reference data, for every
// screen. Changes are saved one after another, in the order they are made,
// each on the day it is made. A change that fails to save is reported on the
// screen, never dropped silently (PRD §6.8). While the working copy is on
// the teacher's other device (answer 513), every change but what never
// leaves this device and the log of prints is refused here, for every
// screen at once, and the refusal is said; it counts as not saved.

import {
  deviceFacts,
  eventOf,
  recordsWhileHandedOver,
  type BellData,
  type CalendarEntry,
  newId,
  packKey,
  parseDay,
  type CountryProfile,
  type PlanPack,
  type Day,
  type Entry,
  type RandomBytes,
  type RecordBook,
  type RecordEvent,
  type SchoolYear,
  type State,
  type TrustedKey,
  updatedReference,
} from '@minhajna/core';
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export interface AppData {
  readonly profile: CountryProfile;
  /** The bundled calendar's school year. */
  readonly year: SchoolYear;
  /** The bundled calendar's entries with the signed updates the teacher applied, before the teacher's own. */
  readonly calendar: readonly CalendarEntry[];
  /** The bundled calendar's entries alone, to show what an applied update changed (#223). */
  readonly bundledCalendar: readonly CalendarEntry[];
  /** The bundled calendar's release, which signed updates follow (#223). */
  readonly calendarRelease: string;
  /** The IDs of the entries applied updates replaced or took out. */
  readonly updatedIds: readonly string[];
  /** The keys signed updates are checked with (#223). */
  readonly keys: readonly TrustedKey[];
  /** The bundled bell times (#29). */
  readonly bells: BellData;
  /** The bundled plan packs that read (#30), then the signed ones the teacher added (#223). */
  readonly packs: readonly PlanPack[];
  readonly state: State;
  /** Saves one change. */
  readonly record: (event: RecordEvent) => void;
  /** Saves several changes together, such as a class and its pupils. */
  readonly recordAll: (events: readonly RecordEvent[]) => void;
  /** Saves the change `make` builds from the state once every earlier change is saved, or none when it gives null. */
  readonly recordFrom: (make: (state: State) => RecordEvent | null) => void;
  /** Erases every version of the records that `match` picks, such as a school and its changes (PRD §5.5). */
  readonly erase: (match: (event: RecordEvent) => boolean) => void;
  /** Erases the data of a pupil whose departure the director confirmed, keeping only the fact (answer 473). */
  readonly erasePupil: (pupilId: string) => void;
  /** The phone's day, which changes are recorded on. */
  readonly today: () => Day;
  /** A new random ID for a record made on this phone. */
  readonly newId: () => string;
  /** The phone's random bytes, for what is drawn and never kept, such as a spot check's days (#246). */
  readonly random: RandomBytes;
  /** Resolves once every change made so far is saved or refused. */
  readonly settled: () => Promise<void>;
  /** Waits for queued changes; false when one of them failed while waiting, not before. */
  readonly allSaved: () => Promise<boolean>;
  /** The history's entries as saved so far, for the activity log (#235). */
  readonly entries: () => readonly Entry[];
  /** The durable book's current state, including queued writes that have settled before React redraws. */
  readonly latestState: () => State;
  /** True after a change failed to save, until the next one saves. */
  readonly unsaved: boolean;
  /** The day the working copy went to the other device, while it is there (answer 503); null when here. */
  readonly handedOver: Day | null;
  /** True after a change was refused as the copy is on the other device, until `dismissRefused`. */
  readonly refused: boolean;
  readonly dismissRefused: () => void;
}

const AppDataContext = createContext<AppData | null>(null);
const NONE_UPDATED: readonly string[] = [];

/** The phone's local date, as the day a change is recorded on. */
export function todayOf(now: Date = new Date()): Day {
  const pad = (value: number) => String(value).padStart(2, '0');
  return parseDay(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

/** Gives the screens below it the record book, through `useAppData`. */
export function AppDataProvider({
  book,
  profile,
  year,
  calendar,
  calendarRelease,
  bells,
  packs,
  keys,
  random,
  today = todayOf,
  children,
}: {
  book: RecordBook;
  profile: CountryProfile;
  year: SchoolYear;
  calendar: readonly CalendarEntry[];
  calendarRelease: string;
  bells: BellData;
  packs: readonly PlanPack[];
  keys: readonly TrustedKey[];
  random: RandomBytes;
  today?: () => Day;
  children: ReactNode;
}) {
  const [state, setState] = useState(book.state);
  const [unsaved, setUnsaved] = useState(false);
  const [refused, setRefused] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const failureCount = useRef(0);
  const actions = useMemo(() => {
    const save = (work: () => Promise<unknown>) => {
      queue.current = queue.current.then(work).then(
        () => {
          setState(book.state);
          setUnsaved(false);
        },
        (error: unknown) => {
          failureCount.current += 1;
          setState(book.state);
          if (__DEV__) console.warn('A change was not saved', error);
          setUnsaved(true);
        },
      );
    };
    const refuses = (events: readonly RecordEvent[] | 'pupil') => {
      if (events !== 'pupil' && events.every(recordsWhileHandedOver)) return false;
      if (deviceFacts(book.entries).handedOver === null) return false;
      failureCount.current += 1;
      setRefused(true);
      return true;
    };
    return {
      profile,
      year,
      calendarRelease,
      bells,
      packs,
      keys,
      record: (event: RecordEvent) =>
        save(async () => {
          if (!refuses([event])) await book.record(today(), event);
        }),
      recordAll: (events: readonly RecordEvent[]) =>
        save(async () => {
          if (!refuses(events)) await book.recordAll(today(), events);
        }),
      recordFrom: (make: (state: State) => RecordEvent | null) =>
        save(async () => {
          const event = make(book.state);
          if (event !== null && !refuses([event])) await book.record(today(), event);
        }),
      erase: (match: (event: RecordEvent) => boolean) =>
        save(async () => {
          const matched = book.entries.flatMap((entry) => {
            const event = eventOf(entry);
            return event !== null && match(event) ? [{ id: entry.id, event }] : [];
          });
          if (matched.length > 0 && !refuses(matched.map((one) => one.event)))
            await book.erase(
              today(),
              matched.map((one) => one.id),
            );
        }),
      erasePupil: (pupilId: string) =>
        save(async () => {
          if (!refuses('pupil')) await book.erasePupil(today(), pupilId);
        }),
      dismissRefused: () => setRefused(false),
      today,
      newId: () => newId(random),
      random,
      settled: () => queue.current,
      latestState: () => book.state,
      entries: () => book.entries,
      allSaved: async () => {
        const started = failureCount.current;
        let pending = queue.current;
        await pending;
        while (pending !== queue.current) {
          pending = queue.current;
          await pending;
        }
        return failureCount.current === started;
      },
    };
  }, [book, profile, year, calendarRelease, bells, packs, keys, random, today]);
  const updated = useMemo(
    () =>
      updatedReference({ country: profile, year, calendar, calendarRelease, packs: new Map() }, state.calendarUpdates),
    [profile, year, calendar, calendarRelease, state.calendarUpdates],
  );
  const allPacks = useMemo(() => {
    const held = new Set(packs.map((pack) => packKey(pack.id, pack.release)));
    const added = state.addedPacks
      .map((one) => one.update.pack)
      .filter((pack) => !held.has(packKey(pack.id, pack.release)));
    return added.length === 0 ? packs : [...packs, ...added];
  }, [packs, state.addedPacks]);
  const value = useMemo(
    () => ({
      ...actions,
      packs: allPacks,
      calendar: updated.calendar,
      bundledCalendar: calendar,
      updatedIds: updated.updatedIds ?? NONE_UPDATED,
      state,
      unsaved,
      handedOver: deviceFacts(book.entries).handedOver?.day ?? null,
      refused,
    }),
    [actions, allPacks, updated, calendar, state, unsaved, book, refused],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

/** The record book and reference data; only screens shown once both are open use it. */
export function useAppData(): AppData {
  const data = useContext(AppDataContext);
  if (data === null) throw new Error('useAppData needs an AppDataProvider');
  return data;
}
