// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A layer read from a file or a QR code (#226, answers 337 and 338), one
// read at a time: leaving the screen closes the camera and drops a read
// still under way, and a cancelled read keeps what was shown. Only the
// outcome is kept; a district layer's signed file stays inside it, for the
// record if the teacher takes the layer in.

import { readLayerFile, type LayerRead } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import NativeInput from '../native/NativeMinhajnaCalendarInput';
import NativeSignature from '../native/NativeMinhajnaSignature';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';

export function useLayerInput() {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const mounted = useRef(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<LayerRead | null>(null);
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
              t('planLayers.scanTitle'),
              t('calendarView.receive.scanHint'),
              t('calendarView.receive.ignore'),
              direction === 'rtl',
            );
      if (!mounted.current || text === null) return;
      setOpened(null);
      const verify = (spki: string, payload: string, signature: string) =>
        NativeSignature.verify(spki, payload, signature);
      const result = await readLayerFile(text, data.keys, verify, data.profile);
      if (mounted.current) setOpened(result);
    } catch {
      if (!mounted.current) return;
      setOpened(null);
      setUnreadable(true);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, opened, unreadable, read, clear: () => setOpened(null) };
}
