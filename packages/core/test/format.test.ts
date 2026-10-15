// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatDay,
  formatDayWithMonth,
  formatSchoolYear,
  formatTextsBookDay,
  formatWholeNumber,
} from '../src/index.ts';
import { d } from './fixtures.ts';

describe('format', () => {
  it('formats a Day as dd/mm/yyyy with Western digits', () => {
    assert.equal(formatDay(d('2026-09-20')), '20/09/2026');
    assert.equal(formatDay(d('2027-01-03')), '03/01/2027');
    assert.equal(formatDay(d('2028-02-29')), '29/02/2028');
    assert.doesNotMatch(formatDay(d('2026-09-20')), /[٠-٩]/);
  });

  it('formats a Day for the texts book as yyyy/mm/dd', () => {
    assert.equal(formatTextsBookDay(d('2026-09-21')), '2026/09/21');
    assert.equal(formatTextsBookDay(d('2027-01-03')), '2027/01/03');
    assert.doesNotMatch(formatTextsBookDay(d('2026-09-21')), /[٠-٩]/);
  });

  it('formats a day with its Algerian Arabic month name', () => {
    assert.equal(formatDayWithMonth(d('2027-01-03'), 'ar'), '3 جانفي 2027');
    assert.equal(formatDayWithMonth(d('2026-07-05'), 'ar'), '5 جويلية 2026');
    assert.equal(formatDayWithMonth(d('2026-08-20'), 'ar'), '20 أوت 2026');
    assert.equal(formatDayWithMonth(d('2026-09-20'), 'ar'), '20 سبتمبر 2026');
    assert.doesNotMatch(formatDayWithMonth(d('2027-01-03'), 'ar'), /[٠-٩]/);
  });

  it('formats a day with its month name in French and English', () => {
    assert.equal(formatDayWithMonth(d('2027-01-03'), 'fr'), '3 janvier 2027');
    assert.equal(formatDayWithMonth(d('2026-08-20'), 'fr'), '20 août 2026');
    assert.equal(formatDayWithMonth(d('2027-01-03'), 'en'), '3 January 2027');
    assert.equal(formatDayWithMonth(d('2026-08-20'), 'en'), '20 August 2026');
  });

  it('formats a school year as YYYY-YYYY', () => {
    assert.equal(formatSchoolYear(2026), '2026-2027');
    assert.equal(formatSchoolYear(2027), '2027-2028');
    assert.doesNotMatch(formatSchoolYear(2026), /[٠-٩]/);

    for (const invalid of [0, -2026, 2026.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => formatSchoolYear(invalid), RangeError);
    }
  });

  it('formats whole numbers using Western digits', () => {
    assert.equal(formatWholeNumber(36), '36');
    assert.equal(formatWholeNumber(0), '0');
    assert.equal(formatWholeNumber(-0), '0');
    assert.equal(formatWholeNumber(-5), '-5');
    assert.equal(formatWholeNumber(12345), '12345');
    assert.doesNotMatch(formatWholeNumber(36), /[٠-٩]/);

    for (const invalid of [3.14, -0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.throws(() => formatWholeNumber(invalid), RangeError);
    }
  });

  it('guarantees Western digits even where an Arabic locale defaults to Eastern digits', () => {
    const arabicFormatter = new Intl.NumberFormat('ar-EG');
    const arabicNumber = arabicFormatter.format(36);
    assert.match(arabicNumber, /[٠-٩]/);

    const whole = formatWholeNumber(36);
    assert.equal(whole, '36');
    assert.doesNotMatch(whole, /[٠-٩]/);

    const arabicDate = formatDayWithMonth(d('2027-01-03'), 'ar');
    assert.equal(arabicDate, '3 جانفي 2027');
    assert.doesNotMatch(arabicDate, /[٠-٩]/);
  });
});
