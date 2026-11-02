// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's chart for a school exam (#601, answers 631 and 632): a chart
// names its room, its days in order, the signing deadline among them, its pack
// and items each once and as text, its classes each named once with a forecast
// exactly when a position and never before it, and its setters each with their
// own assignment and key; the open days are counted both ends included; the
// forecast day is the last school day before the exam, after the figures day;
// and a class's forecast carries its own pace over the days left, never past
// the pack's end nor back, a pack of no item having no place. Every school,
// class, teacher and pack is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { forecastAt, forecastDayOf, isExamChart, openDays, parseDay, weekday } from '../src/index.ts';
import type { Day } from '../src/index.ts';
import { madeUpChart } from './exam-kit.ts';

const day = (text: string) => parseDay(text);

describe('the school’s chart for an exam', () => {
  it('names its room, its days in order, and its classes’ items among its own', () => {
    assert.equal(isExamChart(madeUpChart()), true);
    assert.equal(isExamChart({ ...madeUpChart(), more: 1 }), false);
    assert.equal(isExamChart(madeUpChart({ exam: 'Term 1' })), false);
    assert.equal(isExamChart(madeUpChart({ forecastDay: day('2029-11-21') })), false);
    assert.equal(isExamChart(madeUpChart({ forecastDay: day('2029-12-02') })), false);
    assert.equal(isExamChart(madeUpChart({ items: ['u1', 'u1'] })), false);
    assert.equal(isExamChart(madeUpChart({ classes: [{ name: '4م1', position: 'u9', forecast: null }] })), false);
    assert.equal(isExamChart(madeUpChart({ classes: [{ name: '4م\u202e1', position: null, forecast: null }] })), false);
    const [one] = madeUpChart().setters;
    assert.equal(isExamChart(madeUpChart({ setters: [one!, { ...one!, assignment: 'f'.repeat(32) }] })), false);
    assert.equal(isExamChart(madeUpChart({ setters: [{ ...one!, key: 'not a key' }] })), false);
    assert.equal(isExamChart(madeUpChart({ pack: { id: 'math', release: '2029.1' } })), false);
    const odd = (more: Record<string, unknown>) => isExamChart({ ...madeUpChart(), ...more });
    assert.equal(odd({ pack: { id: ['dz.cem.4am.arabic.made-up'], release: '2029.1' } }), false);
    assert.equal(odd({ items: [1, 2] }), false);
    assert.equal(isExamChart(madeUpChart({ setters: [{ ...one!, assignment: 1 as unknown as string }] })), false);
    const [, two] = madeUpChart().setters;
    assert.equal(isExamChart(madeUpChart({ setters: [one!, { ...two!, assignment: one!.assignment }] })), false);
    const [first] = madeUpChart().classes;
    assert.equal(isExamChart(madeUpChart({ classes: [first!, first!] })), false);
    assert.equal(isExamChart(madeUpChart({ signBy: day('2029-12-02') })), false);
    assert.equal(isExamChart(madeUpChart({ signBy: day('2029-11-21') })), false);
    assert.equal(isExamChart(madeUpChart({ classes: [{ ...first!, forecast: 'u2' }] })), false);
    assert.equal(isExamChart(madeUpChart({ classes: [{ ...first!, forecast: null }] })), false);
    assert.equal(isExamChart(madeUpChart({ classes: [{ name: '4م3', position: null, forecast: 'u1' }] })), false);
  });

  it('counts the open days, both ends included, and forecasts to the last school day before the exam', () => {
    const open = (one: Day) => ![5, 6].includes(weekday(one)) && one !== day('2029-11-28');
    assert.equal(openDays(day('2029-11-25'), day('2029-11-29'), open), 4);
    assert.equal(openDays(day('2029-11-30'), day('2029-11-30'), open), 0);
    assert.deepEqual(forecastDayOf(day('2029-11-22'), day('2029-12-02'), open), day('2029-11-29'));
    assert.deepEqual(forecastDayOf(day('2029-11-22'), day('2029-11-23'), open), day('2029-11-22'));
  });

  it('carries a class’s own pace over the days left, never past the pack’s end nor back', () => {
    assert.equal(forecastAt(3, 10, 40, 10), 4);
    assert.equal(forecastAt(3, 10, 40, 0), 3);
    assert.equal(forecastAt(7, 10, 20, 20), 9);
    assert.equal(forecastAt(-1, 10, 40, 10), -1);
    assert.equal(forecastAt(2, 10, 0, 10), 2);
    assert.equal(forecastAt(0, 0, 40, 10), -1);
    assert.equal(forecastAt(12, 10, 40, -3), 9);
  });
});
