// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A statement opened in reader mode (#246, answer 489), one read at a time: a
// QR code scanned, or a file picked, its signed text or a PDF's statement link,
// a PDF without one said apart. The signature is checked before anything is
// read, against the world of the store it is read into (#563), a demo world's
// or none; leaving the screen closes the camera and drops a read still under
// way, and a cancelled read keeps what was shown.

import {
  checkStatement,
  linkedStatement,
  STATEMENT_LINK,
  storeWorld,
  type ProgressStatement,
  type ReceivedHow,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import NativeInput from '../native/NativeMinhajnaCalendarInput';
import NativeSignature from '../native/NativeMinhajnaSignature';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';

export type OpenedStatement =
  | {
      readonly ok: true;
      readonly text: string;
      readonly how: ReceivedHow;
      readonly spki: string;
      readonly statement: ProgressStatement;
    }
  | {
      readonly ok: false;
      readonly problem: 'invalid' | 'version' | 'world' | 'signature' | 'payload' | 'unreadable' | 'noLink';
    };

export function useStatementInput(onOpened: (opened: OpenedStatement) => void) {
  const t = useText();
  const { direction } = useLocale();
  const { entries } = useAppData();
  const mounted = useRef(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
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
    try {
      const raw =
        via === 'file'
          ? await NativeInput.readStatement()
          : await NativeInput.scanQr(
              t('reader.scanTitle'),
              t('calendarView.receive.scanHint'),
              t('calendarView.receive.ignore'),
              direction === 'rtl',
            );
      if (!mounted.current || raw === null) return;
      const how: ReceivedHow = via === 'qr' ? 'qr' : raw.startsWith(STATEMENT_LINK) ? 'pdf' : 'file';
      const text = how === 'pdf' ? linkedStatement(raw) : raw;
      if (text === null) return onOpened({ ok: false, problem: 'noLink' });
      const verify = (spki: string, payload: string, signature: string) =>
        NativeSignature.verify(spki, payload, signature);
      const check = await checkStatement(text, verify, storeWorld(entries()));
      if (!mounted.current) return;
      onOpened(check.ok ? { ok: true, text, how, spki: check.spki, statement: check.statement } : check);
    } catch {
      if (mounted.current) onOpened({ ok: false, problem: 'unreadable' });
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, read };
}
