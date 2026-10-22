// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The drawn signature's strokes on the pad (#236, answer 411): a kept
// signature read back into strokes at the pad's size, and each stroke as the
// short straight pieces the pad draws, since the app has no drawing library.

import type { Point, Signature } from '@minhajna/core';

/** A straight piece of a stroke: its middle, length and angle, in the pad's units. */
export interface Piece {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly angle: number;
}

/** The strokes of a kept signature, scaled to a pad `width` wide. */
export function strokesOf(signature: Signature, width: number): Point[][] {
  const scale = width / signature.width;
  const parts = signature.path.split(' ');
  const strokes: Point[][] = [];
  for (let index = 0; index + 2 < parts.length; index += 3) {
    const point = { x: Number(parts[index + 1]) * scale, y: Number(parts[index + 2]) * scale };
    if (parts[index] === 'M' || strokes.length === 0) strokes.push([point]);
    else strokes[strokes.length - 1].push(point);
  }
  return strokes;
}

/** The pieces a stroke is drawn with; a single point is a dot. */
export function piecesOf(stroke: readonly Point[]): Piece[] {
  if (stroke.length === 1) return [{ x: stroke[0].x, y: stroke[0].y, length: 0, angle: 0 }];
  return stroke.slice(1).map((to, index) => {
    const from = stroke[index];
    return {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      length: Math.hypot(to.x - from.x, to.y - from.y),
      angle: Math.atan2(to.y - from.y, to.x - from.x),
    };
  });
}
