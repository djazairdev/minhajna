// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seeded school's share of the totals (#596, answer 628): prepared from the
// term generator's weeks, never signed, it is the share the school's signed
// copies of the same weeks give, ID included: each course's weeks in the term
// up to the day, at their latest version, and none outside it. Every world,
// school, teacher, class and week is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  issueCertificate,
  newId,
  parseDay,
  prepareShare,
  seededShare,
  signWeek,
  startKeyring,
  WEEK_FORMAT,
  type WeekForTotals,
  type WeekTotals,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';

const WORLD = 'K7QF5';
const [from, day] = [parseDay('2026-09-20'), parseDay('2026-12-10')];
const STAFFING = { math: { teachers: 2, vacantPosts: 1, hoursWithoutTeacher: 4 } };

const totals = (subject: string, reached: number, item: string): WeekTotals => ({
  subject,
  items: [{ item, sessions: 2, outcome: 'taught' }],
  reached,
  runsLong: reached > 500,
  covered: 1,
  closed: 0,
});

describe('a seeded school’s share', () => {
  it('is the share the same weeks give once signed, outside the term left out', async () => {
    const director = await device();
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const [one, two] = [newId(random), newId(random)];
    const week = (course: string, first: string, version: number, figures: WeekTotals): WeekForTotals => ({
      course,
      week: parseDay(first),
      version,
      totals: figures,
    });
    const weeks = [
      { versions: [week(one, '2026-09-13', 0, totals('math', 10, 'u1.l1'))] },
      {
        versions: [
          week(one, '2026-10-04', 0, totals('math', 90, 'u1.l2')),
          week(one, '2026-10-04', 1, totals('math', 120, 'u1.l2')),
        ],
      },
      { versions: [week(one, '2026-10-11', 0, totals('math', 600, 'u1.l3'))] },
      { versions: [week(two, '2026-10-04', 0, totals('science', 40, 's1.l1'))] },
      { versions: [week(two, '2026-12-13', 0, totals('science', 80, 's1.l2'))] },
    ];
    const common = { school: opened, day, from, directorate: '16-east', staffing: STAFFING };
    const share = await seededShare({ ...common, weeks }, director.crypto);
    const ca = keySigner();
    const signer = keySigner();
    const request = await certificateRequest(WORLD, newId(random), signer);
    const certificate = await issueCertificate(request, from, newId(random), ca);
    const signed = await Promise.all(
      weeks.flatMap(({ versions }) =>
        versions.map(({ course, week: first, version, totals: figures }) => {
          const sessions = [{ day: first, lesson: 'lesson' }];
          const text = JSON.stringify({ format: WEEK_FORMAT, course, week: first, version, totals: figures, sessions });
          return signWeek(text, certificate, signer);
        }),
      ),
    );
    const signers = { [one]: [signer.publicKey], [two]: [signer.publicKey] };
    const caKey = { world: WORLD, key: ca.publicKey, checker: ca };
    assert.deepEqual(share, await prepareShare({ ...common, weeks: signed, signers, ca: caKey }, director.crypto));
    assert.deepEqual(
      [share.subjects['math']!.classes, share.subjects['math']!.reached, share.subjects['science']!.classes],
      [1, 600, 1],
    );
    assert.deepEqual(Object.keys(share.subjects['math']!.items), ['u1.l2', 'u1.l3']);
    assert.deepEqual(Object.keys(share.subjects['science']!.items), ['s1.l1']);
  });
});
