// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The calendar input module on a PC (#250, part 3): a calendar update, a
// plan layer or a colleague's statement comes as a file through the
// browser's file dialog, read as strict UTF-8 within the phone's limits; a
// statement PDF gives only its `minhajna-statement:` link (StatementFile.kt).
// A PC asks for no camera (answer 506), so it scans nothing, and its screens
// offer the file instead. A short text's QR code is drawn as on the phone,
// and a file the app wrote is shared where the browser shares it.

import type { Spec } from '../../../android/src/native/NativeMinhajnaCalendarInput';
import { share } from './Files.ts';
import { pickFile, pickerOpen, refused } from './files/picked.ts';
import { shortRows } from './files/qr.ts';

const FILE_BYTES = 1_048_576;
const STATEMENT_BYTES = 8_388_608;
const LINK = 'minhajna-statement:';
const LINK_CHARS = 87_384;
const SHARE_NAME = /^[a-z0-9-]{1,64}\.json$/u;

let waiting = false;

function unreadable(): Error {
  return refused('E_CALENDAR_INPUT', 'The selected file could not be read');
}

function strict(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

/** A statement PDF's link to its signed text, or the bare scheme when it has none. */
export function statementLink(bytes: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(bytes);
  for (let at = text.indexOf(LINK); at >= 0; at = text.indexOf(LINK, at + LINK.length)) {
    const body = /^[A-Za-z0-9+/=]*/u.exec(text.slice(at + LINK.length, at + LINK.length + LINK_CHARS + 1))?.[0] ?? '';
    if (body.length >= 1 && body.length <= LINK_CHARS) return LINK + body;
  }
  return LINK;
}

/** A statement file's text: a signed file's strict UTF-8, or a PDF's link. */
export function statementText(bytes: Uint8Array): string {
  if (new TextDecoder('latin1').decode(bytes.subarray(0, 5)) === '%PDF-') return statementLink(bytes);
  if (bytes.length > FILE_BYTES) throw unreadable();
  return strict(bytes);
}

async function read(accept: string, limit: number, text: (bytes: Uint8Array) => string): Promise<string | null> {
  if (pickerOpen() || waiting) throw refused('E_CALENDAR_BUSY', 'An input is already open');
  const file = await pickFile(accept);
  if (file === null) return null;
  if (file.size > limit) throw unreadable();
  waiting = true;
  try {
    return text(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw unreadable();
  } finally {
    waiting = false;
  }
}

const CalendarInput: Spec = {
  readFile: () => read('.json,application/json', FILE_BYTES, strict),
  readTable: () => read('.csv,text/csv,text/comma-separated-values,text/plain', FILE_BYTES, strict),
  readStatement: () => read('.json,.pdf,application/json,application/pdf', STATEMENT_BYTES, statementText),
  scanQr: () => Promise.reject(refused('E_CALENDAR_CAMERA', 'A PC scans no QR code')),
  qrRows: shortRows,
  cancel() {
    return;
  },
  async shareText(name, text, title) {
    const bytes = new TextEncoder().encode(text);
    if (!SHARE_NAME.test(name) || bytes.length > FILE_BYTES || title.length > 500) {
      throw refused('E_CALENDAR_SHARE', 'The file could not be shared');
    }
    await share(new File([bytes], name, { type: 'application/json' }), title, 'E_CALENDAR_SHARE');
  },
};

export default CalendarInput;
