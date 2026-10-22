// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The drawn signature on a printed page (#236, answers 411 and 412): its
// shape as an inline SVG path, in black like the rest of the page, scaled
// into the teacher's box: 14 mm high and 42 mm wide at most by the page's
// base style, and lower where a document's box or row is lower, so no box
// grows. Its line keeps a pen's width at any size. A document carries it
// only while it is in use, never on a blank version, and not when the
// teacher chose «فارغة» for that output.

import { isSignature, signatureInUse, type Signature } from '@minhajna/core';
import type { DocumentData } from './document-data';

/** The signature a document carries, or null when it carries none. */
export function documentSignature(data: DocumentData, blank: boolean): Signature | null {
  return blank || data.drawn === false ? null : signatureInUse(data.state.personal);
}

/** The signature as an SVG mark for a teacher's box; nothing when there is none. */
export function drawnMark(signature: Signature | null): string {
  if (signature === null || !isSignature(signature)) return '';
  return (
    `<svg class="drawn" viewBox="0 0 ${signature.width} ${signature.height}" aria-hidden="true">` +
    `<path d="${signature.path}" fill="none" stroke="#000" stroke-width="1.2" vector-effect="non-scaling-stroke" ` +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>'
  );
}
