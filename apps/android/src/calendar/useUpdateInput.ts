// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A signed update read from a file or a QR code, checked as it arrives. The
// screen keeps only the outcome, how it was opened and the day (answer
// 308); the text stays inside the outcome, for the record if it is applied.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import NativeInput from '../native/NativeMinhajnaCalendarInput';
import NativeSignature from '../native/NativeMinhajnaSignature';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { readUpdate, type ReadUpdate } from './read-update';

export interface OpenedUpdate {
  readonly read: ReadUpdate;
  readonly via: 'file' | 'qr';
  readonly day: Day;
}

/**
 * One read at a time; leaving the screen closes the camera and drops a read
 * still under way, and a cancelled read keeps what was shown.
 */
export function useUpdateInput() {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const mounted = useRef(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<OpenedUpdate | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      NativeInput.cancel();
    };
  }, []);
  const read = async (via: 'file' | 'qr') => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setUnreadable(false);
    try {
      const text =
        via === 'file'
          ? await NativeInput.readFile()
          : await NativeInput.scanQr(
              t('calendarView.update.scanTitle'),
              t('calendarView.receive.scanHint'),
              t('calendarView.receive.ignore'),
              direction === 'rtl',
            );
      if (!mounted.current || text === null) return;
      setOpened(null);
      const verify = (spki: string, payload: string, signature: string) =>
        NativeSignature.verify(spki, payload, signature);
      const result = await readUpdate(text, data.keys, verify, data.profile, data.year);
      if (mounted.current) setOpened({ read: result, via, day: data.today() });
    } catch {
      if (!mounted.current) return;
      setOpened(null);
      setUnreadable(true);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, opened, unreadable, read, isBusy: () => pending.current };
}
