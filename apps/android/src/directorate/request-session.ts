// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directorate's grant requests in a demo world (#593, M-Grant, answer 621).
// The directorate reads its own space, which it opens as a directorate's if no
// school or inspector has yet: the schools listed there by their seeded IDs,
// and the inspectors' keys posted. A request names the school by its seeded ID,
// the inspector by the fingerprint typed, which finds the one key posted for
// it, a label, the subject, the classes, the signed weeks' range and the day
// the grant ends; the world's date is the day it was asked. It is kept in the
// world's store, once the school's space is found open as a school's, before
// anything goes to the relay, then delivered: its envelope, sealed for each
// holder of the latest keyring the school's stream shows, goes on the school's
// request stream once (school/stream-put.ts), so a request kept but not
// delivered, as after a failure, is delivered again. The directorate needs no
// key pair of its own, since each seal makes a fresh one. Each request made
// reads as delivered when its envelope is on the school's stream, and as lapsed
// once the world's date is past its end, since a request is never declined. A
// request goes to the holders of the keyring at its delivery; one added later
// opens it only once the directorate asks again. Errors carry codes:
// world-session.ts's, E_GRANT_UNLISTED for a school not listed, whose space is
// not there, is open as another kind or holds no keyring, E_GRANT_FINGERPRINT
// for a fingerprint no key gives, E_GRANT_FORM for a request that does not
// read, E_NO_SUCH_WORLD once the world is erased, and E_WORLD when the store
// kept nothing.

