// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What this device can do that a screen offers. A phone scans QR codes with
// its camera; a PC asks for no camera and offers the file or the typed key
// in its place (#250, answer 506), so its screens show no scan button. A
// phone shares files through its share menu; a PC's browser shares few
// kinds of file, Chrome and Edge no ZIP at all, and a PC passes files to the
// phone by cable or USB key, so a PC's screens offer saving the file alone.

import { onPc } from '../text/device-text';

/** Whether this device scans QR codes, read when asked so tests can set it. */
export function canScan(): boolean {
  return !onPc();
}

/** Whether this device offers sending a file through a share menu beside saving it. */
export function canShareFiles(): boolean {
  return !onPc();
}
