// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CalendarNoticeError, parseCalendarNotice, type CalendarNotice } from '@minhajna/core';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@react-navigation/native';
import NativeInput from '../native/NativeMinhajnaCalendarInput';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';

/** Raw text is not kept in screen state, navigation, logs or storage; only the validated allowlist survives. */
export function useNoticeInput(onNotice: (notice: CalendarNotice | null) => void) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const mounted = useRef(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<'invalid' | 'version' | 'country' | 'year' | 'scope' | 'input' | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      NativeInput.cancel();
    };
  }, []);
  const read = async (mode: 'file' | 'qr') => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setProblem(null);
    onNotice(null);
    try {
      const text =
        mode === 'file'
          ? await NativeInput.readFile()
          : await NativeInput.scanQr(
              t('calendarView.receive.scanTitle'),
              t('calendarView.receive.scanHint'),
              t('calendarView.receive.ignore'),
              direction === 'rtl',
            );
      if (!mounted.current || text === null) return;
      onNotice(parseCalendarNotice(text, data.profile, data.year));
    } catch (error) {
      if (!mounted.current) return;
      setProblem(
        error instanceof CalendarNoticeError &&
          ['invalid', 'version', 'country', 'year', 'scope'].includes(error.problem)
          ? (error.problem as 'invalid' | 'version' | 'country' | 'year' | 'scope')
          : 'input',
      );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, problem, read, isBusy: () => pending.current };
}
