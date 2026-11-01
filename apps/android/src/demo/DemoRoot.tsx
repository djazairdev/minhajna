// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo worlds (#560 and #561, answers 569, 572, 573 and 575), in place of
// the welcome or the lock page while the teacher's history is shut: the entry
// starts a world, on a PC only, or enters one by its code, then the world's own
// store opens and its roles show, then its home. The platform's cryptography
// comes from its start. Each failure says what went wrong in the catalogue's
// words, by its code, and leaves the entry as it was; a code the server no
// longer knows erases what this device kept for it (world-mode.ts). Leaving
// shuts the network and the world's store, and hands back to the lock, which
// opens the teacher's history again only through its passphrase or PIN.
// Android's back button goes back from the entry unless a world is being
// entered, and from a role to the roles; on the roles it does nothing, so a
// world is left only by its own button. The teacher and the inspector open
// reader mode inside the world from its home (#563), where reader mode's own
// back button leads back, and Android's back is reader mode's alone; the
// teacher of a national world opens School-join the same way (#564), in its
// trial term end while the world's date falls in it (#565), with the country's
// calendar and bells read for the world's school (school-mine-session.ts),
// whose term and closures the teacher's classes count (#584). The workspaces'
// pages come from WorkspacePages.tsx: the director's workspace opens on the
// seeded school's dashboard (#569), its codes page issues joining codes and
// security keys (#570), its keys page maps who holds the school key (#571), and
// the director's and the preparer's timetable page brings in its timetable
// (#576), kept for the world it was read in, from which the director sends each
// teacher their part (#577), publishes versions and decides the teachers'
// proposals (#578, TimetableDesk.tsx), the director's My log lists their own
// actions (#573), and the records page reads the classes' signed weeks (#585).
// The teacher of a national world signs in on a staffroom PC (#572): on the
// phone it approves a PC's code, and on the PC it is the staffroom PC itself.
// The inspector of a national world posts their key from its home (#593) and
// reads the grants relayed to their phone there (#594). Every page in a world
// reads the world's calendar (#608, world-calendar-read.ts): the bundled one
// with the releases the Ministry published laid over it, read with the world's
// keys and sealing key, which starting or joining gives and this page holds in
// memory until the world is left; a reading that fails is said on the world's
// home, and a world starts from the bundled calendar.

