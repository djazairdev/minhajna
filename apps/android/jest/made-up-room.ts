// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school exam's room as the director's device reads it (#603, answer 637),
// for tests whose reading is stood in for: a made-up chart with one setter and
// one class two items into a pack of the world's reference, the decision fallen
// to the director, the setter having signed the second item or, asked, no cut.

import { addDays, type CutState, type ExamChart, type WorldExam } from '@minhajna/core';
import type { SchoolRoom } from '../src/threshold/school-rooms';
import { reference } from './world-calendar';

const pack = reference.packs.find((one) => one.items.length >= 3)!;
export const madeUpItems = pack.items.map((one) => one.id);

/** The room of an exam and subject, unsettled, with the decision fallen to the director. */
export function madeUpRoom(exam: WorldExam, subject: string, none = false): SchoolRoom {
  const chart: ExamChart = {
    world: 'made-up-world',
    school: 'made-up-school',
    exam: exam.id,
    subject,
    grade: '1am',
    from: exam.from,
    figuresDay: exam.figuresDay,
    signBy: exam.signBy,
    forecastDay: addDays(exam.from, -1),
    pack: { id: pack.id, release: '1' },
    items: madeUpItems,
    setters: [{ assignment: 'made-up-assignment', name: 'Made-up setter', key: 'made-up-key' }],
    classes: [{ name: '1م1', position: madeUpItems[1], forecast: madeUpItems[2] }],
  };
  const state: CutState = {
    signed: new Map([['made-up-assignment', none ? null : madeUpItems[1]]]),
    days: new Map([['made-up-assignment', exam.figuresDay]]),
    proposed: none ? null : { item: madeUpItems[1], by: 'made-up-assignment', day: exam.figuresDay },
    settled: null,
    director: true,
  };
  return { exam, chart, state, epoch: 0, ca: 'made-up-ca' };
}
