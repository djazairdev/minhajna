// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from 'react';
import native, { type AppLicences } from '../native/NativeMinhajnaLicences';

type Result = { status: 'loading' | 'refused' } | { status: 'ready'; value: AppLicences };

/** Cancels stale completions on exit/retry; public notices never enter records. */
export function useAppLicences() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    native.readNotices().then(
      (value) => {
        if (active) setResult({ status: 'ready', value });
      },
      () => {
        if (active) setResult({ status: 'refused' });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  return {
    result,
    retry: () => {
      setResult({ status: 'loading' });
      setAttempt((value) => value + 1);
    },
  };
}
