// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The phone app's vector drawables as SVGs (#250): colours with their alpha,
// strokes, fills and moved groups, a file that is not a vector left out, and
// any element or attribute the web would draw wrong refused.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { svgColour, vectorToSvg } from '../scripts/drawables.ts';

const vector = (body: string) =>
  `<vector xmlns:android="x" android:width="24dp" android:height="12dp" android:viewportWidth="48" android:viewportHeight="24">${body}</vector>`;

describe('the drawables', () => {
  it('reads Android colours, with their alpha', () => {
    assert.deepEqual(svgColour('#FFFFFF'), { colour: '#FFFFFF', opacity: 1 });
    assert.deepEqual(svgColour('#80102030'), { colour: '#102030', opacity: 0.502 });
    assert.throws(() => svgColour('#12345'), /Colour/u);
  });

  it('draws strokes, fills and moved groups at the vector’s size', () => {
    const svg = vectorToSvg(
      vector(
        '<!-- a note --><group android:translateX="2" android:translateY="-1"><path android:pathData="M0 0h4" android:strokeColor="#FF000000" android:strokeWidth="1.8" android:strokeLineCap="round"/></group>' +
          '<path android:pathData="M1 1z" android:fillColor="#40FFFFFF"/>',
      ),
    );
    assert.equal(
      svg,
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12" viewBox="0 0 48 24">' +
        '<g transform="translate(2 -1)"><path d="M0 0h4" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/></g>' +
        '<path d="M1 1z" fill="#FFFFFF" fill-opacity="0.251"/></svg>\n',
    );
  });

  it('leaves out a file that is not a vector, and refuses what it cannot draw', () => {
    assert.equal(vectorToSvg('<selector><item android:drawable="@x"/></selector>'), null);
    assert.throws(() => vectorToSvg(vector('<clip-path android:pathData="M0 0"/>')), /not drawn on the web/u);
    assert.throws(() => vectorToSvg(vector('<path android:fillColor="#FFF"/>')), /without pathData/u);
    assert.throws(
      () => vectorToSvg(vector('<path android:pathData="M0 0" android:fillType="evenOdd"/>')),
      /<path> android:fillType is not drawn/u,
    );
    assert.throws(() => vectorToSvg(vector('<!-- open <path android:pathData="M0 0"/>')), /not drawn/u);
    assert.throws(() => vectorToSvg(vector('stray text')), /not drawn/u);
    assert.equal(vectorToSvg(vector('<!-- a --!>')), vectorToSvg(vector('')));
    assert.throws(() => vectorToSvg(vector('<group android:translateX="1"/>')), /closes itself/u);
    assert.throws(() => vectorToSvg(vector('</group>')), /not open/u);
    assert.throws(() => vectorToSvg(vector('<group>')), /left open/u);
    assert.throws(() => vectorToSvg(vector('<path android:pathData="M0 0 onload=x"/>')), /Path data/u);
    assert.throws(
      () => vectorToSvg(vector('<path android:pathData="M0 0" android:strokeLineCap="x"/>')),
      /Not one of/u,
    );
    assert.throws(
      () => vectorToSvg(vector('').replace('android:width', 'android:autoMirrored="true" android:width')),
      /<vector> android:autoMirrored is not drawn/u,
    );
  });
});
