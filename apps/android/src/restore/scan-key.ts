// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The old phone's one-time key, scanned from its QR code (#247, answers 478 and
// 481): the camera is asked for then, and only for this scan. A code that is
// not a Minhajna transfer's, a camera that does not open, and a scan that does
// not work otherwise, its screen not opening or the code not read, are each
// said; a cancelled scan says nothing.

import { readTransferQr } from '@minhajna/core';
import { errorCode } from '../lock/lock-rules';
import scanner from '../native/NativeMinhajnaCalendarInput';

/** What a scan gave: the key, a code that is not a transfer's, a camera or scan that did not work, or nothing. */
export type Scanned = { readonly key: string } | { readonly problem: 'qr' | 'camera' | 'scan' } | null;

export async function scanKey(texts: {
  readonly title: string;
  readonly instruction: string;
  readonly cancel: string;
  readonly rtl: boolean;
}): Promise<Scanned> {
  let text: string | null;
  try {
    text = await scanner.scanQr(texts.title, texts.instruction, texts.cancel, texts.rtl);
  } catch (error: unknown) {
    return { problem: errorCode(error) === 'E_CALENDAR_CAMERA' ? 'camera' : 'scan' };
  }
  if (text === null) return null;
  const key = readTransferQr(text);
  return key === null ? { problem: 'qr' } : { key };
}
