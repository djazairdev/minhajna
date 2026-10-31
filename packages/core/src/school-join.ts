// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's joining code and the teacher's channel to the school (#564, PRD
// §5.8, §7.5, answer 581). A device that holds the school key makes, from the
// official assignment list, one code for each teacher's assignment: the world,
// the school, the school key's epoch, the assignment, which issue of its code
// this is, and the channel's key, derived for that assignment and issue alone
// from the epoch's key for joining, so a code opens nothing but its own channel
// and a new issue replaces a lost one. The teacher scans it once; the device
// makes its signing key, has the world's CA certify it, and sends the school,
// on the channel, that it joined: its device ID and the certificate. The
// channel is a stream of the school's space named by a MAC under its key, so
// the server sees neither the assignment nor the teacher, and its batches are
// sealed under another key derived from it, so the server can neither read nor
// change them, though it can drop them. The first joined record on a channel
// that reads, for its own code, with the world CA's certificate for the device
// it names, is the channel's, and its key signs the assignment's weeks (answer
// 566): whoever else holds the code, such as a device removed from the school
// key or someone who photographed it, cannot replace it, and the teacher's
// device reads the channel back to see that its record came first. A teacher
// who rejoins, or whose code went astray, gets a new issue. A device removed
// from the school key keeps the old epochs' keys, so after a removal the school
// issues every code not yet scanned again under the new epoch (#570).

import { canonicalJson } from './canonical.ts';
import { checkCertificate, isCertificate, type Certificate, type KeyChecker } from './certify.ts';
import { keyedCipher, openBatches, pieceRoom, sealBatches, SYNC_BATCH_BYTES, type SealedBatch } from './batches.ts';
import { toHex } from './id.ts';
import { ascii, fromHex, ID, SCHOOL, type KeyCrypto } from './school-key-shape.ts';
import { latestEpoch, purposeKey, type OpenedKeyring } from './school-key.ts';
import { isWorldId } from './world-code.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** What a joining code's QR holds before its fields. */
export const JOIN_CODE_PREFIX = 'minhajna-join:1:';
export const JOINED_FORMAT = 'minhajna/joined/1';

/** A school's joining code for one assignment, as its QR holds it. */
export interface JoinCode {
  readonly world: string;
  readonly school: string;
  /** The school key's epoch the channel's key derives from. */
  readonly epoch: number;
  readonly assignment: string;
  /** Which code the school has issued for the assignment, from 1. */
  readonly issue: number;
  /** The channel's key, 32 bytes in hex. */
  readonly key: string;
}

/** That a device joined on its code's channel, with its certified signing key. */
export interface Joined {
  readonly device: string;
  readonly certificate: Certificate;
}

const KEY = /^[0-9a-f]{64}$/u;
const COUNT = /^(?:0|[1-9][0-9]{0,8})$/u;
/** The largest epoch or issue a code's QR writes: nine digits. */
const MOST = 999_999_999;

/** A joining code for an assignment, under the school key's latest epoch unless another is named. */
export async function makeJoinCode(
  opened: OpenedKeyring,
  world: string,
  assignment: string,
  issue: number,
  crypto: KeyCrypto,
  epoch = latestEpoch(opened),
): Promise<JoinCode> {
  const counts = Number.isSafeInteger(issue) && issue >= 1 && issue <= MOST && epoch <= MOST;
  if (!isWorldId(world) || !ID.test(assignment) || !counts) {
    throw new RangeError('A joining code names its world, its assignment and its issue');
  }
  const joining = await purposeKey(opened, epoch, 'teacher-join', crypto);
  const key = await crypto.mac(joining, ascii(`minhajna/join/channel\n${assignment}\n${issue}`));
  return { world, school: opened.ring.school, epoch, assignment, issue, key: toHex(key) };
}

/** The text of a code's QR. */
export function joinCodeText(code: JoinCode): string {
  const { world, school, epoch, assignment, issue, key } = code;
  return `${JOIN_CODE_PREFIX}${world}:${school}:${epoch}:${assignment}:${issue}:${key}`;
}

