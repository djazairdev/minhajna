// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Filling a seeded school's term of signed weeks (#549, answer 626), on the
// director's device that took the school's seeded key (seeded-key.ts). The
// core's generator works out the school's weeks of the first term, to its end,
// the world's date at its start, however the date moved since, so every fill
// and every device works out the same weeks; it reads the world's ID, the
// bundled reference data and only the made-up closure the world's start
// publishes, named in each language of the app, never a release the Ministry
// put later. Each seeded teacher's weeks are signed with the teacher's seeded
// signing key, under the certificate the teacher joined with on the first
// code's channel, and put on that channel, the versions it does not hold yet
// only, in order, at most 64 at a time, so a fill that stopped partway is
// finished by the next and one that finished puts nothing; a fill ends once a
// reading of the channel finds none missing, and one whose weeks do not read
// back once put stops with E_WORLD_SERVER rather than put them again and again.
// A teacher whose channel the seeded device did not join gets nothing. Errors
// carry world-session.ts's codes, the relay's as putting a timetable part does
// (send-session.ts). D-Keys fills, after it shows the key, the term of a school
// whose seeded key the device took each time it holds the key, a problem said
// on the page, once a session for each world and school once a fill has
// finished.

import {
  assignmentId,
  demoClosure,
  packKey,
  seededTerm,
  sealWeek,
  signWeek,
  channelWeeks,
  weekRecordText,
  type CalendarEntry,
  type DemoSchool,
  type DemoWorld,
  type Reference,
  type SeededSchoolKey,
  type WeekRecord,
} from '@minhajna/core';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, newWorldDays, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import type { ReferenceResult } from '../reference';
import { caKey } from '../school/space-read';
import { catalogues } from '../text/i18n';
import { putOnChannel } from '../timetable/send-session';
import { seededWorld } from './director-world';
import { joinCode } from './issue-session';
import type { IssueDesk } from './school-desk';
import { seededKeyOf } from './seeded-key';

/** The bundled reference data that read. */
export type TermReference = Extract<ReferenceResult, { ok: true }>;

/** The most week versions put on a channel at once. */
const AT_ONCE = 64;

/** The core's reference for the term generator, from the app's bundled data. */
export const termReference = (reference: TermReference): Reference => ({
  country: reference.profile,
  year: reference.calendar.year,
  calendar: reference.calendar.entries,
  packs: new Map(reference.packs.map((pack) => [packKey(pack.id, pack.release), pack])),
});

/** The world's made-up closure, named in each language of the app. */
export function worldClosure(world: Pick<DemoWorld, 'directorates'>, reference: TermReference): CalendarEntry {
  const name = { ar: catalogues.ar.demo.closure, fr: catalogues.fr.demo.closure, en: catalogues.en.demo.closure };
  return demoClosure(world, termReference(reference), name);
}

const versionKey = (week: WeekRecord) => `${week.course}\n${week.week}\n${week.version}`;

/** A seeded teacher's first code, on whose channel the teacher joined. */
export async function seededCode(world: string, desk: IssueDesk, space: string, teacher: string, kit: WorldKit) {
  const assignment = await kitStep(() => assignmentId(space, teacher, kit.mac));
  return joinCode(world, desk, { school: space, assignment, issue: 1, epoch: 0, access: 'phone', keyNumber: null });
}

/** Puts each seeded teacher's weeks of the school's term that the teacher's channel does not hold yet. */
export async function fillSeededTerm(
  world: Pick<OpenWorld, 'world'>,
  desk: IssueDesk,
  seeded: SeededSchoolKey,
  reference: TermReference,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const demo = seededWorld(world.world, reference);
  const school = demo.schools.find((one) => one.id === seeded.seed);
  if (school === undefined) return;
  const input = {
    seed: world.world,
    school,
    space: seeded.space,
    reference: termReference(reference),
    closures: [worldClosure(demo, reference)],
    bells: reference.bells,
    until: newWorldDays(reference.calendar).date,
  };
  const term = await kitStep(() => seededTerm(input, kit.mac));
  const ca = await caKey(world.world, send);
  for (const teacher of seeded.teachers) {
    const one = school.teachers.find((each) => each.id === teacher.seed);
    if (one === undefined) continue;
    const versions = term.filter((week) => week.teacherId === one.id).flatMap((week) => week.versions);
    if (versions.length === 0) continue;
    const code = await seededCode(world.world, desk, seeded.space, one.id, kit);
    const rounds = Math.ceil(versions.length / AT_ONCE) + 1;
    for (let done = false, round = 0; !done; round += 1) {
      if (round === rounds) throw failed('The weeks put did not read back', 'E_WORLD_SERVER');
      await putOnChannel(code, ca, kit, send, async ({ batches, joined }, first) => {
        if (joined === null || joined.device !== teacher.device) {
          done = true;
          return [];
        }
        const checker = { key: ca, checker: kit };
        const held = await kitStep(() => channelWeeks(code, batches, checker, joined, kit.cipher, kit.mac));
        const there = new Set(held.flatMap((week) => [week, ...week.earlier]).map((week) => versionKey(week.week)));
        const missing = versions.filter((week) => !there.has(versionKey(week))).slice(0, AT_ONCE);
        done = missing.length === 0;
        const signer = {
          publicKey: joined.certificate.publicKey,
          sign: (text: string) => kit.sign(teacher.signing, text),
          verify: kit.verify,
        };
        const sealed = [];
        for (const week of missing) {
          const signed = await kitStep(() => signWeek(weekRecordText(week), joined.certificate, signer));
          sealed.push(
            ...(await kitStep(() => sealWeek(code, signed, first + sealed.length, kit.cipher, kit.mac))).batches,
          );
        }
        return sealed;
      });
    }
  }
}

const filled = new Set<string>();

/** Fills the term of the school whose seeded key this device took, once a session for each world and school. */
export async function fillTakenTerm(
  world: Pick<OpenWorld, 'world'>,
  desk: IssueDesk,
  held: HeldWorld,
  school: Pick<DemoSchool, 'id'>,
  reference: TermReference,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const key = `${world.world}\n${desk.held.school}`;
  if (filled.has(key)) return;
  const seeded = await seededKeyOf(held, school.id, kit, send);
  if (seeded === null || seeded.space !== desk.held.school) return;
  await fillSeededTerm(world, desk, seeded, reference, kit, send);
  filled.add(key);
}
