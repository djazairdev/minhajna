// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo server's stand-in for the state's receiving system, as a device
// reaches it (#591, answer 619), with the world's pass like every world
// request: the public half a delivery is sealed for, which must be marked a
// stand-in's and be a point on P-256; a signed term export sealed for it alone
// under the world and the kind (world-key-crypto.ts), sent in base64, answered
// with its receipt, 201 when new and 200 when the same export came before, or
// refused with the server's reason, said as E_STATE_REFUSED; and the world's
// receipts, newest first. A receipt is marked a stand-in's and names no pupil.

import { deliveryInfo, isDay, toBase64Url, type Day, type SignedExport } from '@minhajna/core';
import { isPoint, sealTo } from '../demo/world-key-crypto';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { fromHex } from '../storage/history';

/** What the stand-in answers for a delivery it took: no pupil, only the export's head and its count. */
export interface StandInReceipt {
  readonly standIn: true;
  readonly id: string;
  readonly kind: 'marks';
  readonly term: number;
  readonly class: string;
  readonly subject: string;
  readonly rows: number;
  readonly signed: Day;
  readonly received: Day;
  readonly signer: string;
}

/** Whether an answer is a receipt as the stand-in writes it. */
export function isReceipt(value: unknown): value is StandInReceipt {
  const one = (value ?? {}) as Record<string, unknown>;
  const day = (field: unknown) => typeof field === 'string' && isDay(field);
  return (
    one['standIn'] === true &&
    typeof one['id'] === 'string' &&
    one['kind'] === 'marks' &&
    Number.isSafeInteger(one['term']) &&
    typeof one['class'] === 'string' &&
    typeof one['subject'] === 'string' &&
    Number.isSafeInteger(one['rows']) &&
    day(one['signed']) &&
    day(one['received']) &&
    typeof one['signer'] === 'string'
  );
}

/** Bytes in base64 with its padding, as the stand-in reads what is sealed. */
export const toBase64 = (bytes: Uint8Array) => {
  const text = toBase64Url(bytes).replaceAll('-', '+').replaceAll('_', '/');
  return text.padEnd(Math.ceil(text.length / 4) * 4, '=');
};

/** The public half deliveries to the world's stand-in are sealed for. */
export async function receiverPoint(world: string, send: Send): Promise<Uint8Array> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/state/receiver` });
  const body = (answer.body ?? {}) as { standIn?: unknown; publicKey?: unknown };
  const hex = typeof body.publicKey === 'string' && /^[0-9a-f]{130}$/.test(body.publicKey) ? body.publicKey : null;
  const point = hex === null ? null : fromHex(hex);
  if (answer.status !== 200 || body.standIn !== true || point === null || !isPoint(point)) throw unexpected(answer);
  return point;
}

/** Seals a signed export for the world's stand-in and sends it: its receipt, and whether it came before. */
export async function deliverMarks(
  world: string,
  signed: SignedExport,
  kit: WorldKit,
  send: Send,
): Promise<{ readonly receipt: StandInReceipt; readonly again: boolean }> {
  const point = await receiverPoint(world, send);
  const plain = new TextEncoder().encode(JSON.stringify(signed));
  const sealed = await kitStep(() => sealTo(kit, plain, point, deliveryInfo(world, 'marks')));
  const body = { kind: 'marks', sealed: toBase64(sealed) };
  const answer = await send({ method: 'POST', path: `/worlds/${world}/state/deliveries`, body });
  if (answer.status === 400 || answer.status === 409 || answer.status === 422) {
    const reason = (answer.body as { message?: unknown } | null)?.message;
    throw failed(`The stand-in refused the delivery: ${String(reason)}`, 'E_STATE_REFUSED');
  }
  if ((answer.status !== 200 && answer.status !== 201) || !isReceipt(answer.body)) throw unexpected(answer);
  return { receipt: answer.body, again: answer.status === 200 };
}

/** The world's receipts, newest first. */
export async function standInReceipts(world: string, send: Send): Promise<StandInReceipt[]> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/state/deliveries` });
  const receipts = (answer.body as { receipts?: unknown } | null)?.receipts;
  if (answer.status !== 200 || !Array.isArray(receipts) || !receipts.every(isReceipt)) throw unexpected(answer);
  return receipts;
}
