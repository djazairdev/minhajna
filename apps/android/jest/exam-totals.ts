// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A directorate exam's totals set up for their tests (#602, answer 635), on the
// made-up school of timetable-send.ts: a joined phone whose world's date is an
// announced day, the mock exam and, when asked, the BEM on its exams list with
// one made-up class of the 4th grade's math, each exam's positions taken as
// own-exams.ts takes them by the date asked, made-up shares of the 4th grade
// put on the demo server for the own directorate and for another, so the
// nation's figures stand apart from the own, and the figure the table gives a
// plan item.

import { addDays, compareDays, type Day, type ExamChart, type WorldExam } from '@minhajna/core';
import { randomBytes } from 'node:crypto';
import * as ownExamsModule from '../src/threshold/own-exams';
import { roomId } from '../src/threshold/threshold-text';
import { props, texts } from './threshold-page';
import { server, setting } from './timetable-send';
import { reference } from './world-calendar';

export const OWN = 'dir-made-up';
export const pack = reference.packs.find((one) => one.items.length >= 4)!;
export const items = pack.items.map((one) => one.id);
export const ROOM = roomId({ exam: 'mock', subject: 'math', grade: '4am' });
export const CLASS = '4م1';

/** A made-up school's share of math, its 4th grade's 3 classes having reached the items given. */
export function putShare(world: string, day: Day, reached: Record<string, number>, directorate = OWN) {
  const id = randomBytes(32).toString('hex');
  const item = { sessions: 4, merged: 0, skipped: 0, retaught: 0 };
  const math = {
    teachers: 2,
    vacantPosts: 0,
    hoursWithoutTeacher: 0,
    classes: 3,
    cover: 0,
    closed: 0,
    reached: 100,
    runLong: 0,
    items: { [items[0]]: item },
    grades: { '4am': { teachers: 2, classes: 3, items: reached } },
  };
  const share = { format: 'minhajna/total-share/1', id, day, directorate, subjects: { math } };
  server.shares.set(`${world}\n${day}\n${id}`, share);
}

/** Made-up shares from `schools` schools of the own directorate, and from 4 of another. */
export function putShares(world: string, day: Day, schools: number, reached: (at: number) => Record<string, number>) {
  for (let at = 0; at < schools; at += 1) putShare(world, day, reached(at));
  for (let at = 0; at < 4; at += 1) putShare(world, day, { [items[0]]: 3, [items[1]]: 3 }, 'dir-other');
}

/** The joined phone, its world's date an announced day, and the mock exam, its figures day `ahead` days on. */
export async function mockExam(ahead = 0, bem = false) {
  const { id, here, joined } = await setting();
  const date = here.date;
  server.worlds.get(id)!.announced.push(date);
  const exam = (one: 'mock' | 'bem', setBy: WorldExam['setBy']): WorldExam => ({
    id: one,
    setBy,
    term: 3,
    from: addDays(date, 10),
    to: addDays(date, 12),
    figuresDay: addDays(date, ahead),
    signBy: addDays(date, 5),
    grades: ['4am'],
    levels: [],
  });
  const exams = bem ? [exam('mock', 'directorate'), exam('bem', 'national')] : [exam('mock', 'directorate')];
  const chart = { subject: 'math', grade: '4am', forecastDay: addDays(date, 9), pack, items };
  const one = { name: CLASS, position: items[1], forecast: items[2] } as ExamChart['classes'][number];
  jest.spyOn(ownExamsModule, 'ownExams').mockImplementation(
    (_weeks, _school, _reference, on) =>
      exams.map((each) => ({
        exam: each,
        asOf: compareDays(on, each.figuresDay) < 0 ? addDays(on, -1) : each.figuresDay,
        charts: [{ ...chart, exam: each.id, from: each.from, figuresDay: each.figuresDay, classes: [one] }],
      })) as never,
  );
  const page = { ...props({ world: id, date }, joined), school: { directorateId: OWN } as never };
  return { id, date, page };
}

/** The figure the table gives a plan item, in the cell after its name. */
export function figureFor(title: string) {
  const all = texts();
  return all[all.findIndex((line) => line.includes(title) && !line.includes(CLASS)) + 1];
}
