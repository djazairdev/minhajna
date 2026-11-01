// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspector's key in a demo world (#593, M-Grant, answer 621). The first
// time the inspector's home opens, the device makes an agreement pair for the
// world and keeps it, with a new device ID, in the world's store, whose private
// half never leaves it; the first one kept is the device's from then on. Its
// public half is then posted, once, on the inspector-key stream of the
// directorate's space, which this device opens as a directorate's space if it
// is not there yet; when another device took the stream's next number first,
// the stream is read again and the key posted on top, until it holds the key; a
// refusal while the stream stayed as it was, as for a full world, is said as
// the server's. Two openings at once on one store make one pair. The key's
// fingerprint is what the inspectorate sends the school in its official message
// (answer 563), and what the directorate types on M-Grant.

import {
  directorateSpace,
  inspectorFingerprint,
  inspectorKey,
  inspectorKeyPlace,
  keptInspectorDevice,
  newId,
  openDirectorateRecords,
  readInspectorKey,
  sealDirectorateRecord,
  toBase64Url,
  type Holder,
  type InspectorDevice,
} from '@minhajna/core';
import { newDevicePair, worldKeyCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { PUBLIC_KEY_BYTES } from '../director/school-desk';
import { worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';

type InspectorWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** How many times the key is posted on top before it gives up. */
const TRIES = 3;

/** The pair being made on each world's store, so two openings at once keep one. */
const making = new WeakMap<InspectorWorld['book'], Promise<InspectorDevice>>();

/** The inspector's key as posted, and the fingerprint the inspectorate sends the school. */
export interface InspectorPosted {
  readonly holder: Holder;
  readonly fingerprint: string;
}

/** The inspector's device kept in the world's store, made and kept the first time. */
export function inspectorDevice(world: InspectorWorld, kit: WorldKit): Promise<InspectorDevice> {
  const kept = keptInspectorDevice(world.book.entries, PUBLIC_KEY_BYTES);
  if (kept !== null) return Promise.resolve(kept);
  const pending = making.get(world.book) ?? makeDevice(world, kit).finally(() => making.delete(world.book));
  making.set(world.book, pending);
  return pending;
}

async function makeDevice(world: InspectorWorld, kit: WorldKit): Promise<InspectorDevice> {
  const pair = await kitStep(() => newDevicePair(kit));
  await world.book.record(world.date, { kind: 'inspector.device', inspector: { device: newId(kit.random), ...pair } });
  const again = keptInspectorDevice(world.book.entries, PUBLIC_KEY_BYTES);
  if (again === null) throw failed('The world’s store did not keep the inspector’s key', 'E_WORLD');
  return again;
}

/** Posts the inspector's key in its directorate's space, once, and answers its fingerprint. */
export async function postInspectorKey(
  world: InspectorWorld,
  directorate: string,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<InspectorPosted> {
  const own = await inspectorDevice(world, kit);
  const holder: Holder = { id: own.device, publicKey: own.publicKey };
  const fingerprint = await kitStep(() => inspectorFingerprint(own.publicKey, worldKeyCrypto(kit, own)));
  const space = await kitStep(() => directorateSpace(world.world, directorate, kit.mac));
  const path = `/worlds/${world.world}/spaces/${space}`;
  const opened = await send({ method: 'PUT', path, body: { kind: 'directorate' } });
  if (opened.status !== 200 && opened.status !== 201) throw unexpected(opened);
  const place = await kitStep(() => inspectorKeyPlace(space, kit.mac));
  let refused: { readonly first: number; readonly answer: Awaited<ReturnType<Send>> } | null = null;
  for (let tries = 0; tries < TRIES; tries += 1) {
    const there = (await spaceBatches(world.world, space, send)).get(place.stream) ?? [];
    const records = await kitStep(() => openDirectorateRecords(place, there, kit.cipher));
    const posted = records.some((one) => {
      const read = readInspectorKey(one, PUBLIC_KEY_BYTES);
      return read?.world === world.world && read.holder.id === holder.id && read.holder.publicKey === holder.publicKey;
    });
    if (posted) return { holder, fingerprint };
    const first = there.reduce((most, one) => Math.max(most, one.number + 1), 0);
    if (refused !== null && refused.first === first) throw unexpected(refused.answer);
    const sealed = await kitStep(() =>
      sealDirectorateRecord(place, inspectorKey(world.world, holder), first, kit.cipher),
    );
    const body = { stream: place.stream, first, batches: sealed.map((one) => toBase64Url(one.bytes)) };
    const answer = await send({ method: 'POST', path: `${path}/batches`, body });
    if (answer.status === 201) return { holder, fingerprint };
    if (answer.status !== 409) throw unexpected(answer);
    refused = { first, answer };
  }
  throw failed('The directorate’s space kept changing', 'E_WORLD_SERVER');
}
