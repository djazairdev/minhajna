// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The type of a chart's and a map's text (#600): the Arabic face first, then
// the Latin one for French, English and Latin letters, both bundled. A chart
// asks the page to load both, since a canvas draws with whatever face is
// there and never redraws by itself.

import { fontFamilies } from '../../../android/src/design/tokens';

const FACES = [fontFamilies.arabic, fontFamilies.latin].map((face) => `'${face}'`);

export const FONT = `${FACES.join(', ')}, sans-serif`;

/** Settles once both faces are loaded, or failed to load. */
export function fontsLoaded(fonts: Pick<FontFaceSet, 'load'>): Promise<unknown> {
  return Promise.allSettled(FACES.map((face) => fonts.load(`12px ${face}`)));
}
