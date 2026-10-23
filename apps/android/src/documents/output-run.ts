// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing or saving a document, as a document's output and Roll-print run
// it (#212, #217): the system's print screen, or a PDF saved where the
// teacher picks; one at a time, a second tap ignored while the first runs;
// then whether the file was saved or the document was not made. Nothing is
// said once the screen has closed, or after a print or a cancelled save. A
// print can be kept once it has gone to the print screen, as a primary
// re-pace draft keeps its day (#229).

import { useEffect, useRef, useState, type RefObject } from 'react';
import pdf from '../native/NativeMinhajnaPdf';

export type Said = 'saved' | 'failed' | null;

/** Whether the screen is still shown, so a print that ends after it closed says nothing. */
export function useMounted(): RefObject<boolean> {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

/** One document's print and save, with whether one is running and what was said of the last. */
export function useOutputRun() {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const mounted = useMounted();
  const running = useRef(false);

  const run = (work: () => Promise<Said>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setSaid(null);
    work()
      .finally(() => {
        running.current = false;
      })
      .then(
        (result) => {
          if (!mounted.current) return;
          setBusy(false);
          setSaid(result);
        },
        (error: unknown) => {
          if (__DEV__) console.warn('A document was not made', error);
          if (!mounted.current) return;
          setBusy(false);
          setSaid('failed');
        },
      );
  };

  const print = (html: () => string, title: string, landscape: boolean, printed?: () => void) =>
    run(async () => {
      await pdf.printHtml(html(), title, landscape);
      printed?.();
      return null;
    });

  const save = (html: () => string, made: string, fileName: string, landscape: boolean, saved?: () => void) =>
    run(async () => {
      const file = await pdf.makePdf(html(), made, landscape);
      if (!(await pdf.savePdf(file.name, fileName))) return null;
      saved?.();
      return 'saved';
    });

  return { busy, said, run, print, save, clear: () => setSaid(null) };
}
