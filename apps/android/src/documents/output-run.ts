// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing or saving a document, as a document's output and Roll-print run
// it (#212, #217): the system's print screen, or a PDF saved where the
// teacher picks; one at a time, a second tap ignored while the first runs;
// then whether the file was saved or the document was not made. Nothing is
// said once the screen has closed, or after a print or a cancelled save.

import { useEffect, useRef, useState } from 'react';
import pdf from '../native/NativeMinhajnaPdf';

export type Said = 'saved' | 'failed' | null;

/** One document's print and save, with whether one is running and what was said of the last. */
export function useOutputRun() {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const mounted = useRef(true);
  const running = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

  const print = (html: () => string, title: string, landscape: boolean) =>
    run(async () => {
      await pdf.printHtml(html(), title, landscape);
      return null;
    });

  const save = (html: () => string, made: string, fileName: string, landscape: boolean) =>
    run(async () => {
      const file = await pdf.makePdf(html(), made, landscape);
      return (await pdf.savePdf(file.name, fileName)) ? 'saved' : null;
    });

  return { busy, said, print, save, clear: () => setSaid(null) };
}
