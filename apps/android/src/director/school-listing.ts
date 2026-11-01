// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's listing in its directorate's space (#593, answer 621): a device
// holding the school key puts the school's random space beside its seeded ID on
// the listing stream of the directorate's space, once (school/stream-put.ts),
// so the directorate finds the school's space and reads its keyring for the
// holders' public keys. A listing is put again only when the stream's latest
// for the school names another space. D-Issue and D-Keys list it quietly each
// time they hold the key, and D-Issue again on refresh, so a listing that
// failed or was pointed elsewhere is put back. The server learns which random
// space belongs to which seeded school, which names no record.

import {
  directorateSpace,
  listedSchools,
  listingPlace,
  openDirectorateRecords,
  schoolListing,
  sealDirectorateRecord,
  type DemoSchool,
  type SealedBatch,
} from '@minhajna/core';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { putOnce } from '../school/stream-put';

/** Lists the school's space, which this device holds the key of, in its directorate's space. */
export async function listSchool(
  world: string,
  school: Pick<DemoSchool, 'id' | 'directorateId'>,
  space: string,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const directorate = await kitStep(() => directorateSpace(world, school.directorateId, kit.mac));
  const place = await kitStep(() => listingPlace(directorate, kit.mac));
  const put = {
    world,
    space: directorate,
    kind: 'directorate',
    stream: place.stream,
    open: (batches: readonly SealedBatch[]) => openDirectorateRecords(place, batches, kit.cipher),
    there: (records: readonly unknown[]) => listedSchools(records, world).get(school.id) === space,
    seal: (first: number) => sealDirectorateRecord(place, schoolListing(world, school.id, space), first, kit.cipher),
  } as const;
  await putOnce(put, send);
}

/**
 * Lists the school in the background, as D-Issue and D-Keys open: a failure is
 * not theirs to say, and M-Grant says a school not listed yet (answer 621).
 */
export function listQuietly(
  world: string,
  school: Pick<DemoSchool, 'id' | 'directorateId'>,
  space: string,
  kit: WorldKit,
  send?: Send,
): void {
  listSchool(world, school, space, kit, send).catch(() => undefined);
}
