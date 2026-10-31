// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A term's marks sent to the state's receiving system (#591, answer 619): the
// marks a demo world makes up, the same for the same seed and others for
// another, the seed named by the world, class, subject and term, in the list's
// order, in quarter points within 30 to 90 percent of the scale, averaged by
// the formula to two decimals, about one pupil in twenty absent from the exam
// with no average, never from another part nor without a formula, and the
// band's first Arabic phrase, of the marks' own mean for an absent pupil and of
// the middle band for one with no mark, or a refusal when the list has none;
// the parts of each formula, primary's scale of 10, and T alone with no average
// without a formula; the export's text with its fields and parts in one order
// and every number as the book shows it; the comparison before signing, a
// changed mark and an extra row found and full values matched as shown; and the
// signature over minhajna/signed-export/1 by the certified key only, and the
// sealing's info. Every pupil, mark and world here is made up.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  bandOf,
  certificateRequest,
  deliveryInfo,
  demoPupils,
  exportMatches,
  exportSigningText,
  issueCertificate,
  madeUpTermMarks,
  newId,
  parseDay,
  partsOf,
  signExport,
  termAverage,
  termExportText,
  termMarksSeed,
  type AppreciationList,
  type Formula,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { random } from './school-devices.ts';

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/${path}`, import.meta.url), 'utf8'));
const LIST = json('dz/appreciations.json') as AppreciationList;
const FORMULAS = (json('dz/assessment.json') as { formulas: Formula[] }).formulas;
const formula = (id: string) => FORMULAS.find((one) => one.id === id)!;
let made = 0;
const PUPILS = demoPupils('class-1', () => `pupil-${(made += 1)}`).map((pupil, at) => ({
  ...pupil,
  registration: `99${String(at + 1).padStart(8, '0')}`,
}));
const SEED = termMarksSeed('K7QF4', '4AM2', 'math', 1);
/** Many classes' seeds, for what one class of 45 may draw only rarely. */
const SEEDS = Array.from({ length: 30 }, (_, at) => termMarksSeed('K7QF4', `${(at % 4) + 1}AM${at}`, 'math', 1));
const HEAD = {
  world: 'K7QF4',
  school: 'school-2',
  term: 1,
  className: '4AM2',
  subject: 'math',
  signed: parseDay('2026-12-10'),
};

describe('the term marks a demo world makes up', () => {
  it('gives every device the same marks for the same class, subject and term, and others another', () => {
    const one = madeUpTermMarks(SEED, PUPILS, formula('cem'), 20, LIST);
    assert.deepEqual(madeUpTermMarks(SEED, PUPILS, formula('cem'), 20, LIST), one);
    const other = termMarksSeed('K7QF4', '4AM2', 'math', 2);
    assert.notDeepEqual(madeUpTermMarks(other, PUPILS, formula('cem'), 20, LIST), one);
    assert.equal(SEED, 'minhajna/term-marks/1\nK7QF4\n4AM2\nmath\n1');
    assert.deepEqual(
      one.rows.map((row) => row.registration),
      PUPILS.map((pupil) => pupil.registration),
    );
  });

  it('marks each part the formula weighs in quarter points within the scale, and averages by it', () => {
    const marks = madeUpTermMarks(SEED, PUPILS, formula('cem'), 20, LIST);
    assert.deepEqual([marks.formula, marks.scale, marks.parts], ['cem', 20, ['T', 'F', 'E']]);
    const numbers = marks.rows.flatMap((row) => Object.values(row.values).filter((one) => typeof one === 'number'));
    assert.ok(numbers.every((one) => one >= 6 && one <= 18 && Number.isInteger(one * 4)));
    for (const row of marks.rows) {
      const absent = Object.values(row.values).includes('absent');
      const by = termAverage(formula('cem'), row.values as Record<string, number>);
      assert.equal(row.average, absent ? null : Math.round((by! + 1e-9) * 100) / 100);
      const numbers = Object.values(row.values).filter((one) => typeof one === 'number');
      const mean = row.average ?? numbers.reduce((sum, one) => sum + one, 0) / numbers.length;
      const band = bandOf(LIST, mean, 20);
      const phrase = LIST.phrases.find((one) => one.band === band?.id && one.conduct === undefined);
      assert.equal(row.appreciation, phrase?.text['ar'], row.registration);
    }
    const absent = marks.rows.filter((row) => row.values.E === 'absent');
    assert.ok(absent.length > 0 && absent.length < marks.rows.length / 5, `${absent.length} absent`);
    assert.deepEqual(new Set(absent.map((row) => row.average)), new Set([null]));
  });

  it('keeps the parts of the level’s formula, on its scale, and T alone with no average without one', () => {
    assert.deepEqual(partsOf(formula('primary-exam-only')), ['E']);
    assert.deepEqual(partsOf(formula('lycee-oral')), ['T', 'F', 'E', 'O']);
    const primary = madeUpTermMarks(SEED, PUPILS, formula('primary-examined'), 10, LIST);
    const numbers = primary.rows.flatMap((row) => Object.values(row.values).filter((one) => typeof one === 'number'));
    assert.ok(numbers.every((one) => one >= 3 && one <= 9));
    const none = madeUpTermMarks(SEED, PUPILS, null, 20, LIST);
    assert.deepEqual(
      [none.formula, none.parts, new Set(none.rows.map((row) => row.average))],
      [null, ['T'], new Set([null])],
    );
    assert.ok(none.rows.every((row) => row.appreciation.length > 0));
  });

  it('puts an absence on the exam only, and none without a formula or an exam', () => {
    const absences = (id: string | null) =>
      SEEDS.flatMap((seed) => madeUpTermMarks(seed, PUPILS, id === null ? null : formula(id), 20, LIST).rows).flatMap(
        (row) => Object.entries(row.values).flatMap(([part, value]) => (value === 'absent' ? [part] : [])),
      );
    for (const id of ['cem', 'lycee', 'lycee-practical', 'lycee-oral', 'primary-exam-only']) {
      const parts = absences(id);
      assert.ok(parts.length > 0, id);
      assert.deepEqual(new Set(parts), new Set(['E']), id);
    }
    assert.deepEqual(absences(null), []);
    const unmarked = SEEDS.flatMap(
      (seed) => madeUpTermMarks(seed, PUPILS, formula('primary-exam-only'), 10, LIST).rows,
    );
    const middle = LIST.phrases.find((one) => one.band === LIST.bands[2]?.id && one.conduct === undefined)?.text['ar'];
    const absent = unmarked.filter((row) => row.values.E === 'absent');
    assert.ok(absent.length > 0 && absent.every((row) => row.appreciation === middle));
    const noPhrase = { bands: LIST.bands, phrases: [] };
    assert.throws(() => madeUpTermMarks(SEED, PUPILS, formula('cem'), 20, noPhrase), RangeError);
  });
});

describe('the export a teacher signs and sends', () => {
  const marks = madeUpTermMarks(SEED, PUPILS, formula('cem'), 20, LIST);

  it('writes minhajna/term-export/1 with its fields in one order and each row’s parts in the book’s', () => {
    const text = termExportText(HEAD, marks);
    const read = JSON.parse(text) as Record<string, unknown>;
    assert.deepEqual(Object.keys(read), [
      'format',
      'world',
      'kind',
      'school',
      'term',
      'class',
      'subject',
      'signed',
      'scale',
      'formula',
      'parts',
      'rows',
    ]);
    assert.deepEqual(
      [read['format'], read['kind'], read['class'], read['signed'], read['formula']],
      ['minhajna/term-export/1', 'marks', '4AM2', '2026-12-10', 'cem'],
    );
    const [first] = read['rows'] as Record<string, unknown>[];
    assert.deepEqual(Object.keys(first!), ['registration', 'values', 'average', 'appreciation']);
    assert.deepEqual(Object.keys(first!['values'] as object), ['T', 'F', 'E']);
    assert.equal(text, termExportText(HEAD, marks));
    const full = {
      ...marks,
      rows: [{ ...marks.rows[0]!, values: { T: 12.5, F: 11.333333, E: 15 }, average: 13.916666 }],
    };
    const [written] = (JSON.parse(termExportText(HEAD, full)) as { rows: Record<string, unknown>[] }).rows;
    assert.deepEqual([written!['values'], written!['average']], [{ T: 12.5, F: 11.33, E: 15 }, 13.92]);
  });

  it('matches every row of the marks shown before signing, and finds one changed', () => {
    const text = termExportText(HEAD, marks);
    assert.deepEqual(exportMatches(text, marks), { matched: marks.rows.length, total: marks.rows.length });
    const [first, ...rest] = marks.rows;
    const changed = { ...marks, rows: [{ ...first!, values: { ...first!.values, T: 20 } }, ...rest] };
    assert.deepEqual(exportMatches(termExportText(HEAD, changed), marks), {
      matched: marks.rows.length - 1,
      total: marks.rows.length,
    });
    assert.deepEqual(exportMatches('{}', marks), { matched: 0, total: marks.rows.length });
    const read = JSON.parse(termExportText(HEAD, marks)) as { rows: unknown[] };
    const extra = JSON.stringify({ ...read, rows: [...read.rows, read.rows[0]] });
    assert.deepEqual(exportMatches(extra, marks), { matched: marks.rows.length, total: marks.rows.length + 1 });
    const full = { ...marks, rows: [{ ...first!, values: { T: 12.5, F: 11.333333, E: 15 }, average: 13.916666 }] };
    assert.deepEqual(exportMatches(termExportText(HEAD, full), full), { matched: 1, total: 1 });
  });

  it('is signed by the certified key over minhajna/signed-export/1, and sealed under the world and kind', async () => {
    const [ca, teacher] = [keySigner(), keySigner()];
    const request = await certificateRequest(HEAD.world, newId(random), teacher);
    const certificate = await issueCertificate(request, HEAD.signed, newId(random), ca);
    const text = termExportText(HEAD, marks);
    const signed = await signExport(text, certificate, teacher);
    const { world, subject, publicKey, serial } = certificate;
    const expected = `minhajna/signed-export/1\n${world}\n${subject}\n${publicKey}\n${serial}\n${text}`;
    assert.equal(exportSigningText(certificate, text), expected);
    assert.equal(await teacher.verify(teacher.publicKey, expected, signed.signature), true);
    assert.deepEqual([signed.text, signed.certificate], [text, certificate]);
    await assert.rejects(signExport(text, certificate, keySigner()), RangeError);
    assert.equal(deliveryInfo('K7QF4', 'marks'), 'minhajna/state-delivery/1\nK7QF4\nmarks');
  });
});