/** The joining code a scanned QR holds, exactly as a school's device wrote it, or null. */
export function readJoinCode(text: string): JoinCode | null {
  if (!text.startsWith(JOIN_CODE_PREFIX)) return null;
  const [world = '', school = '', epoch = '', assignment = '', issue = '', key = '', ...rest] = text
    .slice(JOIN_CODE_PREFIX.length)
    .split(':');
  if (rest.length > 0 || !isWorldId(world) || !SCHOOL.test(school) || !ID.test(assignment) || !KEY.test(key)) {
    return null;
  }
  if (!COUNT.test(epoch) || !COUNT.test(issue) || issue === '0') return null;
  return { world, school, epoch: Number(epoch), assignment, issue: Number(issue), key };
}

/** The stream of the school's space that carries a code's channel. */
export async function channelStream(code: JoinCode, mac: WorldMac): Promise<string> {
  return toHex((await mac(fromHex(code.key), ascii('minhajna/join/stream'))).subarray(0, 16));
}

/** The key a code's channel is sealed under, apart from the one that names its stream. */
export function channelSealing(code: JoinCode, mac: WorldMac): Promise<Uint8Array> {
  return mac(fromHex(code.key), ascii('minhajna/join/seal'));
}

/**
 * The batch that tells the school a device joined on a code's channel, numbered `first`: the stream's next number,
 * which the relay names when it refuses one already taken, so nothing put there before holds the record back.
 */
export async function sealJoined(
  code: JoinCode,
  joined: Joined,
  cipher: WorldCipher,
  mac: WorldMac,
  first = 0,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { device, certificate } = joined;
  if (!ID.test(device) || !isCertificate(certificate) || certificate.subject !== device) {
    throw new RangeError('A joined device sends its own certificate');
  }
  if (certificate.world !== code.world) throw new RangeError('The certificate is of another world');
  if (!Number.isSafeInteger(first) || first < 0) throw new RangeError('A batch is numbered from 0');
  const { world, school, assignment, issue } = code;
  const record = { format: JOINED_FORMAT, world, school, assignment, issue, device, certificate };
  const stream = await channelStream(code, mac);
  const bytes = ascii(canonicalJson(record));
  if (bytes.length > pieceRoom(SYNC_BATCH_BYTES)) throw new RangeError('A joined record fits one batch');
  return {
    stream,
    batches: await sealBatches(
      keyedCipher(await channelSealing(code, mac), cipher),
      stream,
      first,
      bytes,
      SYNC_BATCH_BYTES,
    ),
  };
}

function joinedIn(bytes: Uint8Array, code: JoinCode): Joined | null {
  try {
    const value: unknown = JSON.parse(String.fromCharCode(...bytes));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const { format, world, school, assignment, issue, device, certificate, ...rest } = value as Record<string, unknown>;
    if (format !== JOINED_FORMAT || Object.keys(rest).length > 0 || typeof device !== 'string') return null;
    const ours = world === code.world && school === code.school && assignment === code.assignment;
    if (!ours || issue !== code.issue || !ID.test(device) || !isCertificate(certificate)) return null;
    return certificate.subject === device ? { device, certificate } : null;
  } catch {
    return null;
  }
}

/**
 * The device that joined on a code's channel: of the stream's batches, the
 * first that holds on its own a record for this code whose certificate is
 * the world CA's for the device it names, or null when there is none yet. A
 * joined record always fits one batch, so what else the channel carries, or
 * a batch that does not open, never hides it.
 */
export async function readJoined(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: { readonly key: string; readonly checker: KeyChecker },
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<Joined | null> {
  const [stream, opener] = [await channelStream(code, mac), keyedCipher(await channelSealing(code, mac), cipher)];
  for (const batch of [...batches].sort((a, b) => a.number - b.number)) {
    const [set] = await openBatches(opener, stream, [batch]).catch((): Uint8Array[] => []);
    const joined = set === undefined ? null : joinedIn(set, code);
    if (joined !== null && (await checkCertificate(joined.certificate, code.world, ca.key, ca.checker))) return joined;
  }
  return null;
}
