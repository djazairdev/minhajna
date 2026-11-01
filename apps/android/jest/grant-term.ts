// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up term for the director's grant tests (#593, answer 621): the term of
// term-weeks.ts, 1م2's weeks signed and 1م3's never, its school listed in its
// directorate's space, an inspector's key posted there, and the directorate
// asking for a grant over 1م2 and 1م3; a new epoch of the school's keyring;
// what the inspector's device opens of the grants relayed to it, each week's
// archive with the key a grant shares, and the notices on the teacher's
// channel.

import {
  channelGrantNotices,
  channelStream,
  directorateSpace,
  grantedWeekPlace,
  openGrant,
  openGrantedWeek,
  openGrantRelays,
  openRelayed,
  parseDay,
  readHolderQr,
  readJoinCode,
  readJoined,
  relayPlace,
  useGrant as weekKey,
  type Day,
  type Grant,
  type SchoolJoined,
} from '@minhajna/core';
import { worldKeyCrypto } from '../src/demo/world-key-crypto';
import { waitToHold } from '../src/director/holder-wait';
import { addDevice, removeHolderDevice } from '../src/director/holders-session';
import { holdSchool } from '../src/director/issue-session';
import { listSchool } from '../src/director/school-listing';
import { requestGrant, type GrantForm } from '../src/directorate/request-session';
import { inspectorDevice, postInspectorKey } from '../src/inspector/inspector-key-session';
import { caKey, spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import { FakeStorage } from './fake-storage';
import { SCHOOL } from './grant-world';
import { SECOND, signedTerm } from './term-weeks';
import { school, server } from './timetable-send';
import { nodeKit as kit } from './world-server';

/** The term's school as the director's device knows it, with its seeded ID and directorate. */
export const STAFFED = { ...school, ...SCHOOL };
export const LABEL = 'Made-up inspector of district 3';
/** The two weeks of 1م2 the term signed, by their first days. */
export const WEEKS = [parseDay('2027-01-03'), parseDay('2027-01-10')];

/** The term with its school listed, the inspector's key posted, and a way for the directorate to ask. */
export async function grantTerm() {
  const { id, here, joined } = await signedTerm();
  const device = async (date: Day = SECOND) => ({
    world: id,
    date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  const desk = await holdSchool(here, kit, server.send);
  await listSchool(id, SCHOOL, desk.held.school, kit, server.send);
  const inspector = await device();
  const { fingerprint } = await postInspectorKey(inspector, SCHOOL.directorateId, kit, server.send);
  const directorate = await device();
  const ask = (change: Partial<GrantForm> = {}) =>
    requestGrant(
      directorate,
      SCHOOL.directorateId,
      {
        school: SCHOOL.id,
        fingerprint,
        label: LABEL,
        subject: 'math',
        classes: ['1م2', '1م3'],
        weeks: { from: WEEKS[0], to: parseDay('2027-01-16') },
        until: parseDay('2027-02-14'),
        ...change,
      },
      kit,
      server.send,
    );
  return { id, director: { ...here, date: SECOND }, device, desk, joined, inspector, fingerprint, ask };
}

/** A new epoch of the school's keyring: a deputy added as a holder, then removed. */
export async function newEpoch(director: Parameters<typeof holdSchool>[0], deputy: typeof director) {
  const desk = await holdSchool(director, kit, server.send);
  const waiting = await waitToHold(deputy, kit, server.send);
  const scanned = readHolderQr(waiting.code);
  if (scanned === null) throw new Error('The deputy’s code does not read');
  await addDevice(director, desk, scanned, kit, server.send);
  const after = await holdSchool(director, kit, server.send);
  await removeHolderDevice(director, after, scanned.holder.id, kit, server.send);
  return holdSchool(director, kit, server.send);
}

/** The grants relayed to the inspector's device, opened on the world's date, and what each week's archive holds. */
export async function relayedTo(inspector: Parameters<typeof inspectorDevice>[0], school: string, today: Day) {
  const own = await inspectorDevice(inspector, kit);
  const crypto = worldKeyCrypto(kit, own);
  const holder = { id: own.device, publicKey: own.publicKey };
  const space = await directorateSpace(inspector.world, SCHOOL.directorateId, kit.mac);
  const place = await relayPlace(holder, kit.mac);
  const batches = (await spaceBatches(inspector.world, space, server.send)).get(place.stream) ?? [];
  const relayed = await openRelayed(await openGrantRelays(place, batches, kit.cipher), holder, crypto);
  const archives = await spaceBatches(inspector.world, school, server.send);
  const ca = { key: await caKey(inspector.world, server.send), checker: kit };
  const weeks = async (grant: Grant) => {
    const opened = await openGrant(grant, today, own.device, crypto);
    if (typeof opened === 'string') return opened;
    const read = [];
    for (const week of grant.weeks) {
      const used = await weekKey(opened, week.course, week.week, today, crypto);
      const at = used === null ? null : await grantedWeekPlace(used.key, grant.id, kit.mac);
      const found = at === null ? [] : (archives.get(at.stream) ?? []);
      read.push(at && (await openGrantedWeek(at, found, week.course, week.week, inspector.world, ca, kit.cipher)));
    }
    return read;
  };
  return { relayed, count: batches.length, weeks };
}

/** The grant notices on the teacher's channel, as the joined device reads them. */
export async function noticesOf(joined: SchoolJoined) {
  const code = readJoinCode(joined.code);
  if (code === null) throw new Error('The joined code does not read');
  const batches = (await spaceBatches(code.world, code.school, server.send)).get(await channelStream(code, kit.mac));
  const ca = { key: await caKey(code.world, server.send), checker: kit };
  const who = await readJoined(code, batches ?? [], ca, kit.cipher, kit.mac);
  return channelGrantNotices(code, batches ?? [], ca, who, kit.cipher, kit.mac);
}
