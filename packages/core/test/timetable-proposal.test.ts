// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's timetable proposal and the decision on it (#578, answer 606): a
// proposal signed by the device that joined on the channel is read back
// waiting, the same one sent twice once, while one signed by another key, one
// for another channel, and any proposal on a channel nobody joined, are left
// out; the director's decision settles it, a later decision and one signed by
// the joined device are left out, as are a decision that names no proposal and
// one that came before its proposal; a decision signed with the joined device's
// key under another subject, and one naming another channel, are left out, and
// an accepted decision counts only once a part its key signed at its version
// holds the session the proposal moves at the proposed slot, not another key's
// part, another version's, nor another class at that slot; parts and proposals
// on one channel do not read each other; and a proposal or decision that is not
// of its shape, signed with another certificate, or sent on another code's
// channel, is refused. Every world, school, teacher and key is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sealRecord } from '../src/sealed-stream.ts';
import {
  certificateRequest,
  channelSealing,
  channelStream,
  partSessions,
  PART_BATCHES,
  sealPart,
  signPart,
  TIMETABLE_DECISION_FORMAT,
  type TimetablePart,
  channelParts,
  channelProposals,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  proposalId,
  sealJoined,
  sealTimetableRecord,
  signDecision,
  signProposal,
  startKeyring,
  type Certificate,
  type KeySigner,
  type SealedBatch,
  type SignedTimetable,
  type TimetableDecision,
  type TimetableProposal,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const SESSION = '0123456789abcdef0123456789abcdef';

async function certified(ca: KeySigner): Promise<{ signer: KeySigner; certificate: Certificate }> {
  const signer = keySigner();
  const request = await certificateRequest(WORLD, newId(random), signer);
  return { signer, certificate: await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca) };
}

async function setting() {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const other = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const ca = keySigner();
  const [head, teacher, stranger] = [await certified(ca), await certified(ca), await certified(ca)];
  const joined = { device: teacher.certificate.subject, certificate: teacher.certificate };
  const batches: SealedBatch[] = [...(await sealJoined(code, joined, cipher, mac, 0)).batches];
  const put = async (one: SignedTimetable<TimetableProposal | TimetableDecision>) =>
    batches.push(...(await sealTimetableRecord(code, one, batches.length, cipher, mac)).batches);
  const proposal = (start = 660, note = ''): TimetableProposal => ({
    world: WORLD,
    school: SCHOOL,
    assignment: code.assignment,
    issue: code.issue,
    version: 2,
    session: SESSION,
    day: 0,
    start,
    end: start + 60,
    room: 'القاعة 7',
    note,
  });
  const decision = (id: string, accepted = true): TimetableDecision => ({
    world: WORLD,
    school: SCHOOL,
    assignment: code.assignment,
    issue: code.issue,
    proposal: id,
    accepted,
    version: accepted ? 3 : null,
    note: '',
  });
  const read = (who: typeof joined | null = joined) =>
    channelProposals(code, batches, { key: ca.publicKey, checker: ca }, who, cipher, mac);
  return { code, other, ca, head, teacher, stranger, joined, batches, put, proposal, decision, read };
}

