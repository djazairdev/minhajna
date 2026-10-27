// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a file the teacher picks on a PC gives the app, as on the phone
// (PickedFiles.kt): the browser's own file dialog opens on this computer's
// files, one at a time, and gives null when it is closed. A browser that
// says nothing as the dialog closes leaves it open to the page; once the
// page has its focus back, the teacher has left that dialog, so the next
// pick replaces it rather than waiting, and a late file still counts until
// then. A text file gives its text: UTF-16 after its byte-order mark, as
// Excel saves Unicode text, else UTF-8, or Arabic Windows' code page when
// it is not, as Excel saves a CSV file. A ZIP archive, an old .xls workbook
// or a PDF is not text, and a file over 2 MB is refused.

export const TEXT_LIMIT = 2 * 1024 * 1024;
export const ZIP_LIMIT = 16 * 1024 * 1024;
export const ENTRY_LIMIT = 32 * 1024 * 1024;

const BINARY_STARTS = [
  [0x50, 0x4b, 0x03, 0x04],
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  [0x25, 0x50, 0x44, 0x46, 0x2d],
];

/** An error with the native module's code. */
export function refused(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

/** The dialog open now, and whether the page has had its focus back since. */
let open: { finish: (file: File | null) => void; back: boolean } | null = null;

/** Whether a file dialog is open that the teacher has not left. */
export function pickerOpen(): boolean {
  return open !== null && !open.back;
}

/** Opens the browser's file dialog, in place of one the teacher left; the picked file, or null when it is closed. */
export function pickFile(accept: string): Promise<File | null> {
  open?.finish(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    let settled = false;
    const focused = () => {
      if (open === mine) mine.back = true;
    };
    const mine = {
      back: false,
      finish(file: File | null) {
        if (settled) return;
        settled = true;
        if (open === mine) open = null;
        window.removeEventListener('focus', focused);
        resolve(file);
      },
    };
    open = mine;
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => mine.finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => mine.finish(null), { once: true });
    input.click();
    window.addEventListener('focus', focused);
  });
}

/** Whether the bytes begin as a ZIP archive, an old Office file or a PDF does. */
export function binary(bytes: Uint8Array): boolean {
  return BINARY_STARTS.some((start) => bytes.length >= start.length && start.every((byte, at) => bytes[at] === byte));
}

/** The bytes as text: UTF-16 after its mark, UTF-8 when they are, else Arabic Windows' code page. */
export function textOf(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1256').decode(bytes);
  }
}

/** The picked file's text, refused over 2 MB or when it is not text. */
export async function fileText(file: File): Promise<string> {
  if (file.size > TEXT_LIMIT) throw refused('E_FILE_SIZE', 'The file is over 2 MB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (binary(bytes)) throw refused('E_FILE_BINARY', 'The file is not text');
  return textOf(bytes);
}

/** A name the teacher sees: no folder, no hidden file, not too long. */
export function fileNameAllowed(name: string): boolean {
  return (
    name.trim() !== '' &&
    name.length <= 120 &&
    !name.startsWith('.') &&
    ![...name].some((char) => char === '/' || char === '\\' || char.charCodeAt(0) < 32)
  );
}
