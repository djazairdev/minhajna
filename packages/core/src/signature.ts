// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The drawn signature (#236, answer 411, R-3.8-39 to R-3.8-49). It is one of
// the teacher card's personal fields, so it never leaves the device. Only its
// shape is kept: an SVG path of whole-number points in a fixed box, each
// stroke a move then lines, a dot a line of no length, with no time, speed
// or pressure. Anything else is refused, and a history holding something
// else reads as no signature. It is used in documents only while the
// teacher has turned it on.

import type { Signature, TeacherPersonal } from './records.ts';

/** The box a signature is drawn in, in its own units. */
export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 200;
/** The longest path kept, in characters: about 2,000 points. */
export const SIGNATURE_MAX = 24_000;

export interface Point {
  readonly x: number;
  readonly y: number;
}

const COMMAND = /^[ML] (\d{1,3}) (\d{1,3})$/;

/** Whether a value is a signature as kept: the box, a path of moves and lines inside it, and nothing more. */
export function isSignature(value: unknown): value is Signature {
  if (typeof value !== 'object' || value === null || Object.keys(value).length !== 3) return false;
  const { width, height, path } = value as Record<string, unknown>;
  if (width !== SIGNATURE_WIDTH || height !== SIGNATURE_HEIGHT) return false;
  if (typeof path !== 'string' || path === '' || path.length > SIGNATURE_MAX || !path.startsWith('M ')) return false;
  const parts = path.split(' ');
  if (parts.length % 3 !== 0) return false;
  for (let index = 0; index < parts.length; index += 3) {
    const match = COMMAND.exec(parts.slice(index, index + 3).join(' '));
    if (match === null) return false;
    if (Number(match[1]) > SIGNATURE_WIDTH || Number(match[2]) > SIGNATURE_HEIGHT) return false;
  }
  return true;
}

/**
 * The signature for strokes drawn in a box `size` wide and high, scaled into
 * the signature's box and rounded; a point repeating the one before is left
 * out, and a stroke of one point is a line of no length, so it prints as a
 * dot. Null when nothing was drawn, the box has no size, or the path would
 * be too long.
 */
export function signatureOf(strokes: readonly (readonly Point[])[], size: { width: number; height: number }) {
  if (!(size.width > 0 && size.height > 0)) return null;
  const scale = Math.min(SIGNATURE_WIDTH / size.width, SIGNATURE_HEIGHT / size.height);
  const clamp = (value: number, most: number) => Math.min(most, Math.max(0, Math.round(value * scale)));
  const commands: string[] = [];
  for (const stroke of strokes) {
    const points: string[] = [];
    for (const point of stroke) {
      const at = `${clamp(point.x, SIGNATURE_WIDTH)} ${clamp(point.y, SIGNATURE_HEIGHT)}`;
      if (at !== points[points.length - 1]) points.push(at);
    }
    const [only] = points;
    if (points.length === 1 && only !== undefined) points.push(only);
    commands.push(...points.map((at, index) => `${index === 0 ? 'M' : 'L'} ${at}`));
  }
  const signature: Signature = { width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT, path: commands.join(' ') };
  return isSignature(signature) ? signature : null;
}

/** The personal fields with one changed and the others kept; an empty name or no signature leaves the field out. */
export function personalWith(
  personal: TeacherPersonal | null,
  change: { name?: string; signature?: Signature | null; signatureOn?: boolean },
): TeacherPersonal {
  const name = change.name !== undefined ? change.name.trim() : (personal?.name ?? '');
  const signature = change.signature !== undefined ? change.signature : (personal?.signature ?? null);
  const on = change.signatureOn ?? personal?.signatureOn ?? false;
  return {
    ...(name !== '' && { name }),
    ...(signature !== null && { signature }),
    ...(on && { signatureOn: true }),
  };
}

/** The personal fields as a history holds them: the name, a signature as kept and the switch, nothing else. */
export function readPersonal(personal: TeacherPersonal): TeacherPersonal {
  const { name, signature, signatureOn } = personal;
  return {
    ...(typeof name === 'string' && name !== '' && { name }),
    ...(isSignature(signature) && {
      signature: { width: signature.width, height: signature.height, path: signature.path },
    }),
    ...(signatureOn === true && { signatureOn: true }),
  };
}

/** The signature the documents carry: drawn, and turned on. */
export function signatureInUse(personal: TeacherPersonal | null): Signature | null {
  return personal?.signatureOn === true && personal.signature !== undefined ? personal.signature : null;
}