import {
  readWorldCode,
  trialTermEnd,
  type CountryProfile,
  type Day,
  type SchoolCalendar,
  type WorldKind,
} from '@minhajna/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import NativeWorld, { type Spec as WorldSpec } from '../native/NativeMinhajnaWorld';
import { onPc, useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import type { ReferenceResult } from '../reference';
import { DemoEntry } from './DemoEntry';
import { useWorldCalendar, type HeldWorld } from './world-calendar-read';
import { worldDate } from './world-date';
import { forgetWorld, leaveWorld, openWorld, type OpenWorld, type WorldRole } from './world-mode';
import { joinWorld, moveWorldDate, startWorld, type Send, type WorldKit } from './world-session';
import { WorldHome } from './WorldHome';
import { WorldReader } from './WorldReader';
import { workspacePage } from './WorkspacePages';
import { InspectorHome } from '../inspector/InspectorHome';
import { SchoolJoin } from '../school/SchoolJoin';
import { PcApprove } from '../staff/PcApprove';
import { StaffPc } from '../staff/StaffPc';
import { useDirectorSchool } from '../director/director-world';
import type { TimetableRead } from '../timetable/TimetableImport';
import { mineOf } from '../week/school-mine-session';
import { problemOf, type ProblemKey } from './world-problems';

export type DemoRootProps = {
  readonly kit: WorldKit;
  readonly calendar: SchoolCalendar;
  readonly profile: Pick<CountryProfile, 'months' | 'weekStartsOn'>;
  readonly storage: Pick<StorageSpec, 'randomBytes' | 'digest'>;
  readonly world?: WorldSpec;
  readonly send?: Send;
  /** Back to the page the entry came from, with no world entered. */
  readonly onBack: () => void;
  /** After leaving a world: the lock checks the teacher's history again. */
  readonly onLeft: () => void;
  /** The bundled reference data, for reader mode inside a world (#563); without it, a world offers none. */
  readonly reference?: Extract<ReferenceResult, { ok: true }>;
};

/** The demo worlds' pages, from the entry to a world's home. */
export function DemoRoot({
  kit,
  calendar,
  profile,
  storage,
  world = NativeWorld,
  send,
  onBack,
  onLeft,
  reference,
}: DemoRootProps) {
  const t = useDeviceText();
  const [open, setOpen] = useState<OpenWorld | null>(null);
  const [role, setRole] = useState<WorldRole | null>(null);
  const [reading, setReading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [staff, setStaff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ProblemKey | null>(null);
  const [timetable, setTimetable] = useState<{ world: string; read: TimetableRead } | null>(null);
  const [held, setHeld] = useState<HeldWorld | null>(null);
  const working = useRef(false);
  const school = useDirectorSchool(open, reference);
  const published = useWorldCalendar(open === null ? null : held, open?.date, calendar, reference, kit, send);
  const { calendar: here, reference: worldReference } = published;

  const run = useCallback((step: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setProblem(null);
    step()
      .catch((error: unknown) => setProblem(problemOf(error)))
      .finally(() => {
        working.current = false;
        setBusy(false);
      });
  }, []);

  const start = (kind: WorldKind) =>
    run(async () => {
      const started = await startWorld(kind, calendar, kit, send);
      const found = { world: started.keys.world, kind, code: started.code, date: started.date };
      setOpen(await openWorld({ ...found, starter: started.starter }, storage, world));
      setHeld({ world: started.keys.world, keys: started.keys, sealing: started.sealing });
    });

  const join = (typed: string) =>
    run(async () => {
      const read = readWorldCode(typed);
      const joined = await joinWorld(typed, kit, send).catch(async (error: unknown) => {
        const gone = (error as { code?: unknown } | null)?.code === 'E_NO_SUCH_WORLD';
        if (gone && 'code' in read) await forgetWorld(read.code, storage, world).catch(() => undefined);
        throw error;
      });
      const code = 'code' in read ? read.code : typed;
      const found = { world: joined.keys.world, kind: joined.keys.kind, code, date: joined.date };
      setOpen(await openWorld({ ...found, starter: null }, storage, world));
      setHeld({ world: joined.keys.world, keys: joined.keys, sealing: joined.sealing });
    });

  const move = () =>
    run(async () => {
      if (open?.starter == null) return;
      const date = await moveWorldDate(open.world, open.starter, open.date, send);
      setOpen({ ...open, date });
    });

  const leave = () =>
    run(async () => {
      await leaveWorld(world);
      setOpen(null);
      setHeld(null);
      setRole(null);
      setReading(false);
      setJoining(false);
      setStaff(false);
      setTimetable(null);
      onLeft();
    });

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (reading || joining || staff) return false;
      if (open === null && !working.current) onBack();
      if (open !== null) setRole(null);
      return true;
    });
    return () => handler.remove();
  }, [open, onBack, reading, joining, staff]);

  const shown = problem !== null ? t(problem) : published.problem !== null ? t('demo.problem.calendar') : null;
  if (open === null)
    return <DemoEntry busy={busy} problem={shown} onStart={onPc() ? start : undefined} onJoin={join} onBack={onBack} />;
  const date = worldDate(t, open.date, currentLanguage(), profile);
  const dayText = (day: Day) => worldDate(t, day, currentLanguage(), profile);
  const trial = trialTermEnd(here.year, profile.weekStartsOn);
  if (joining && open.kind === 'national')
    return (
      <SchoolJoin
        world={open}
        date={date}
        dayText={dayText}
        kit={kit}
        send={send}
        trial={trial}
        year={here.year.id}
        workingDays={reference?.profile.workingDays}
        subjects={reference?.profile.subjects}
        mine={worldReference && mineOf(worldReference, here, school)}
        school={school}
        onClose={() => setJoining(false)}
      />
    );
  if (staff && open.kind === 'national' && school !== null && worldReference !== undefined)
    return onPc() ? (
      <StaffPc
        world={open}
        school={school}
        profile={worldReference.profile}
        date={date}
        dayText={dayText}
        kit={kit}
        send={send}
        onClose={() => setStaff(false)}
      />
    ) : (
      <PcApprove world={open} school={school} date={date} kit={kit} send={send} onClose={() => setStaff(false)} />
    );
  if (reading && worldReference !== undefined)
    return (
      <WorldReader
        world={open}
        date={date}
        reference={worldReference}
        random={kit.random}
        onClose={() => setReading(false)}
      />
    );
  return (
    <WorldHome
      world={open}
      date={date}
      role={role}
      moving={busy}
      problem={shown}
      onRole={setRole}
      onReader={worldReference === undefined ? undefined : () => setReading(true)}
      onSchool={open.kind === 'national' ? () => setJoining(true) : undefined}
      onStaff={
        open.kind === 'national' && school !== null && worldReference !== undefined ? () => setStaff(true) : undefined
      }
      inspectorCard={
        open.kind === 'national' && school !== null && worldReference !== undefined ? (
          <InspectorHome
            world={open}
            school={school}
            reference={worldReference}
            mine={mineOf(worldReference, here, school)}
            kit={kit}
            send={send}
            dayText={dayText}
          />
        ) : undefined
      }
      onMove={move}
      onLeave={leave}
      pageBody={(workspace, page, onPage) =>
        school === null || worldReference === undefined
          ? null
          : workspacePage(workspace, page, {
              open,
              school,
              reference: worldReference,
              kit,
              send,
              dayText,
              trial,
              year: here.year,
              mine: mineOf(worldReference, here, school),
              timetable,
              onTimetable: (read) => setTimetable(read === null ? null : { world: open.world, read }),
              onPage,
              held,
              onCalendar: published.again,
            })
      }
    />
  );
}
