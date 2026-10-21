// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CALENDAR_NOTICE_BYTES, CalendarNoticeError, parseCalendarNotice } from '../src/index.ts';
import { country, year } from './fixtures.ts';
import { noticeFile } from './calendar-notice-fixtures.ts';

const profile = {
  ...country,
  zones: [
    { code: '16', name: { en: 'Example zone' } },
    { code: '31', name: { en: 'Other zone' } },
  ],
};
const read = (value: unknown) => parseCalendarNotice(JSON.stringify(value), profile, year);

test('allowlists a single closure with its source, confidence, half-day and unverified sender', () => {
  const notice = read(noticeFile);
  assert.equal(notice.sender, noticeFile.sender);
  assert.equal(notice.entry.half, 'morning');
  assert.equal(notice.entry.effect, 'closure');
  assert.equal(notice.school?.zone, '16');
  const next = read({
    ...noticeFile,
    version: { major: 1, minor: 2 },
    pupilData: { invented: true },
    school: { ...noticeFile.school, private: 'ignored' },
    entry: { ...noticeFile.entry, pupils: ['made-up'], absences: ['made-up'], unknown: true },
  });
  assert.equal(next.version.minor, 2);
  assert.equal(JSON.stringify(next).includes('pupil'), false);
  assert.equal(JSON.stringify(next).includes('absences'), false);
  assert.equal(JSON.stringify(next).includes('private'), false);
});

test('rejects wrong formats, majors, years, countries and unsafe semantics without echoing content', () => {
  const invalid = [
    { ...noticeFile, format: 'https://example.invalid' },
    { ...noticeFile, version: { major: 2, minor: 0 } },
    { ...noticeFile, version: { major: 1, minor: -1 } },
    { ...noticeFile, country: 'xx' },
    { ...noticeFile, year: '2025-2026' },
    { ...noticeFile, signature: 'untrusted' },
    { ...noticeFile, signed: true },
    { ...noticeFile, entries: [] },
    { ...noticeFile, sender: 'invented\nprivate' },
    ...['national', 'teacher'].map((layer) => ({ ...noticeFile, entry: { ...noticeFile.entry, layer } })),
    ...['exam', 'marker', 'no-school', 'rotating-groups', 'adds-sessions'].map((effect) => ({
      ...noticeFile,
      entry: { ...noticeFile.entry, effect },
    })),
    ...['schoolId', 'times', 'term', 'adds', 'takes', 'rotation', 'council', 'lunar', 'confirmedFrom', 'received'].map(
      (key) => ({
        ...noticeFile,
        entry: { ...noticeFile.entry, [key]: 'untrusted' },
      }),
    ),
  ];
  for (const value of invalid)
    assert.throws(
      () => read(value),
      (error: unknown) => {
        assert.ok(error instanceof CalendarNoticeError);
        assert.ok(!error.message.includes('untrusted') && !error.message.includes('invented'));
        return true;
      },
    );
});

test('checks real civil dates, ranges, names, code references, source lengths and school descriptors', () => {
  const invalid = [
    { ...noticeFile, school: null },
    { ...noticeFile, school: { ...noticeFile.school, zone: 'unknown' } },
    { ...noticeFile, school: { ...noticeFile.school, code: '<script>' } },
    ...[
      { from: '2026-02-30' },
      { to: '2026-10-13' },
      { from: '2025-10-14' },
      { half: 'night' },
      { source: '' },
      { source: 'x'.repeat(201) },
      { name: { ar: '' } },
      { name: { bad_language: 'invented' } },
      { levels: ['unknown'] },
      { grades: ['unknown'] },
      { levels: ['cem'], grades: ['5ap'] },
    ].map((entry) => ({ ...noticeFile, entry: { ...noticeFile.entry, ...entry } })),
  ];
  for (const value of invalid) assert.throws(() => read(value));
});

test('rejects oversized UTF-8, lone surrogates, malformed JSON, arrays, URL codes and multiple notices', () => {
  for (const text of [
    'https://example.invalid',
    '{',
    '[]',
    JSON.stringify([noticeFile]),
    JSON.stringify({ ...noticeFile, sender: '\ud800' }),
    ' '.repeat(CALENDAR_NOTICE_BYTES + 1),
    'ش'.repeat(CALENDAR_NOTICE_BYTES / 2 + 1),
    '\ud800',
  ]) {
    assert.throws(() => parseCalendarNotice(text, profile, year), CalendarNoticeError);
  }
});

test('refuses bidi controls in every text, so no claimed sender or source can read as another', () => {
  for (const control of ['\u061c', '\u200e', '\u200f', '\u202a', '\u202e', '\u2066', '\u2069']) {
    for (const value of [
      { ...noticeFile, sender: `Made-up${control}sender` },
      { ...noticeFile, school: { ...noticeFile.school, name: `Made-up${control}school` } },
      { ...noticeFile, entry: { ...noticeFile.entry, source: `Made-up${control}source` } },
      { ...noticeFile, entry: { ...noticeFile.entry, name: { en: `Made-up${control}name` } } },
    ]) {
      assert.throws(() => read(value), CalendarNoticeError);
    }
  }
});

test('zone notices carry no school or local school ID and preserve their zone layer', () => {
  const { school, ...base } = noticeFile;
  assert.ok(school);
  const notice = read({ ...base, entry: { ...base.entry, layer: 'zone', zone: '16' } });
  assert.equal(notice.entry.layer, 'zone');
  assert.equal(notice.entry.zone, '16');
  assert.equal(notice.school, undefined);
  assert.throws(() => read({ ...noticeFile, entry: { ...base.entry, layer: 'zone', zone: '16' } }));
});
