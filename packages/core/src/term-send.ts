// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A term's marks sent to the state's receiving system (#591, Term-send, §3.7,
// R-3.7-09, R-5.5-11, R-5.9-12, answers 618 and 619). A demo world records no
// marks, so it makes up a class's term: for each pupil in the class list's
// order, a mark for each part the level's official formula weighs, drawn from a
// seed of the world, class, subject and term (termMarksSeed) so every device
// writes the same, the average by the formula as the grade book computes it,
// and an appreciation, the bundled list's first Arabic phrase of the band;
// about one pupil in twenty is absent from the exam when the formula weighs
// one. The export's text, minhajna/term-export/1, carries the world, the
// school's ID, the term, the class, the subject's code, the day signed on the
// device, the scale, the formula, the parts and each pupil's row, every number
// as the grade book shows it, two decimals half up; the teacher's key signs it
// over minhajna/signed-export/1 with the certificate's world, subject, public
// key and serial, as a week is signed under its own name; the device seals it
// for the world's receiving key under minhajna/state-delivery/1, the world and
// the kind. Before signing, the export is compared row by row with the marks
// shown (R-3.7-09).

import { bandOf, type AppreciationList } from './appreciations.ts';
import { AVERAGE_PARTS, type AveragePart, type Formula, type FormulaId } from './assessment.ts';
import type { Certificate, KeySigner } from './certify.ts';
import type { Day } from './day.ts';
import { demoDraws } from './demo-names.ts';
import { shownMark } from './grade-book.ts';
import { termAverage } from './justification.ts';

export type SentMark = number | 'absent';

/** A pupil's row of a term's marks, in the class list's order. */
export interface TermMarksRow {
  readonly pupilId: string;
  readonly registration: string;
  readonly values: Readonly<Partial<Record<AveragePart, SentMark>>>;
  /** By the formula, to two decimals; null without one or when a part is absent. */
  readonly average: number | null;
  readonly appreciation: string;
}

export interface TermMarks {
  readonly formula: FormulaId | null;
  readonly scale: number;
  readonly parts: readonly AveragePart[];
  readonly rows: readonly TermMarksRow[];
}

/** What names a term export besides its marks. */
export interface TermExportHead {
  readonly world: string;
  readonly school: string;
  readonly term: number;
  readonly className: string;
  /** The subject's country code. */
  readonly subject: string;
  /** The day it is signed on the device. */
  readonly signed: Day;
}

/** A term export as the teacher signed it, with the signature and the certificate it checks against. */
export interface SignedExport {
  readonly text: string;
  readonly signature: string;
  readonly certificate: Certificate;
}

/** A value to two decimals, half up, as the grade book shows it. */
const asShown = (value: number) => Number(shownMark(value));
const shown = (value: SentMark | undefined) => (typeof value === 'number' ? asShown(value) : value);

/** The seed a world's made-up marks for a class's course in a term are drawn from, the same on every device. */
export const termMarksSeed = (world: string, className: string, subject: string, term: number) =>
  `minhajna/term-marks/1\n${world}\n${className}\n${subject}\n${term}`;

/** The parts a formula weighs, in the core's order; T alone without one, as the grade book keeps them. */
export const partsOf = (formula: Pick<Formula, 'weights'> | null): AveragePart[] =>
  formula === null ? ['T'] : AVERAGE_PARTS.filter((part) => (formula.weights[part] ?? 0) > 0);

/**
 * A class's term marks made up by a demo world, the same on every device: for
 * each pupil in the list's order, a mark for each part from 30 to 90 percent
 * of the scale in quarter points, about one pupil in twenty absent from the
 * exam when the formula weighs one, the average by the formula, and the
 * first phrase of its band in Arabic, or of the marks' own mean's band for a
 * pupil with an absence, or of the middle band for one with no mark at all,
 * so every device writes the same export.
 */
