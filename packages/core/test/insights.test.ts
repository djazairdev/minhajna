// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One class's anonymous insights sending for a term (#621, answer 675): a
// fresh random token and sending ID; a school-and-term code the same for a
// school's teachers in a term and different the next; the sending built from
// one course's weeks in the term, each at its latest version and in order,
// sessions added up by item, each item's latest word deciding the changes, the
// split items from the plan layer and the last week's position, with nothing
// else in it, and never one the server would refuse; and the reader that
// refuses anything but that shape. Every school, class and week is made up.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  addDays,
  INSIGHTS_FORMAT,
  insightsSending,
  MOST_ITEM_SESSIONS,
  MOST_SENDING_BYTES,
  MOST_SENDING_ITEMS,
  newSendingId,
  newTermToken,
  parseDay,
  readSending,
  schoolTermCode,
  type Day,
  type InsightsSending,
  type SendingInput,
  type WeekForTotals,
  type WeekTotals,
} from '../src/index.ts';

const random = (length: number): Uint8Array => new Uint8Array(randomBytes(length));
const digest = (text: string): Promise<string> => Promise.resolve(createHash('sha256').update(text).digest('hex'));

type Outcome = WeekTotals['items'][number]['outcome'];

function week(day: string, items: [string, number, Outcome][], reached: number, subject = 'arabic', version = 0) {
  const totals = {
    subject,
    items: items.map(([item, sessions, outcome]) => ({ item, sessions, outcome })),
    reached,
    runsLong: false,
    covered: 1,
    closed: 2,
  } satisfies WeekTotals;
  return { course: 'course-1', week: parseDay(day), version, totals } satisfies WeekForTotals;
}

const INPUT: SendingInput = {
  id: 'a'.repeat(32),
  token: 'b'.repeat(32),
  schoolTerm: 'c'.repeat(64),
  year: '2027-2028',
  term: 1,
  wilaya: '16',
  grade: '4am',
  subject: 'arabic',
  pack: { id: 'dz.cem.4am.arabic.made-up', release: '2027.1' },
  from: parseDay('2027-09-14'),
  to: parseDay('2027-12-16'),
  weeks: [
    week(
      '2027-09-26',
      [
        ['s1-w2', 1, 'taught'],
        ['s1-w3', 0, 'skipped'],
        ['s1-w4', 2, 'merged'],
        ['s1-w6', 1, 'retaught'],
      ],
      260,
    ),
    week('2027-09-19', [['s1-w2', 9, 'taught']], 900, 'arabic', 0),
    week(
      '2027-09-19',
      [
        ['s1-w1', 3, 'taught'],
        ['s1-w2', 2, 'retaught'],
        ['s1-w6', 1, 'taught'],
      ],
      120,
      'arabic',
      1,
    ),
    week('2027-12-19', [['s1-w9', 4, 'taught']], 990),
    week('2027-09-05', [['s0-w1', 4, 'taught']], 0),
    week('2027-09-12', [['s1-w1', 1, 'taught']], 20),
  ],
  split: ['s1-w5', 's1-w1', 's1-w5'],
};

const SENDING: InsightsSending = {
  format: INSIGHTS_FORMAT,
  id: 'a'.repeat(32),
  token: 'b'.repeat(32),
  schoolTerm: 'c'.repeat(64),
  year: '2027-2028',
  term: 1,
  wilaya: '16',
  grade: '4am',
  subject: 'arabic',
  pack: 'dz.cem.4am.arabic.made-up',
  release: '2027.1',
  sessions: { 's1-w1': 4, 's1-w2': 3, 's1-w3': 0, 's1-w4': 2, 's1-w6': 2 },
  changed: { merged: ['s1-w4'], skipped: ['s1-w3'], split: ['s1-w1', 's1-w5'], retaught: ['s1-w6'] },
  reached: 260,
};

