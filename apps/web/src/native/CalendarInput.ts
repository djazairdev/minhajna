// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Calendar files, statements and QR codes on the web: in a later part of
// #250 (answer 501). Until then each step is refused as not built yet.

import type { Spec } from '../../../android/src/native/NativeMinhajnaCalendarInput';
import { notYet } from './not-yet.ts';

const CalendarInput: Spec = {
  readFile: () => notYet('Opening a calendar file'),
  readStatement: () => notYet('Opening a statement'),
  scanQr: () => notYet('Scanning a QR code'),
  qrRows() {
    throw Object.assign(new Error('QR codes are not on the web yet'), { code: 'E_WEB_NOT_YET' });
  },
  cancel() {
    return;
  },
  shareText: () => notYet('Sharing a file'),
};

export default CalendarInput;
