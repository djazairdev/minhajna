// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// ZIP archives on a PC, in the forms the phone writes and reads (AesZip.kt,
// ZipRead.kt): plain and deflated, or AES-256 in WinZip's AE-2 form, which
// 7-Zip, WinRAR and WPS open with the password (R-5.9-15). zip.js does the
// format and its AES, which Web Crypto's counter mode cannot, with the
// browser's own compression and no worker or WebAssembly, which the page's
// security policy refuses. A picked archive is untrusted: one file is read
// from it by its exact name, and refused as the phone refuses it, with its
// reason: not an archive, a password that does not open it, a change, its
// size, or no password where one was wanted.

import {
  BlobReader,
  BlobWriter,
  TextReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
  configure,
  type Entry,
} from '@zip.js/zip.js/lib/zip-core-native.js';
import { ENTRY_LIMIT, ZIP_LIMIT, refused } from './picked.ts';

configure({ useWebWorkers: false });

const AES_256 = 3;
const encoder = new TextEncoder();

/** The texts as files of one archive: AES-256 under the password when there is one, each with a salt of its own. */
export async function zipTexts(files: readonly (readonly [string, string])[], password: string): Promise<Blob> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    useWebWorkers: false,
    ...(password === '' ? {} : { password, encryptionStrength: AES_256, zipCrypto: false }),
  });
  for (const [name, text] of files) await writer.add(name, new TextReader(text), { useUnicodeFileNames: true });
  return writer.close();
}

function refusal(reason: 'NOT_ARCHIVE' | 'PASSWORD' | 'CHANGED' | 'TOO_LARGE' | 'PLAIN'): Error {
  return refused(`E_ZIP_${reason}`, 'The archive was refused');
}

const CHANGED = [
  'Invalid authentication code',
  'Invalid CRC32',
  'Invalid compressed data',
  'Invalid uncompressed size',
  'Overlapping entry found',
  'Entry data out of bounds',
  'Ambiguous archive',
  'Local file header not found',
];

/** zip.js's error as the phone's reason. */
function reasonOf(error: unknown): Error {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Invalid password') return refusal('PASSWORD');
  if (CHANGED.includes(message)) return refusal('CHANGED');
  return refusal('NOT_ARCHIVE');
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, at) => byte === b[at]);
}

/** The archive's file `entry` as UTF-8 text, opened with `password` when encrypted, as it must be when `sealed`. */
export async function readEntry(archive: Blob, entry: string, password: string, sealed: boolean): Promise<string> {
  if (archive.size > ZIP_LIMIT) throw refusal('TOO_LARGE');
  const reader = new ZipReader(new BlobReader(archive), { useWebWorkers: false, strictness: 'strict' });
  try {
    let entries: Entry[];
    try {
      entries = await reader.getEntries();
    } catch (error) {
      throw reasonOf(error);
    }
    const name = encoder.encode(entry);
    const found = entries.filter((each) => sameBytes(each.rawFilename, name));
    if (found.length === 0) throw refusal('NOT_ARCHIVE');
    if (found.length > 1) throw refusal('CHANGED');
    const [file] = found;
    if (file === undefined || file.directory) throw refusal('NOT_ARCHIVE');
    if (file.uncompressedSize > ENTRY_LIMIT) throw refusal('TOO_LARGE');
    if (!file.encrypted && sealed) throw refusal('PLAIN');
    if (file.encrypted && (file.zipCrypto || file.extraFieldAES?.strength !== AES_256)) throw refusal('NOT_ARCHIVE');
    if (file.encrypted && password === '') throw refusal('PASSWORD');
    let bytes: Uint8Array;
    try {
      bytes = await file.getData(new Uint8ArrayWriter(), {
        useWebWorkers: false,
        checkSignature: true,
        ...(file.encrypted ? { password } : {}),
      });
    } catch (error) {
      throw reasonOf(error);
    }
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      throw refusal('NOT_ARCHIVE');
    }
  } finally {
    await reader.close().catch(() => undefined);
  }
}
