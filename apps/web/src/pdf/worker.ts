// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A dedicated parser worker, without app storage or network capabilities.
// Its own response carries the host's security policy, straight from the host
// or through the offline worker (answer 743), so eval and scripts from any
// other origin are refused. The one exception is a page still under the
// earlier offline worker, until the browser swaps it, whose kept copy has no
// policy. The entry points are also gone before the PDF engine is imported.
// No viewer, scripting, annotation actions or PDF-supplied HTML enters the
// application.

import { deny } from './deny.ts';

deny(globalThis, navigator);

await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
export {};
