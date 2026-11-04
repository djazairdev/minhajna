// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking part in the insights and the log of what was sent (#622, answers 697
// and 698): off until turned on, the latest choice counting, kept in the device
// layer; a kept sending reads back as its exact text and the sending it reads
// as, and one that does not read is left out; the log lists the newest day
// first, each day in order; the terms due run from the latest term ended when
// insights were last turned on to the world's date, none while off, and a
// class's sending for a term is known to be sent. Every sending is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dueTerms,
  insightsChoice,
  insightsLog,
  layerOf,
  readInsightsSent,
  readSending,
  recordKey,
  sentSendings,
  wasSent,
  type InsightsSending,
  type SchoolYear,
} from '../src/index.ts';
import { d, openBook } from './fixtures.ts';

const year: SchoolYear = {
  id: '2026-2027',
  from: d('2026-09-20'),
  to: d('2027-07-08'),
  terms: [
    { number: 1, from: d('2026-09-20'), to: d('2026-12-17') },
    { number: 2, from: d('2027-01-03'), to: d('2027-03-18') },
    { number: 3, from: d('2027-04-04'), to: d('2027-07-08') },
  ],
  source: 'made up',
};

const sending = (term: 1 | 2 | 3, id = 'a'.repeat(32)): InsightsSending => ({
  format: 'minhajna/insights/1',
  id,
  token: 'b'.repeat(32),
  schoolTerm: 'c'.repeat(64),
  year: '2026-2027',
  term,
  wilaya: '16',
  grade: '4am',
  subject: 'arabic',
  pack: 'dz.cem.4am.arabic.example',
  release: '2026.2',
  sessions: { 'made-up-item': 2 },
  changed: { merged: [], skipped: [], split: [], retaught: [] },
  reached: 300,
});

describe('taking part in the insights', () => {
  it('is off until turned on, the latest choice counting, in the device layer', async () => {
    const book = await openBook([]);
    assert.deepEqual(insightsChoice(book.entries), { on: false, since: null });
    const on = { kind: 'insights.choice' as const, choice: { on: true } };
    assert.equal(layerOf(on), 'device');
    assert.equal(recordKey(on), 'insights-choice');
    await book.record(d('2026-12-17'), on);
    assert.deepEqual(insightsChoice(book.entries), { on: true, since: d('2026-12-17') });
    await book.record(d('2027-01-10'), { kind: 'insights.choice', choice: { on: false } });
    assert.deepEqual(insightsChoice(book.entries), { on: false, since: d('2026-12-17') });
    await book.record(d('2027-03-18'), on);
    assert.deepEqual(insightsChoice(book.entries), { on: true, since: d('2027-03-18') });
  });

  it('keeps each sending as sent, leaving out one that does not read, newest day first', async () => {
    const book = await openBook([]);
    const text = (term: 1 | 2 | 3) => JSON.stringify(sending(term));
    const sent = { kind: 'insights.sent' as const, sent: { classId: 'class-1', text: text(1) } };
    assert.equal(layerOf(sent), 'device');
    assert.equal(recordKey(sent), `insights-sent:${'a'.repeat(32)}/1`);
    await book.record(d('2026-12-17'), { kind: 'insights.choice', choice: { on: true } });
    await book.record(d('2026-12-17'), sent);
    const bad = { classId: 'class-1', text: JSON.stringify({ ...sending(2), token: 'not a token' }) };
    await book.record(d('2027-03-18'), { kind: 'insights.sent', sent: bad });
    await book.record(d('2027-03-18'), { kind: 'insights.sent', sent: { classId: '', text: text(2) } });
    await book.record(d('2027-03-18'), { kind: 'insights.sent', sent: { classId: 'class-2', text: '{' } });
    await book.record(d('2027-03-18'), { kind: 'insights.sent', sent: { classId: 'class-2', text: text(2) } });
    assert.deepEqual(readInsightsSent(sent.sent), { ...sent.sent, sending: sending(1) });
    assert.equal(sentSendings(book.entries)[0]?.text, text(1));
    assert.deepEqual(
      sentSendings(book.entries).map((one) => [one.day, one.classId, one.sending.term]),
      [
        [d('2026-12-17'), 'class-1', 1],
        [d('2027-03-18'), 'class-2', 2],
      ],
    );
    assert.deepEqual(
      insightsLog(book.entries).map((one) => [one.day, one.kind]),
      [
        [d('2027-03-18'), 'sent'],
        [d('2026-12-17'), 'on'],
        [d('2026-12-17'), 'sent'],
      ],
    );
    assert.equal(wasSent(book.entries, 'class-1', '2026-2027', 1), true);
    assert.equal(wasSent(book.entries, 'class-1', '2026-2027', 2), false);
    assert.equal(wasSent(book.entries, 'class-2', '2025-2026', 2), false);
    assert.equal(readInsightsSent({ ...sent.sent, extra: 1 }), null);
    const long = text(1) + ' '.repeat(48 * 1024);
    assert.equal(typeof readSending(JSON.parse(long)), 'object');
    assert.equal(readInsightsSent({ classId: 'class-1', text: long }), null);
    assert.equal(recordKey({ kind: 'insights.sent', sent: { classId: 'class-1', text: long } }), 'insights-sent:/');
    assert.equal(readInsightsSent(null), null);
  });
});

describe('the terms due', () => {
  it('run from the latest term ended when insights were turned on, and none while off', () => {
    const on = (since: string) => ({ on: true, since: d(since) });
    assert.deepEqual(dueTerms(year, d('2027-05-01'), { on: false, since: d('2026-12-17') }), []);
    assert.deepEqual(dueTerms(year, d('2027-05-01'), { on: true, since: null }), []);
    const numbers = (date: string, since: string) => dueTerms(year, d(date), on(since)).map((one) => one.number);
    assert.deepEqual(numbers('2026-12-17', '2026-12-17'), [1]);
    assert.deepEqual(numbers('2027-03-18', '2026-12-17'), [1, 2]);
    assert.deepEqual(numbers('2027-03-18', '2027-01-10'), [1, 2]);
    assert.deepEqual(numbers('2027-07-08', '2027-03-18'), [2, 3]);
    assert.deepEqual(numbers('2026-12-16', '2026-11-01'), []);
    assert.deepEqual(numbers('2027-03-18', '2026-11-01'), [1, 2]);
  });
});
