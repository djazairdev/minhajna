// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking one step of a pack release (#612, answer 767): reads the request and
// checks the signed steps it shows,
// checks it against the world's date and what the account may do
// (pack-rules.ts), signs it with the world's stand-in CA key and keeps it.

import { sign } from 'node:crypto';
import { caPublicKey, privateKeyOf, signedBy } from '../worlds/stand-in-ca.js';
import { packStepText, readStepRequest, refusal, type PackRole, type PackStep, type SignedStep } from './pack-rules.js';
import type { PackStore } from './pack-store.js';

export type TakenStep =
  | { readonly step: PackStep }
  | { readonly refused: 'shape' | 'role' | 'date' | 'revision' | 'gone' | 'full'; readonly message: string };

export interface PackDeskWorld {
  readonly world: string;
  readonly date: string;
  readonly caKey: string;
}

export async function takePackStep(
  packs: PackStore,
  { world, date, caKey }: PackDeskWorld,
  role: PackRole,
  body: unknown,
): Promise<TakenStep> {
  const read = readStepRequest(body);
  if (typeof read === 'string') return { refused: 'shape', message: read };
  if (read.day !== date) return { refused: 'date', message: "the world's date moved" };
  const ca = caPublicKey(caKey);
  const held = (step: SignedStep, release: string) =>
    step.release === release && signedBy(ca, packStepText(world, { ...step, id: read.id }), step.signature);
  const follows =
    read.expected === 0
      ? read.previous === null
      : read.previous?.revision === read.expected && held(read.previous, read.release);
  if (!follows) return { refused: 'revision', message: 'the step this one follows was not taken' };
  if (read.successor !== null && (read.by === null || !held(read.successor, read.by))) {
    return { refused: 'revision', message: 'the step that replaces this one was not taken' };
  }
  const problem = refusal(read, role, read.previous, read.successor);
  if (problem !== null) return { refused: 'role', message: problem };
  const { id, release, stage, status, digest, by, day } = read;
  const unsigned = { id, release, stage, status, digest, by, day, revision: read.expected + 1, role };
  const text = Buffer.from(packStepText(world, unsigned), 'utf8');
  const step = { ...unsigned, signature: sign('sha256', text, privateKeyOf(caKey)).toString('base64') };
  const kept = await packs.putStep(world, step);
  if (kept === 'no-world') return { refused: 'gone', message: 'no such world' };
  if (kept === 'full') return { refused: 'full', message: 'this world has taken all the steps it may' };
  return { step };
}