export function madeUpTermMarks(
  seed: string,
  pupils: readonly { readonly id: string; readonly registration?: string }[],
  formula: Pick<Formula, 'id' | 'weights'> | null,
  scale: number,
  list: Pick<AppreciationList, 'bands' | 'phrases'>,
): TermMarks {
  const draw = demoDraws(seed);
  const parts = partsOf(formula);
  const [low, high] = [Math.ceil(scale * 0.3 * 4), Math.floor(scale * 0.9 * 4)];
  const rows = pupils.map((pupil) => {
    const absent = draw(20) === 0;
    const marks = parts.map((part): [AveragePart, SentMark] => [
      part,
      absent && part === 'E' ? 'absent' : (low + draw(high - low + 1)) / 4,
    ]);
    const values: Partial<Record<AveragePart, SentMark>> = Object.fromEntries(marks);
    const numbers: Partial<Record<AveragePart, number | null>> = Object.fromEntries(
      marks.map(([part, value]) => [part, typeof value === 'number' ? value : null]),
    );
    const by = formula === null ? null : termAverage(formula, numbers);
    const average = by === null ? null : asShown(by);
    const counted = marks.flatMap(([, value]) => (typeof value === 'number' ? [value] : []));
    const mean = average ?? counted.reduce((sum, value) => sum + value, 0) / Math.max(counted.length, 1);
    const band = counted.length === 0 ? list.bands[Math.floor(list.bands.length / 2)] : bandOf(list, mean, scale);
    const appreciation = list.phrases.find((one) => one.band === band?.id && one.conduct === undefined)?.text['ar'];
    if (appreciation === undefined) throw new RangeError('The appreciation list has no phrase for a band');
    return { pupilId: pupil.id, registration: pupil.registration ?? pupil.id, values, average, appreciation };
  });
  return { formula: formula?.id ?? null, scale, parts, rows };
}

/**
 * The export's text, minhajna/term-export/1, with its fields in one order, as
 * the receiving system reads it, every number as the book shows it.
 */
export function termExportText(head: TermExportHead, marks: TermMarks): string {
  return JSON.stringify({
    format: 'minhajna/term-export/1',
    world: head.world,
    kind: 'marks',
    school: head.school,
    term: head.term,
    class: head.className,
    subject: head.subject,
    signed: head.signed,
    scale: marks.scale,
    formula: marks.formula,
    parts: marks.parts,
    rows: marks.rows.map((row) => ({
      registration: row.registration,
      values: Object.fromEntries(marks.parts.map((part) => [part, shown(row.values[part])])),
      average: row.average === null ? null : asShown(row.average),
      appreciation: row.appreciation,
    })),
  });
}

/** The text a teacher's key signs for an export, as a week's is signed under its own name. */
export function exportSigningText(
  certificate: Pick<Certificate, 'world' | 'subject' | 'publicKey' | 'serial'>,
  text: string,
) {
  const { world, subject, publicKey, serial } = certificate;
  return `minhajna/signed-export/1\n${world}\n${subject}\n${publicKey}\n${serial}\n${text}`;
}

/** Signs an export's text with the device's key, under the certificate for it. */
export async function signExport(text: string, certificate: Certificate, signer: KeySigner): Promise<SignedExport> {
  if (certificate.publicKey !== signer.publicKey) throw new RangeError('The certificate is for another key');
  return { text, signature: await signer.sign(exportSigningText(certificate, text)), certificate };
}

/** What a delivery to the state's receiving system is sealed under. */
export const deliveryInfo = (world: string, kind: 'marks' | 'absences') =>
  `minhajna/state-delivery/1\n${world}\n${kind}`;

/**
 * The check before signing (R-3.7-09): how many of the marks' rows the
 * export's text gives back exactly as the book shows them, by registration
 * number, of how many, counting an extra or repeated row of the export in the
 * total.
 */
export function exportMatches(text: string, marks: TermMarks): { readonly matched: number; readonly total: number } {
  const read = (JSON.parse(text) as { rows?: unknown }).rows;
  const rows = Array.isArray(read) ? (read as Record<string, unknown>[]) : [];
  const exported = new Map(rows.map((row) => [row['registration'], JSON.stringify(row)]));
  const matched = marks.rows.filter((row) => {
    const values = Object.fromEntries(marks.parts.map((part) => [part, shown(row.values[part])]));
    const average = row.average === null ? null : asShown(row.average);
    const expected = { registration: row.registration, values, average, appreciation: row.appreciation };
    return exported.get(row.registration) === JSON.stringify(expected);
  }).length;
  return { matched, total: Math.max(marks.rows.length, rows.length) };
}
