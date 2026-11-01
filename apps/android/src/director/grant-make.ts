// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Making an inspector's grant on the director's device in a demo world (#593,
// answer 621), from a request addressed to it as the access page reads it
// (grant-session.ts): refused with E_GRANT_GONE when the request is no longer
// there, E_GRANT_LAPSED once the world's date is past its end, and, for a grant
// not yet recorded, E_GRANT_FINGERPRINT when the fingerprint typed is not that
// of the inspector's key and E_GRANT_NO_WEEKS when the request resolves to no
// signed week, each before anything is put. The grant runs from the world's
// date to the request's end over the weeks it resolves to, under the keyring's
// latest epoch; a grant the school recorded for the request is finished
// instead, without its fingerprint. Then, in turn, each step skipped once done:
// each week the grant names archived for it under the week's own key in the
// school's space as it stands, unless the grant's archive of it reads, so a
// later grant over a corrected week gets the week as corrected; the school's
// record of the grant on its epoch's stream, unless one for the request is on
// any epoch's stream, the first recorded winning from then on; each teacher
// told of their own weeks once, on the channel of their current code or key, or
// of the one their weeks came under when this device kept none, signed with
// this device's key (send-session.ts), unless a notice of the grant is there;
// and only then the grant relayed, sealed for the inspector's device, on its
// stream of the directorate's space, put each time, since anyone who saw the
// request can post a relay for it and the inspector's device keeps each grant
// once. A week no longer read is neither archived nor told. Errors carry
// world-session.ts's codes, those of holding the school key and those of
// school/stream-put.ts.

import {
  channelGrantNotices,
  directorateSpace,
  grantedWeek,
  grantedWeekPlace,
  grantMade,
  grantRecordPlace,
  grantsMade,
  inspectorFingerprint,
  keptIssues,
  latestEpoch,
  makeGrant,
  newId,
  openGrantedWeek,
  openGrantsMade,
  plainFingerprint,
  relayGrant,
  relayPlace,
  sealGrantedWeek,
  sealGrantMade,
  sealGrantNotice,
  sealGrantRelay,
  signedWeekKey,
  signGrantNotice,
  type Grant,
  type GrantNotice,
  type KeptIssue,
} from '@minhajna/core';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { putOnce } from '../school/stream-put';
import { putOnChannel, signingKey } from '../timetable/send-session';
import { grantsOf, readGrants, weekName, type GrantSchool, type GrantWorld, type ResolvedWeek } from './grant-session';
import { joinCode, PUBLIC_KEY_BYTES, type HeldDesk } from './issue-session';

type Weeks = readonly { readonly week: Grant['weeks'][number]; readonly found: ResolvedWeek }[];

async function archive(
  world: string,
  desk: HeldDesk,
  grant: Grant,
  weeks: Weeks,
  ca: string,
  kit: WorldKit,
  send: Send,
) {
  const checker = { key: ca, checker: kit };
  for (const { week, found } of weeks) {
    const key = await kitStep(() => signedWeekKey(desk.opened, week.epoch, week.course, week.week, desk.crypto));
    const place = await kitStep(() => grantedWeekPlace(key, grant.id, kit.mac));
    const archived = grantedWeek(found.recorded, found.recorded.visas);
    await putOnce(
      {
        world,
        space: desk.held.school,
        kind: 'school',
        stream: place.stream,
        open: async (batches) => {
          const read = await openGrantedWeek(place, batches, week.course, week.week, world, checker, kit.cipher);
          return read === null ? [] : [read];
        },
        there: (records) => records.length > 0,
        seal: (first) => sealGrantedWeek(place, archived, first, kit.cipher),
      },
      send,
    );
  }
}

async function record(
  world: string,
  desk: HeldDesk,
  request: string,
  label: string,
  grant: Grant,
  kit: WorldKit,
  send: Send,
) {
  const recorded = async () =>
    (await grantsOf(desk, await spaceBatches(world, desk.held.school, send), kit)).find(
      (one) => one.request === request,
    );
  const before = await recorded();
  if (before !== undefined) return before;
  const place = await kitStep(() => grantRecordPlace(desk.opened, grant.log.epoch, desk.crypto, kit.mac));
  const made = grantMade(request, label, grant, PUBLIC_KEY_BYTES);
  const ours = (records: readonly unknown[]) =>
    grantsMade(records, desk.held.school, PUBLIC_KEY_BYTES).some((one) => one.request === request);
  await putOnce(
    {
      world,
      space: desk.held.school,
      kind: 'school',
      stream: place.stream,
      open: (batches) => openGrantsMade(place, batches, kit.cipher),
      there: ours,
      seal: (first) => sealGrantMade(place, made, first, kit.cipher),
    },
    send,
  );
  const kept = await recorded();
  if (kept === undefined) throw failed('The school’s record of the grant did not stay', 'E_WORLD_SERVER');
  return kept;
}

