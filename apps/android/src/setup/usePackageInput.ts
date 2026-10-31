// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's timetable package opened from a file in setup (#580, Setup-5a,
// Setup-5c, answer 608). One read at a time: the file the teacher picks is read
// as text and checked as real mode trusts, which is no world, so a package
// signed in a demo world is refused in its own words, as is a file too large,
// not a package, or whose signature does not hold. Nothing from it is saved;
// each read is counted, so a second refusal is said again. A package that
// passes is shown with #580's next part. Leaving the screen closes the picker
// and drops a read still under way, and a cancelled pick keeps what was shown.

import { readPackageFile, type PackageRead } from '@minhajna/core';
import { useEffect, useRef, useState } from 'react';
import NativeInput from '../native/NativeMinhajnaCalendarInput';
import NativeSignature from '../native/NativeMinhajnaSignature';

/** Real mode's trust: signatures checked on the device, and no world. */
const REAL = {
  checker: { verify: (key: string, text: string, signature: string) => NativeSignature.verify(key, text, signature) },
  world: null,
} as const;

/** A package file opened and checked, or a file that could not be read. */
export function usePackageInput() {
  const mounted = useRef(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<PackageRead | null>(null);
  const [count, setCount] = useState(0);
  const [unreadable, setUnreadable] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      NativeInput.cancel();
    };
  }, []);
  const open = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setUnreadable(false);
    try {
      const text = await NativeInput.readFile();
      if (!mounted.current || text === null) return;
      const result = await readPackageFile(text, REAL);
      if (!mounted.current) return;
      setRead(result);
      setCount((before) => before + 1);
    } catch {
      if (mounted.current) setUnreadable(true);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, read, count, unreadable, open, clear: () => setRead(null) };
}
