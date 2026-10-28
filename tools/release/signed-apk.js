// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Checks that each signed APK is its reproducible build plus a signature and
// nothing else (releases.md, item 12): the same entries, zero padding, the APK
// Signing Block, then the same central directory and end record, whose
// central-directory offset alone may differ, and no v1 signature added.
// `node tools/release/signed-apk.js <signed> <unsigned> …`, with any number
// of pairs, prints one line for each pair and exits 1 if any differs. Only
// Node's built-ins are used.

import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const MAGIC = Buffer.from('APK Sig Block 42');

/** Where the end record starts, and the central directory's offset it gives. */
function layout(data) {
  const end = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end === -1) throw new Error('no ZIP end record');
  return { end, directory: data.readUInt32LE(end + 16) };
}

/** Why `signed` is more than `unsigned` plus a signature, or undefined when it is only that. */
export function signatureOnly(signed, unsigned) {
  const s = layout(signed);
  const u = layout(unsigned);
  if (!signed.subarray(s.directory - 16, s.directory).equals(MAGIC)) return 'no APK Signing Block';
  const size = signed.readBigUInt64LE(s.directory - 24);
  const start = s.directory - Number(size) - 8;
  if (start < 0 || signed.readBigUInt64LE(start) !== size) return 'the signing block sizes disagree';
  if (!signed.subarray(0, u.directory).equals(unsigned.subarray(0, u.directory))) return 'the entries differ';
  if (start < u.directory || signed.subarray(u.directory, start).some((byte) => byte !== 0)) {
    return 'non-zero bytes between the entries and the signing block';
  }
  if (!signed.subarray(s.directory, s.end + 16).equals(unsigned.subarray(u.directory, u.end + 16))) {
    return 'the central directory differs';
  }
  if (!signed.subarray(s.end + 20).equals(unsigned.subarray(u.end + 20))) return 'the end record differs';
  const meta = Buffer.from('META-INF/');
  if (signed.subarray(s.directory, s.end).includes(meta) && !unsigned.subarray(u.directory, u.end).includes(meta)) {
    return 'a v1 signature was added';
  }
  return undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  if (paths.length === 0 || paths.length % 2 !== 0) throw new Error('Give pairs of a signed APK and its build');
  let failed = false;
  for (let at = 0; at < paths.length; at += 2) {
    const [signed = '', unsigned = ''] = paths.slice(at, at + 2);
    const problem = signatureOnly(readFileSync(signed), readFileSync(unsigned));
    process.stdout.write(`${signed}: ${problem ?? `${unsigned} plus its signature, nothing else`}\n`);
    failed ||= problem !== undefined;
  }
  process.exitCode = failed ? 1 : 0;
}
