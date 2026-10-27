// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The files module on a PC (#250, part 3), as the phone's (#242, #247): a
// file made from text, or from several in one ZIP, AES-256 under a password
// when one is given, is kept in this page's memory under a random token,
// which is all the app sees. Saving opens the browser's save dialog where
// it has one, and says when the teacher closes it; elsewhere the file is
// downloaded, which the page cannot follow, and counts as saved. Sending
// hands it to the system's share screen, and fails where the browser has
// none or refuses the file, as Chrome refuses a ZIP; it never turns into a
// download. Either way the file is dropped from memory then. A file the
// teacher picks comes through the browser's file dialog, on this computer
// only: a text file gives its text, an archive is kept under a token until
// it is dropped, and its one file read with its password. A PDF is not made
// on a PC, which prints through the browser instead (answer 507).

import type { Spec } from '../../../android/src/native/NativeMinhajnaFiles';
import { ZIP_LIMIT, fileNameAllowed, fileText, pickFile, pickerOpen, refused } from './files/picked.ts';
import { readEntry, zipTexts } from './files/zip.ts';

/** A made or picked file, kept in memory under its token. */
const kept = new Map<string, File>();
let reading = false;

function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function keep(file: File): string {
  const token = newToken();
  kept.set(token, file);
  return token;
}

function fileOf(token: string): File {
  const file = kept.get(token);
  if (file === undefined) throw refused('E_FILE', 'No such file');
  return file;
}

/** Hands the file to the browser as a download, under its name. */
export function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface Writable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

/** Saves the file where the teacher picks: false when the save dialog is closed; a download where there is none. */
export async function save(file: File): Promise<boolean> {
  const picker: unknown = Reflect.get(globalThis, 'showSaveFilePicker');
  if (typeof picker !== 'function') {
    download(file);
    return true;
  }
  let handle: { createWritable(): Promise<Writable> };
  try {
    handle = (await Reflect.apply(picker, globalThis, [{ suggestedName: file.name }])) as typeof handle;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return false;
    download(file);
    return true;
  }
  let writable: Writable | null = null;
  try {
    writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return true;
  } catch {
    await writable?.abort().catch(() => undefined);
    throw refused('E_FILE', 'The file could not be saved');
  }
}

/** Hands the file to the system's share screen; rejects with `code` where there is none or it refuses the file. */
export async function share(file: File, title: string, code: string): Promise<void> {
  if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) {
    throw refused(code, 'This browser cannot share the file');
  }
  try {
    await navigator.share({ files: [file], title });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    throw refused(code, 'This browser cannot share the file');
  }
}

/** Opens the file dialog once at a time, as the phone's picker, and reads the file picked. */
async function picked<T>(accept: string, read: (file: File) => Promise<T>): Promise<T | null> {
  if (pickerOpen() || reading) throw refused('E_FILE_BUSY', 'A picker is open');
  const file = await pickFile(accept);
  if (file === null) return null;
  reading = true;
  try {
    return await read(file);
  } finally {
    reading = false;
  }
}

/** The texts zipped under `fileName` and `.zip`, kept under a token; a failure is the phone's E_FILE. */
async function keepZip(files: readonly (readonly [string, string])[], fileName: string, password: string) {
  try {
    return keep(new File([await zipTexts(files, password)], `${fileName}.zip`, { type: 'application/zip' }));
  } catch {
    throw refused('E_FILE', 'The file could not be made');
  }
}

const Files: Spec = {
  async makeText(text, fileName, password) {
    if (!fileNameAllowed(fileName)) throw refused('E_FILE_NAME', 'A file name has no folder in it');
    if (password === '') return keep(new File([text], fileName, { type: 'application/octet-stream' }));
    return keepZip([[fileName, text]], fileName, password);
  },
  async makeZip(names, texts, fileName, password) {
    if (names.length !== texts.length) throw refused('E_FILE_NAME', 'Each file needs a name');
    const named = names.length > 0 && new Set(names).size === names.length;
    if (!named || !names.every(fileNameAllowed) || !fileNameAllowed(`${fileName}.zip`)) {
      throw refused('E_FILE_NAME', 'Each file needs a name of its own, with no folder in it');
    }
    return keepZip(
      names.map((name, at) => [name, texts[at] ?? ''] as const),
      fileName,
      password,
    );
  },
  adoptPdf: () => Promise.reject(refused('E_WEB_PHONE_ONLY', 'A PC prints through the browser instead')),
  saveFile: (token) =>
    Promise.resolve(token).then((held) => {
      const file = fileOf(held);
      kept.delete(held);
      return save(file);
    }),
  async shareFile(token, title) {
    const file = fileOf(token);
    kept.delete(token);
    await share(file, title, 'E_FILE');
  },
  openText: () => picked('.csv,.txt,.tsv,text/*', fileText),
  openZip: () =>
    picked('.zip,application/zip', (file) => {
      if (file.size > ZIP_LIMIT) return Promise.reject(refused('E_ZIP_TOO_LARGE', 'The archive is over 16 MB'));
      return Promise.resolve({ token: keep(file), name: file.name.slice(0, 120) });
    }),
  readZip: async (token, entry, password, sealed) => readEntry(fileOf(token), entry, password, sealed),
  dropFile(token) {
    kept.delete(token);
  },
};

export default Files;