describe('a teacher’s proposal and the decision on it', () => {
  it('reads back the joined device’s proposal, settled by the first decision another key signed', async () => {
    const { head, teacher, stranger, batches, put, proposal, decision, read, ca, code } = await setting();
    const mine = await signProposal(proposal(660, 'يصبح يوم الأحد كله صباحاً.'), teacher.certificate, teacher.signer);
    const early = await signDecision(decision(await proposalId(SCHOOL, mine.text, mac)), head.certificate, head.signer);
    await put(early);
    await put(mine);
    await put(mine);
    await put(await signProposal(proposal(720), stranger.certificate, stranger.signer));
    await put(await signDecision(decision(SESSION), head.certificate, head.signer));
    const [waiting, ...rest] = await read();
    assert.equal(rest.length, 0);
    assert.equal(waiting!.id, await proposalId(SCHOOL, mine.text, mac));
    assert.equal(waiting!.proposal.value.note, 'يصبح يوم الأحد كله صباحاً.');
    assert.equal(waiting!.decision, null);
    await put(await signDecision(decision(waiting!.id, false), teacher.certificate, teacher.signer));
    assert.equal((await read())[0]!.decision, null);
    await put(await signDecision(decision(waiting!.id, false), head.certificate, head.signer));
    await put(await signDecision(decision(waiting!.id, true), head.certificate, head.signer));
    const settled = (await read())[0]!.decision!;
    assert.deepEqual([settled.value.accepted, settled.value.version], [false, null]);
    assert.equal(settled.certificate.subject, head.certificate.subject);
    assert.deepEqual(await read(null), []);
    const checker = { key: ca.publicKey, checker: ca };
    assert.deepEqual(await channelParts(code, batches, checker, null, cipher, mac), []);
    for (const batch of batches) assert.equal(batch.bytes.length, batches[0]!.bytes.length);
  });

  it('counts an accepted decision once its part is there, never the joined key’s or another channel’s', async () => {
    const { code, other, ca, head, teacher, stranger, batches, put, proposal, decision, read } = await setting();
    const lesson = async (klass: string, start: number) => {
      const one = { row: 2, class: klass, group: '', subject: 'العربية', teacher: 'مختلق', room: 'القاعة 7' } as const;
      return partSessions(SCHOOL, [{ ...one, day: 0, start, end: start + 60, week: 'both' }], mac);
    };
    const part = (version: number, sessions: TimetablePart['sessions']): TimetablePart => ({
      world: WORLD,
      school: SCHOOL,
      schoolName: 'متوسطة المختلقة',
      assignment: code.assignment,
      issue: code.issue,
      teacher: 'مختلق',
      version,
      from: parseDay('2026-12-06'),
      once: false,
      sessions,
      bells: [],
    });
    const send = async (version: number, sessions: TimetablePart['sessions'], by = head) =>
      batches.push(
        ...(
          await sealPart(
            code,
            await signPart(part(version, sessions), by.certificate, by.signer),
            batches.length,
            cipher,
            mac,
          )
        ).batches,
      );
    const [before, after, another] = [await lesson('4م3', 840), await lesson('4م3', 660), await lesson('4م1', 660)];
    await send(2, before);
    const mine = await signProposal({ ...proposal(), session: before[0]!.id }, teacher.certificate, teacher.signer);
    await put(mine);
    const id = await proposalId(SCHOOL, mine.text, mac);
    const again = await certificateRequest(WORLD, newId(random), teacher.signer);
    const reused = await issueCertificate(again, parseDay('2026-12-01'), newId(random), ca);
    await put(await signDecision(decision(id, false), reused, teacher.signer));
    const { text, signature, certificate } = await signDecision(
      { ...decision(id, false), assignment: other.assignment },
      head.certificate,
      head.signer,
    );
    const place = { stream: await channelStream(code, mac), sealing: await channelSealing(code, mac) };
    const value = { format: TIMETABLE_DECISION_FORMAT, text, signature, certificate };
    batches.push(...(await sealRecord(place, value, batches.length, PART_BATCHES, cipher)));
    await put(await signDecision(decision(id, true), head.certificate, head.signer));
    assert.equal((await read())[0]!.decision, null);
    await send(3, after, stranger);
    await send(3, another);
    assert.equal((await read())[0]!.decision, null);
    await put(await signDecision({ ...decision(id, true), version: 4 }, head.certificate, head.signer));
    await send(4, after);
    const settled = (await read())[0]!.decision!;
    assert.deepEqual(
      [settled.value.accepted, settled.value.version, settled.certificate.subject],
      [true, 4, head.certificate.subject],
    );
  });

  it('refuses a record that is not of its shape, another key’s certificate, and another code’s channel', async () => {
    const { other, head, teacher, proposal, decision } = await setting();
    const id = SESSION;
    for (const wrong of [
      { ...proposal(), extra: 1 },
      { ...proposal(), note: 'م'.repeat(281) },
      { ...proposal(), note: 'ملاحظة\u202e' },
      { ...proposal(), end: 660 },
      { ...proposal(), day: 7 },
      { ...proposal(), session: 'short' },
      { ...proposal(), version: 0 },
      Object.fromEntries(Object.entries(proposal()).filter(([key]) => key !== 'note')),
    ])
      await assert.rejects(signProposal(wrong as TimetableProposal, teacher.certificate, teacher.signer), /Not a/u);
    for (const wrong of [
      { ...decision(id), version: null },
      { ...decision(id, false), version: 3 },
      { ...decision(id), proposal: 'short' },
      { ...decision(id), accepted: 'yes' },
    ])
      await assert.rejects(signDecision(wrong as TimetableDecision, head.certificate, head.signer), /Not a/u);
    await assert.rejects(signProposal(proposal(), teacher.certificate, keySigner()), /another key/u);
    const signed = await signProposal(proposal(660, 'م'.repeat(280)), teacher.certificate, teacher.signer);
    await assert.rejects(sealTimetableRecord(other, signed, 0, cipher, mac), /own code/u);
  });
});
