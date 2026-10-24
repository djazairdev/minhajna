// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// When notifications may arrive (#234, answers 403 and 405): quiet hours every
// night and over the weekend, shortened by «العمل يوم السبت»; the digest as the
// weekend's quiet hours end, the year's last week included; the preview at
// 19:00 before a day with a session to teach, or at 07:00 on that day after a
// quiet evening, and only for the next 14 days; the backup reminder once, at
// 18:00 on the day it falls due, past quiet hours.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { afterQuiet, isQuiet, notifyPlan, type Planned } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const at = (day: string, time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return { day: d(day), minutes: hours * 60 + minutes };
};
const shown = (planned: readonly Planned[]) =>
  planned.map((one) => {
    const time = `${one.at.day} ${String(Math.floor(one.at.minutes / 60)).padStart(2, '0')}:00`;
    return one.kind === 'preview' ? `${time} preview ${one.day} ${one.sessions.length}` : `${time} ${one.kind}`;
  });

describe('Quiet hours', () => {
  it('run every night, and from Thursday 20:00 to Sunday 07:00', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const quiet = (day: string, time: string, saturday = false) => isQuiet(context, at(day, time), saturday);
    assert.equal(quiet('2026-10-14', '19:59'), false);
    assert.equal(quiet('2026-10-14', '20:00'), true);
    assert.equal(quiet('2026-10-15', '06:59'), true);
    assert.equal(quiet('2026-10-15', '07:00'), false);
    assert.equal(quiet('2026-10-16', '12:00'), true);
    assert.equal(quiet('2026-10-17', '12:00'), true);
    assert.equal(quiet('2026-10-17', '12:00', true), false);
    assert.equal(quiet('2026-10-16', '12:00', true), true);
  });

  it('end on Sunday at 07:00, or on Saturday for a teacher who works then', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(afterQuiet(context, at('2026-10-15', '21:00'), false), at('2026-10-18', '07:00'));
    assert.deepEqual(afterQuiet(context, at('2026-10-15', '21:00'), true), at('2026-10-17', '07:00'));
    assert.deepEqual(afterQuiet(context, at('2026-10-19', '03:00'), false), at('2026-10-19', '07:00'));
    assert.deepEqual(afterQuiet(context, at('2026-10-19', '10:00'), false), at('2026-10-19', '10:00'));
  });
});

describe('Planned notifications', () => {
  it('bring the digest on Sundays, and nothing else by default', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const plan = notifyPlan(context, at('2026-10-14', '10:00'), { digest: true, preview: false, saturday: false });
    assert.deepEqual(shown(plan), ['2026-10-18 07:00 digest', '2026-10-25 07:00 digest']);
    const saturday = notifyPlan(context, at('2026-10-14', '10:00'), { digest: true, preview: false, saturday: true });
    assert.deepEqual(shown(saturday), ['2026-10-17 07:00 digest', '2026-10-24 07:00 digest']);
  });

  it('bring the preview the evening before a school day, or that morning after a quiet evening', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const plan = notifyPlan(context, at('2026-10-25', '19:30'), { digest: false, preview: true, saturday: false });
    assert.deepEqual(shown(plan), [
      '2026-10-26 19:00 preview 2026-10-27 1',
      '2026-10-27 19:00 preview 2026-10-28 1',
      '2026-11-08 07:00 preview 2026-11-08 1',
    ]);
    const weekend = notifyPlan(context, at('2026-10-15', '10:00'), { digest: false, preview: true, saturday: false });
    assert.deepEqual(shown(weekend).slice(0, 2), [
      '2026-10-18 07:00 preview 2026-10-18 1',
      '2026-10-18 19:00 preview 2026-10-19 1',
    ]);
    const worker = notifyPlan(context, at('2026-10-15', '10:00'), { digest: false, preview: true, saturday: true });
    assert.equal(shown(worker)[0], '2026-10-17 19:00 preview 2026-10-18 1');
  });

  it('plan the first digest once the year has had a week, and the last one after it ends', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const first = notifyPlan(context, at('2026-09-13', '10:00'), { digest: true, preview: false, saturday: false });
    assert.deepEqual(shown(first), ['2026-09-27 07:00 digest']);
    const last = notifyPlan(context, at('2027-06-09', '10:00'), { digest: true, preview: true, saturday: false });
    assert.deepEqual(shown(last), ['2027-06-09 19:00 preview 2027-06-10 1', '2027-06-13 07:00 digest']);
  });

  it('bring the backup reminder once, at 18:00 on the day it falls due, past quiet hours', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const none = { digest: false, preview: false, saturday: false };
    const due = (day: string, from = at('2026-10-14', '10:00'), saturday = false) =>
      shown(notifyPlan(context, from, { ...none, saturday }, d(day)));
    assert.deepEqual(due('2026-10-20'), ['2026-10-20 18:00 backup']);
    assert.deepEqual(due('2026-10-15'), ['2026-10-15 18:00 backup']);
    assert.deepEqual(due('2026-10-16'), ['2026-10-18 07:00 backup']);
    assert.deepEqual(due('2026-10-16', undefined, true), ['2026-10-17 07:00 backup']);
    assert.deepEqual(due('2026-10-14', at('2026-10-14', '18:00')), []);
    assert.deepEqual(due('2026-10-29'), []);
    assert.deepEqual(due('2026-10-28'), ['2026-10-28 18:00 backup']);
    assert.deepEqual(shown(notifyPlan(context, at('2026-10-14', '10:00'), none)), []);
    const all = notifyPlan(context, at('2026-10-14', '10:00'), { ...none, digest: true }, d('2026-10-20'));
    assert.deepEqual(shown(all), ['2026-10-18 07:00 digest', '2026-10-20 18:00 backup', '2026-10-25 07:00 digest']);
  });
});