async function tell(
  world: string,
  desk: HeldDesk,
  issues: ReadonlyMap<string, KeptIssue>,
  label: string,
  grant: Grant,
  weeks: Weeks,
  ca: string,
  kit: WorldKit,
  send: Send,
) {
  const byTeacher = new Map<string, Weeks[number][]>();
  for (const one of weeks) {
    const { assignment } = one.found.recorded.issue;
    byTeacher.set(assignment, [...(byTeacher.get(assignment) ?? []), one]);
  }
  if (byTeacher.size === 0) return;
  const key = await signingKey(world, desk, ca, kit, send);
  const told = new Error('told');
  for (const [assignment, theirs] of byTeacher) {
    const issue = issues.get(assignment) ?? theirs[0].found.recorded.issue;
    const code = await joinCode(world, desk, issue);
    const notice: GrantNotice = {
      world,
      school: desk.held.school,
      assignment: issue.assignment,
      issue: issue.issue,
      grant: grant.id,
      inspector: label,
      weeks: theirs.map(({ week }) => ({ course: week.course, week: week.week })),
      from: grant.from,
      until: grant.until,
    };
    const signed = await kitStep(() => signGrantNotice(notice, key.certificate, key.signer));
    await putOnChannel(code, ca, kit, send, async ({ batches, joined }, at) => {
      const given = await kitStep(() =>
        channelGrantNotices(code, batches, { key: ca, checker: kit }, joined, kit.cipher, kit.mac),
      );
      if (given.some((one) => one.value.grant === grant.id)) throw told;
      return (await kitStep(() => sealGrantNotice(code, signed, at, kit.cipher, kit.mac))).batches;
    }).catch((error: unknown) => {
      if (error !== told) throw error;
    });
  }
}

/** Makes the grant a request asks for, or finishes the one recorded for it; answers the grant as recorded. */
export async function approveGrant(
  world: GrantWorld,
  school: GrantSchool,
  request: string,
  fingerprint: string,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<Grant> {
  const { desk, signed, asked } = await readGrants(world, school, kit, send);
  const one = asked.find((each) => each.request.id === request);
  if (one === undefined) throw failed('The request is no longer addressed to this device', 'E_GRANT_GONE');
  if (one.lapsed) throw failed('The request is past its end', 'E_GRANT_LAPSED');
  const { inspector, until } = one.request;
  if (one.made === null) {
    const theirs = await kitStep(() => inspectorFingerprint(inspector.publicKey, desk.crypto));
    if (plainFingerprint(theirs) !== plainFingerprint(fingerprint))
      throw failed('The fingerprint is not the inspector’s', 'E_GRANT_FINGERPRINT');
    if (one.weeks.length === 0) throw failed('The request names no signed week', 'E_GRANT_NO_WEEKS');
  }
  const epoch = latestEpoch(desk.opened);
  const terms = {
    id: newId(kit.random),
    inspector,
    fingerprint,
    weeks: one.weeks.map(({ recorded }) => ({ course: recorded.week.course, week: recorded.week.week, epoch })),
    from: world.date,
    until,
  };
  const grant = one.made?.grant ?? (await kitStep(() => makeGrant(desk.opened, terms, desk.held.device, desk.crypto)));
  const label = one.made?.label ?? one.request.label;
  const named = (made: Grant): Weeks =>
    made.weeks.flatMap((week) => {
      const found = signed.get(weekName(week.course, week.week));
      return found === undefined ? [] : [{ week, found }];
    });
  const ca = await caKey(world.world, send);
  await archive(world.world, desk, grant, named(grant), ca, kit, send);
  const recorded = await record(world.world, desk, request, label, grant, kit, send);
  const kept = recorded.grant;
  if (kept.id !== grant.id) await archive(world.world, desk, kept, named(kept), ca, kit, send);
  const issues = keptIssues(world.book.entries, desk.held.school);
  await tell(world.world, desk, issues, recorded.label, kept, named(kept), ca, kit, send);
  const space = await kitStep(() => directorateSpace(world.world, school.directorateId, kit.mac));
  const place = await kitStep(() => relayPlace(inspector, kit.mac));
  const relay = await kitStep(() => relayGrant(request, kept, desk.crypto));
  await putOnce(
    {
      world: world.world,
      space,
      kind: 'directorate',
      stream: place.stream,
      open: () => Promise.resolve([]),
      there: () => false,
      seal: (first) => sealGrantRelay(place, relay, first, kit.cipher),
    },
    send,
  );
  return kept;
}
