// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing and PDFs on the web: through the browser's print screen, in a
// later part of #250 (answer 501). Until then each step is refused.

import type { Spec } from '../../../android/src/native/NativeMinhajnaPdf';
import { notYet } from './not-yet.ts';

const Pdf: Spec = {
  makePdf: () => notYet('Making a PDF'),
  sharePdf: () => notYet('Sharing a PDF'),
  printHtml: () => notYet('Printing'),
  savePdf: () => notYet('Saving a PDF'),
  pageColors: () => notYet('Reading a page'),
};

export default Pdf;
