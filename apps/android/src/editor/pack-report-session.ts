// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Plan-error reports on a national world's space (#616, R-4.3-20, answer 770):
// a teacher's device puts each one on the stream once, dated by the world, with
// no new server endpoint, and the curators' page reads them all. The same words
// sent twice are one report. A world's date that moved on is read, not refused,
// since a report waits for nobody.

import {
  openPackReports,
  packReportPlace,
  sealPackReport,
  type PackReport,
  canonicalJson,
  isDay,
} from '@minhajna/core';
import { NATIONAL_SPACE } from '../demo/world-calendar-read';
import { kitStep, type Send } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';
import { putOnce, readingMissing } from '../school/stream-put';
import { packDesk, type PackEditor } from './pack-release-session';

type Reader = Pick<PackEditor, 'world' | 'held' | 'profile' | 'kit'>;

const placeOf = (editor: Reader) => kitStep(() => packReportPlace(editor.held!.sealing, editor.kit.mac));

/** Every report that reads, the latest first. */
export async function readPackReports(editor: Reader, send: Send = worldRequest): Promise<PackReport[]> {
  const { world } = await packDesk(editor, send, true);
  const place = await placeOf(editor);
  const missing = readingMissing(world.world, send, () => ({
    status: 200,
    body: { batches: [], more: false },
    retryAfter: null,
  }));
  const batches = (await spaceBatches(world.world, NATIONAL_SPACE, missing)).get(place.stream) ?? [];
  const reports = await kitStep(() => openPackReports(place, batches, editor.kit.cipher));
  return reports.reverse();
}

/** Puts the report on the stream, dated by the world; the same report already there isn't put again. */
export async function sendPackReport(
  editor: Reader,
  report: Omit<PackReport, 'day'>,
  send: Send = worldRequest,
): Promise<PackReport> {
  const { world } = await packDesk(editor, send, true);
  if (!isDay(world.date)) throw new RangeError('The world has no date');
  const dated: PackReport = { ...report, day: world.date };
  const place = await placeOf(editor);
  const { cipher } = editor.kit;
  await putOnce(
    {
      world: world.world,
      space: NATIONAL_SPACE,
      kind: 'national',
      stream: place.stream,
      open: (batches) => openPackReports(place, batches, cipher),
      there: (records) =>
        records.some((one) => canonicalJson({ ...(one as PackReport), day: dated.day }) === canonicalJson(dated)),
      seal: (first) => sealPackReport(place, dated, first, cipher),
    },
    send,
  );
  return dated;
}
