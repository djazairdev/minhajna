// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Saving and opening files on the web: in a later part of #250 (answer
// 501). Until then each step is refused as not built yet.

import type { Spec } from '../../../android/src/native/NativeMinhajnaFiles';
import { notYet } from './not-yet.ts';

const Files: Spec = {
  makeText: () => notYet('Making a file'),
  makeZip: () => notYet('Making an archive'),
  adoptPdf: () => notYet('Keeping a PDF'),
  saveFile: () => notYet('Saving a file'),
  shareFile: () => notYet('Sharing a file'),
  openText: () => notYet('Opening a file'),
  openZip: () => notYet('Opening an archive'),
  readZip: () => notYet('Reading an archive'),
  dropFile() {
    return;
  },
};

export default Files;