describe('an insights sending', () => {
  it('draws a fresh random token and sending ID each time', () => {
    const drawn = new Set([newTermToken(random), newTermToken(random), newSendingId(random), newSendingId(random)]);
    assert.equal(drawn.size, 4);
    for (const one of drawn) assert.match(one, /^[0-9a-f]{32}$/);
  });

  it('gives a school’s teachers one code in a term, and another in another term or school', async () => {
    const term = { wilaya: '16', school: 'school-1', year: '2027-2028', term: 1 } as const;
    const code = await schoolTermCode(digest, term);
    assert.match(code, /^[0-9a-f]{64}$/);
    assert.equal(await schoolTermCode(digest, { ...term }), code);
    assert.equal(code, await digest('minhajna/insights/school/1\n16\nschool-1\n2027-2028\n1'));
    const others = [{ term: 2 as const }, { school: 'school-2' }, { year: '2028-2029' }, { wilaya: '31' }];
    for (const other of others) assert.notEqual(await schoolTermCode(digest, { ...term, ...other }), code);
  });

  it('adds up the course’s weeks in the term at their latest versions, items’ latest words their changes', () => {
    const sending = insightsSending(INPUT);
    assert.deepEqual(sending, SENDING);
    assert.deepEqual(Object.keys(sending).sort(), Object.keys(SENDING).sort());
    assert.deepEqual(readSending(JSON.parse(JSON.stringify(sending))), SENDING);
  });

  it('makes no sending without a week in the term, or from another course’s or subject’s weeks', () => {
    const outside = [week('2027-12-19', [['s1-w9', 4, 'taught']], 10)];
    assert.equal(insightsSending({ ...INPUT, weeks: outside }), 'no week of the course is in the term');
    assert.equal(insightsSending({ ...INPUT, weeks: [] }), 'no week of the course is in the term');
    const term = 'the term runs from its first day to its last';
    assert.equal(insightsSending({ ...INPUT, from: INPUT.to, to: INPUT.from }), term);
    assert.equal(insightsSending({ ...INPUT, to: '2027-13-01' as Day }), term);
    const other = { ...INPUT.weeks[0]!, course: 'course-2' };
    assert.equal(insightsSending({ ...INPUT, weeks: [...INPUT.weeks, other] }), 'a sending is one course’s');
    const math = week('2027-10-03', [['m1', 4, 'taught']], 10, 'math');
    assert.equal(
      insightsSending({ ...INPUT, weeks: [...INPUT.weeks, math] }),
      'the course’s weeks are of another subject',
    );
  });

  it('caps an item’s sessions', () => {
    const days = Array.from({ length: 12 }, (_, at) => addDays(parseDay('2027-09-19'), 7 * at));
    const long = days.map((day) => week(day as string, [['s1-w1', 60, 'taught']], 500));
    const sending = insightsSending({ ...INPUT, weeks: long, split: [] }) as InsightsSending;
    assert.equal(sending.sessions['s1-w1'], MOST_ITEM_SESSIONS);
  });

  it('refuses to make a sending the server would refuse, such as one with the school’s own code', () => {
    assert.match(insightsSending({ ...INPUT, schoolTerm: 'school-1' }) as string, /school-and-term code/);
    assert.match(insightsSending({ ...INPUT, token: 'token' }) as string, /token/);
    assert.match(insightsSending({ ...INPUT, split: ['s1 w5'] }) as string, /split items/);
  });
});