import {
  compareDays,
  directorateSpace,
  envelopesFor,
  grantRequested,
  inspectorByFingerprint,
  inspectorKeyPlace,
  keyringOnStream,
  keyringStream,
  listedSchools,
  listingPlace,
  newId,
  openDirectorateRecords,
  openGrantEnvelopes,
  readGrantRequest,
  readKeyrings,
  requestPlace,
  requestsMade,
  sealGrantEnvelope,
  sealGrantRequest,
  GRANT_REQUEST,
  type Day,
  type GrantRequest,
  type Holder,
  type SealedBatch,
} from '@minhajna/core';
import { sealingCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { PUBLIC_KEY_BYTES } from '../director/school-desk';
import { errorCode } from '../lock/lock-rules';
import { worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';
import { openSpace, putOnce, readingMissing } from '../school/stream-put';

type DirectorateWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** What the directorate fills in on M-Grant. */
export interface GrantForm {
  /** The school's seeded ID. */
  readonly school: string;
  readonly fingerprint: string;
  readonly label: string;
  readonly subject: string;
  readonly classes: readonly string[];
  readonly weeks: { readonly from: Day; readonly to: Day };
  readonly until: Day;
}

/** A request the directorate made, and how it stands. */
export interface RequestMade {
  readonly request: GrantRequest;
  readonly delivered: boolean;
  readonly lapsed: boolean;
}

async function readDirectorate(world: string, directorate: string, kit: WorldKit, send: Send) {
  const space = await kitStep(() => directorateSpace(world, directorate, kit.mac));
  await openSpace(world, space, 'directorate', send);
  const batches = await spaceBatches(world, space, send);
  const [listing, keys] = await kitStep(() =>
    Promise.all([listingPlace(space, kit.mac), inspectorKeyPlace(space, kit.mac)]),
  );
  const [listed, posted] = await kitStep(() =>
    Promise.all([
      openDirectorateRecords(listing, batches.get(listing.stream) ?? [], kit.cipher),
      openDirectorateRecords(keys, batches.get(keys.stream) ?? [], kit.cipher),
    ]),
  );
  return { schools: listedSchools(listed, world), posted };
}

/** Makes a request from what M-Grant filled in, keeps it in the world's store, then delivers it. */
export async function requestGrant(
  world: DirectorateWorld,
  directorate: string,
  form: GrantForm,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<GrantRequest> {
  const read = await readDirectorate(world.world, directorate, kit, send);
  const school = read.schools.get(form.school);
  if (school === undefined) throw failed('The school has not listed itself yet', 'E_GRANT_UNLISTED');
  const crypto = sealingCrypto(kit);
  const inspector = await kitStep(() => inspectorByFingerprint(read.posted, world.world, form.fingerprint, crypto));
  if (inspector === null) throw failed('No inspector’s key gives this fingerprint', 'E_GRANT_FINGERPRINT');
  const { label, subject, classes, weeks, until } = form;
  const asked = { format: GRANT_REQUEST, id: newId(kit.random), world: world.world, school, inspector };
  const request = readGrantRequest(
    { ...asked, label, subject, classes, weeks, until, asked: world.date },
    crypto.publicKeyBytes,
  );
  if (request === null) throw failed('The request does not read', 'E_GRANT_FORM');
  const holders = await holdersOf(world.world, school, kit, send);
  await openSpace(world.world, school, 'school', send).catch(notSchool);
  await world.book.record(world.date, { kind: 'grant.requested', requested: grantRequested(request) });
  if (!requestsMade(world.book.entries, PUBLIC_KEY_BYTES).some((one) => one.id === request.id)) {
    throw failed('The world’s store did not keep the request', 'E_WORLD');
  }
  await deliver(world.world, request, holders, kit, send);
  return request;
}

/** A space of another kind is no school's: what a listing names there is refused as not listed. */
function notSchool(error: unknown): never {
  if (errorCode(error) !== 'E_SPACE_KIND') throw error;
  throw failed('The school’s listing names a space of another kind', 'E_GRANT_UNLISTED');
}

/** The holders of the latest keyring a school's stream shows. */
async function holdersOf(world: string, school: string, kit: WorldKit, send: Send) {
  const reading = readingMissing(world, send, () => {
    throw failed('The school’s space is not there', 'E_GRANT_UNLISTED');
  });
  const batches = await spaceBatches(world, school, reading);
  const stream = await kitStep(() => keyringStream(school, kit.mac));
  const rings = await kitStep(() =>
    readKeyrings(school, batches.get(stream) ?? [], PUBLIC_KEY_BYTES, kit.cipher, kit.mac),
  );
  const latest = keyringOnStream(rings);
  if (latest === null) throw failed('The school’s space holds no keyring', 'E_GRANT_UNLISTED');
  return latest.holders;
}

/** Puts a request's envelope on its school's stream unless it is there, sealed for the latest keyring's holders. */
export async function deliverRequest(world: string, request: GrantRequest, kit: WorldKit, send: Send = worldRequest) {
  await deliver(world, request, await holdersOf(world, request.school, kit, send), kit, send);
}

async function deliver(world: string, request: GrantRequest, holders: readonly Holder[], kit: WorldKit, send: Send) {
  const place = await kitStep(() => requestPlace(request.school, kit.mac));
  const envelope = await kitStep(() => sealGrantRequest(request, holders, sealingCrypto(kit), kit.random, kit.cipher));
  const put = {
    world,
    space: request.school,
    kind: 'school',
    stream: place.stream,
    open: (one: readonly SealedBatch[]) => openGrantEnvelopes(place, one, kit.cipher),
    there: (records: readonly unknown[]) => envelopesFor(records, request.school).has(request.id),
    seal: (first: number) => sealGrantEnvelope(place, envelope, first, kit.cipher),
  } as const;
  await putOnce(put, send).catch(notSchool);
}

/** The requests this directorate made, in the order made, each delivered or not, and lapsed or not. */
export async function requestsOf(world: DirectorateWorld, kit: WorldKit, send: Send = worldRequest) {
  const made = requestsMade(world.book.entries, PUBLIC_KEY_BYTES);
  const empty = { status: 200, body: { batches: [], more: false }, retryAfter: null };
  const reading = readingMissing(world.world, send, () => empty);
  const seen = new Map<string, ReadonlySet<string>>();
  const rows: RequestMade[] = [];
  for (const request of made) {
    if (!seen.has(request.school)) {
      const place = await kitStep(() => requestPlace(request.school, kit.mac));
      const batches = (await spaceBatches(world.world, request.school, reading)).get(place.stream) ?? [];
      const records = await kitStep(() => openGrantEnvelopes(place, batches, kit.cipher));
      seen.set(request.school, envelopesFor(records, request.school));
    }
    const delivered = seen.get(request.school)?.has(request.id) === true;
    rows.push({ request, delivered, lapsed: compareDays(world.date, request.until) > 0 });
  }
  return rows;
}
