// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import NativeInput from '../src/native/NativeMinhajnaCalendarInput';

type TestInput = {
  readFile: () => Promise<string | null>;
  readStatement: () => Promise<string | null>;
  scanQr: (title: string, instruction: string, cancel: string, rtl: boolean) => Promise<string | null>;
  qrRows: (text: string) => string;
  cancel: () => void;
  shareText: (name: string, text: string, title: string) => Promise<void>;
};

/** The global Jest bridge uses standalone mock functions, not native methods with a receiver. */
export const calendarInput = jest.mocked(NativeInput as TestInput);
