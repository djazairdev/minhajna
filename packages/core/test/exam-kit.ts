// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up school exam's chart and cut room for the thresholds' tests (#601,
// answer 632): a chart of two setters and two classes, and a room with its
// decider, both setters and a stranger, each with a key the world's CA
// certified. Every school, class, teacher and pack is made up.

import type { SealedBatch } from '../src/batches.ts';
import { certificateRequest, issueCertificate, type Certificate, type KeySigner } from '../src/certify.ts';
import { newId } from '../src/id.ts';
import { parseDay, roomPlace, roomRecords, sealRoomRecord, signRoomRecord } from '../src/index.ts';
import type { ExamChart, ExamCut, RoomKind } from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

export const WORLD = 'K7QF4';
const day = (text: string) => parseDay(text);

/** A signing key the CA certified, of the made-up world. */
export async function certified(ca: KeySigner): Promise<{ signer: KeySigner; certificate: Certificate }> {
  const signer = keySigner();
  const request = await certificateRequest(WORLD, newId(random), signer);
  return { signer, certificate: await issueCertificate(request, parseDay('2029-09-01'), newId(random), ca) };
}

/** A made-up chart, the setters' keys given or made up. */
export const madeUpChart = (
  more: Partial<ExamChart> = {},
  keys = ['a', 'b'].map((one) => madeUpKey(one)),
): ExamChart => ({
  world: WORLD,
  school: SCHOOL,
  exam: 'term-1',
  subject: 'arabic',
  grade: '4am',
  from: day('2029-12-02'),
  figuresDay: day('2029-11-22'),
  signBy: day('2029-11-27'),
  forecastDay: day('2029-11-29'),
  pack: { id: 'dz.cem.4am.arabic.made-up', release: '2029.1' },
  items: ['u1', 'u1.w1', 'u1.w2', 'u2', 'u2.w1', 'u2.w2', 'u3'],
  setters: [
    { assignment: '0123456789abcdef0123456789abcdef', name: 'أستاذ أول', key: keys[0]! },
    { assignment: 'fedcba9876543210fedcba9876543210', name: 'أستاذ ثان', key: keys[1]! },
  ],
  classes: [
    { name: '4م1', position: 'u2.w1', forecast: 'u2.w2' },
    { name: '4م2', position: null, forecast: null },
  ],
  ...more,
});

/** A key of the certificates' shape that no device holds. */
export function madeUpKey(letter: string, last = 'A'): string {
  return `MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE${letter.repeat(85)}${last}==`;
}

/** A room with its decider, its two setters and a stranger, and what puts and reads its records. */
export async function madeUpRoom() {
  const ca = keySigner();
  const [decider, first, second, stranger] = await Promise.all([1, 2, 3, 4].map(() => certified(ca)));
  const chart = madeUpChart({}, [first!.certificate.publicKey, second!.certificate.publicKey]);
  const place = await roomPlace(random(32), mac);
  const batches: SealedBatch[] = [];
  const put = async (kind: RoomKind, value: ExamChart | ExamCut, by: Awaited<ReturnType<typeof certified>>) =>
    batches.push(
      ...(await sealRoomRecord(
        place,
        await signRoomRecord(kind, value, by.certificate, by.signer),
        batches.length,
        cipher,
      )),
    );
  const cut = (item: string | null, signed = '2029-11-23', version = 0): ExamCut => ({
    world: WORLD,
    school: SCHOOL,
    exam: chart.exam,
    subject: chart.subject,
    grade: chart.grade,
    item,
    day: day(signed),
    version,
  });
  const room = { name: chart, decider: decider!.certificate.publicKey };
  const read = () => roomRecords(place, batches, { key: ca.publicKey, checker: ca }, room, cipher);
  return {
    ca,
    decider: decider!,
    first: first!,
    second: second!,
    stranger: stranger!,
    chart,
    place,
    batches,
    put,
    cut,
    read,
  };
}