describe('reading an insights sending', () => {
  const refused = (change: Record<string, unknown>): string => readSending({ ...SENDING, ...change }) as string;

  it('refuses a missing, extra or inherited field', () => {
    const short = Object.fromEntries(Object.entries(SENDING).filter(([field]) => field !== 'reached'));
    assert.match(readSending(short) as string, /holds exactly/);
    assert.match(refused({ date: '2027-12-16' }), /holds exactly/);
    assert.match(readSending(Object.create(SENDING) as unknown) as string, /holds exactly/);
    for (const value of [null, [], 'text', 7]) assert.match(readSending(value) as string, /holds exactly/);
    assert.equal(readSending({ ...SENDING, reached: 10n }), 'a sending is JSON');
  });

  it('refuses a field of the wrong shape', () => {
    assert.match(refused({ format: 'minhajna/insights/2' }), /format/);
    assert.match(refused({ id: 'A'.repeat(32) }), /ID/);
    assert.match(refused({ token: 'b'.repeat(31) }), /token/);
    assert.match(refused({ schoolTerm: 'C'.repeat(64) }), /school-and-term/);
    assert.match(refused({ schoolTerm: 'school-1' }), /school-and-term/);
    assert.match(refused({ year: '2027' }), /year/);
    for (const term of [0, 4, '1', 1.5]) assert.match(refused({ term }), /term/);
    assert.match(refused({ wilaya: 'ولاية' }), /wilaya/);
    assert.match(refused({ grade: '__proto__' }), /grade/);
    assert.match(refused({ subject: 'constructor' }), /subject/);
    assert.match(refused({ pack: 'made-up' }), /pack/);
    assert.match(refused({ release: '2027' }), /release/);
    for (const reached of [-1, 1001, 2.5, '260']) assert.match(refused({ reached }), /reached/);
  });

  it('refuses sessions that are not whole counts of named items', () => {
    assert.match(refused({ sessions: [] }), /sessions/);
    assert.match(refused({ sessions: { 's1 w1': 3 } }), /named/);
    assert.match(refused({ sessions: JSON.parse('{"__proto__": 1}') as unknown }), /named/);
    for (const count of [-1, MOST_ITEM_SESSIONS + 1, 1.5, '3']) {
      assert.match(refused({ sessions: { ...SENDING.sessions, x: count } }), /sessions each/);
    }
    const many = Object.fromEntries(Array.from({ length: MOST_SENDING_ITEMS + 1 }, (_, at) => [`i${at}`, 1]));
    assert.match(refused({ sessions: many }), /at most/);
  });

  it('refuses changes that are not the four lists of items, in order, once each, among the items', () => {
    const changed = (lists: Record<string, unknown>) => refused({ changed: { ...SENDING.changed, ...lists } });
    assert.match(refused({ changed: { merged: [] } }), /changes are the lists/);
    assert.match(changed({ moved: [] }), /changes are the lists/);
    assert.match(changed({ merged: 's1-w4' }), /merged items are a list/);
    assert.match(changed({ skipped: ['s1-w3', 's1-w3'] }), /once each/);
    assert.match(changed({ retaught: ['s1-w2', 's1-w1'] }), /once each/);
    assert.match(changed({ merged: ['s1-w9'] }), /among the items/);
    assert.match(changed({ split: ['s1-w5', 's1-w1'] }), /split items are named once each, in order/);
    const many = Array.from({ length: MOST_SENDING_ITEMS + 1 }, (_, at) => `i${String(at).padStart(4, '0')}`);
    assert.match(changed({ split: many }), /split items are a list of at most/);
    assert.deepEqual(readSending({ ...SENDING, changed: { ...SENDING.changed, split: ['s1-w9'] } }), {
      ...SENDING,
      changed: { ...SENDING.changed, split: ['s1-w9'] },
    });
  });

  it('refuses a sending past its bytes', () => {
    const named = Array.from({ length: MOST_SENDING_ITEMS }, (_, at) => String(at).padStart(64, 'x'));
    const sessions = Object.fromEntries(named.map((item) => [item, 1]));
    const changed = { merged: [], skipped: [], split: [...named].sort(), retaught: [] };
    const shorter = { ...SENDING, sessions, changed: { ...changed, split: changed.split.slice(0, 100) } };
    assert.deepEqual(readSending(shorter), shorter);
    assert.ok(JSON.stringify({ ...SENDING, sessions, changed }).length > MOST_SENDING_BYTES);
    assert.match(refused({ sessions, changed }), /bytes/);
  });
});
